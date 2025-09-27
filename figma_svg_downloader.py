#!/usr/bin/env python3
"""
Figma SVG Downloader
Скрипт для автоматического скачивания всех SVG изображений из Figma дизайна
"""

import requests
import json
import os
import re
import time
from urllib.parse import urlparse, parse_qs
from typing import List, Dict, Optional
import argparse


class FigmaSVGDownloader:
    def __init__(self, access_token: str):
        """
        Инициализация загрузчика Figma
        
        Args:
            access_token: Персональный токен доступа Figma
        """
        self.access_token = access_token
        self.base_url = "https://api.figma.com/v1"
        self.headers = {
            "X-Figma-Token": access_token,
            "Content-Type": "application/json"
        }
        
    def extract_file_key_and_node_id(self, figma_url: str) -> tuple:
        """
        Извлекает file_key и node_id из URL Figma
        
        Args:
            figma_url: URL дизайна Figma
            
        Returns:
            tuple: (file_key, node_id)
        """
        # Паттерн для извлечения file_key из URL
        file_key_pattern = r'/design/([a-zA-Z0-9]+)'
        file_key_match = re.search(file_key_pattern, figma_url)
        
        if not file_key_match:
            raise ValueError("Не удалось извлечь file_key из URL")
            
        file_key = file_key_match.group(1)
        
        # Извлекаем node_id из параметров URL
        parsed_url = urlparse(figma_url)
        query_params = parse_qs(parsed_url.query)
        
        node_id = query_params.get('node-id', [None])[0]
        if node_id:
            # Убираем префикс, если он есть
            node_id = node_id.replace('2035-', '')
        
        return file_key, node_id
    
    def get_file_info(self, file_key: str) -> Dict:
        """
        Получает информацию о файле Figma
        
        Args:
            file_key: Ключ файла Figma
            
        Returns:
            Dict: Информация о файле
        """
        url = f"{self.base_url}/files/{file_key}"
        response = requests.get(url, headers=self.headers)
        
        if response.status_code != 200:
            raise Exception(f"Ошибка при получении информации о файле: {response.status_code} - {response.text}")
            
        return response.json()
    
    def get_node_images(self, file_key: str, node_id: str = None) -> Dict:
        """
        Получает информацию об изображениях в узле
        
        Args:
            file_key: Ключ файла Figma
            node_id: ID узла (опционально)
            
        Returns:
            Dict: Информация об изображениях
        """
        url = f"{self.base_url}/images/{file_key}"
        params = {
            "format": "svg",
            "scale": 1
        }
        
        if node_id:
            params["ids"] = node_id
            
        response = requests.get(url, headers=self.headers, params=params)
        
        if response.status_code != 200:
            raise Exception(f"Ошибка при получении изображений: {response.status_code} - {response.text}")
            
        return response.json()
    
    def find_all_image_nodes(self, document: Dict, image_nodes: List[str] = None) -> List[str]:
        """
        Рекурсивно находит все узлы с изображениями в документе
        
        Args:
            document: Документ Figma
            image_nodes: Список найденных узлов с изображениями
            
        Returns:
            List[str]: Список ID узлов с изображениями
        """
        if image_nodes is None:
            image_nodes = []
            
        if not isinstance(document, dict):
            return image_nodes
            
        # Проверяем, является ли узел изображением
        if document.get("type") in ["RECTANGLE", "ELLIPSE", "POLYGON", "STAR", "VECTOR", "FRAME", "COMPONENT", "INSTANCE"]:
            # Проверяем, есть ли fill с изображением
            fills = document.get("fills", [])
            for fill in fills:
                if fill.get("type") == "IMAGE":
                    node_id = document.get("id")
                    if node_id and node_id not in image_nodes:
                        image_nodes.append(node_id)
        
        # Рекурсивно обходим дочерние элементы
        children = document.get("children", [])
        for child in children:
            self.find_all_image_nodes(child, image_nodes)
            
        return image_nodes
    
    def download_image(self, url: str, filename: str, output_dir: str) -> bool:
        """
        Скачивает изображение по URL
        
        Args:
            url: URL изображения
            filename: Имя файла для сохранения
            output_dir: Директория для сохранения
            
        Returns:
            bool: True если успешно скачано
        """
        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                filepath = os.path.join(output_dir, filename)
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                print(f"✓ Скачано: {filename}")
                return True
            else:
                print(f"✗ Ошибка скачивания {filename}: {response.status_code}")
                return False
        except Exception as e:
            print(f"✗ Ошибка при скачивании {filename}: {str(e)}")
            return False
    
    def download_all_svgs(self, figma_url: str, output_dir: str = "figma_svgs") -> None:
        """
        Скачивает все SVG изображения из Figma дизайна
        
        Args:
            figma_url: URL дизайна Figma
            output_dir: Директория для сохранения файлов
        """
        print(f"🚀 Начинаем скачивание SVG из Figma...")
        print(f"📁 URL: {figma_url}")
        
        # Создаем директорию для сохранения
        os.makedirs(output_dir, exist_ok=True)
        
        try:
            # Извлекаем file_key и node_id
            file_key, node_id = self.extract_file_key_and_node_id(figma_url)
            print(f"🔑 File Key: {file_key}")
            if node_id:
                print(f"🎯 Node ID: {node_id}")
            
            # Получаем информацию о файле
            print("📋 Получаем информацию о файле...")
            file_info = self.get_file_info(file_key)
            
            # Находим все узлы с изображениями
            print("🔍 Ищем узлы с изображениями...")
            all_image_nodes = []
            
            # Если указан конкретный node_id, используем его
            if node_id:
                all_image_nodes = [node_id]
            else:
                # Ищем во всех страницах документа
                pages = file_info.get("document", {}).get("children", [])
                for page in pages:
                    self.find_all_image_nodes(page, all_image_nodes)
            
            if not all_image_nodes:
                print("⚠️  Узлы с изображениями не найдены")
                return
            
            print(f"📊 Найдено {len(all_image_nodes)} узлов с изображениями")
            
            # Получаем URL изображений
            print("🖼️  Получаем URL изображений...")
            image_info = self.get_node_images(file_key, ",".join(all_image_nodes))
            
            # Скачиваем изображения
            print("⬇️  Начинаем скачивание...")
            downloaded_count = 0
            
            for node_id, image_data in image_info.get("images", {}).items():
                if image_data:
                    filename = f"image_{node_id}.svg"
                    if self.download_image(image_data, filename, output_dir):
                        downloaded_count += 1
                    time.sleep(0.5)  # Небольшая задержка между запросами
            
            print(f"✅ Скачивание завершено! Скачано {downloaded_count} файлов в директорию '{output_dir}'")
            
        except Exception as e:
            print(f"❌ Ошибка: {str(e)}")


def main():
    parser = argparse.ArgumentParser(description="Скачивание SVG изображений из Figma")
    parser.add_argument("url", help="URL дизайна Figma")
    parser.add_argument("--token", help="Персональный токен доступа Figma")
    parser.add_argument("--output", "-o", default="figma_svgs", help="Директория для сохранения (по умолчанию: figma_svgs)")
    
    args = parser.parse_args()
    
    # Получаем токен из аргументов или переменной окружения
    access_token = args.token or os.getenv("FIGMA_ACCESS_TOKEN")
    
    if not access_token:
        print("❌ Ошибка: Необходим персональный токен доступа Figma")
        print("📝 Получите токен на https://www.figma.com/developers/api#access-tokens")
        print("💡 Используйте: --token YOUR_TOKEN или установите переменную FIGMA_ACCESS_TOKEN")
        return
    
    downloader = FigmaSVGDownloader(access_token)
    downloader.download_all_svgs(args.url, args.output)


if __name__ == "__main__":
    main()