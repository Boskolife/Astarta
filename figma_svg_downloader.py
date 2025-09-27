#!/usr/bin/env python3
"""
Figma SVG Downloader
Скрипт для скачивания всех SVG изображений из дизайна Figma
"""

import requests
import json
import os
import re
from urllib.parse import urlparse, parse_qs
import time
from pathlib import Path

class FigmaSVGDownloader:
    def __init__(self, access_token):
        """
        Инициализация загрузчика Figma SVG
        
        Args:
            access_token (str): Токен доступа к Figma API
        """
        self.access_token = access_token
        self.base_url = "https://api.figma.com/v1"
        self.headers = {
            "X-Figma-Token": access_token,
            "Content-Type": "application/json"
        }
    
    def extract_file_key(self, figma_url):
        """
        Извлекает file key из URL Figma
        
        Args:
            figma_url (str): URL дизайна Figma
            
        Returns:
            str: File key
        """
        # URL pattern: https://www.figma.com/design/FILE_KEY/PROJECT_NAME?...
        pattern = r"figma\.com/design/([a-zA-Z0-9]+)/"
        match = re.search(pattern, figma_url)
        if match:
            return match.group(1)
        else:
            raise ValueError("Не удалось извлечь file key из URL")
    
    def get_file_info(self, file_key):
        """
        Получает информацию о файле Figma
        
        Args:
            file_key (str): Ключ файла Figma
            
        Returns:
            dict: Информация о файле
        """
        url = f"{self.base_url}/files/{file_key}"
        response = requests.get(url, headers=self.headers)
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Ошибка получения информации о файле: {response.status_code} - {response.text}")
    
    def find_all_nodes(self, node, node_list=None):
        """
        Рекурсивно находит все узлы в дереве компонентов
        
        Args:
            node (dict): Узел компонента
            node_list (list): Список узлов для сбора
            
        Returns:
            list: Список всех узлов
        """
        if node_list is None:
            node_list = []
        
        # Добавляем текущий узел если он экспортируемый
        if self.is_exportable_node(node):
            node_list.append({
                "id": node["id"],
                "name": node.get("name", "unnamed"),
                "type": node["type"]
            })
        
        # Рекурсивно обходим дочерние узлы
        if "children" in node:
            for child in node["children"]:
                self.find_all_nodes(child, node_list)
        
        return node_list
    
    def is_exportable_node(self, node):
        """
        Определяет, можно ли экспортировать узел как изображение
        
        Args:
            node (dict): Узел компонента
            
        Returns:
            bool: True если узел можно экспортировать
        """
        # Типы узлов, которые можно экспортировать как изображения
        exportable_types = [
            "VECTOR", "RECTANGLE", "ELLIPSE", "POLYGON", "STAR", 
            "LINE", "FRAME", "GROUP", "COMPONENT", "INSTANCE",
            "BOOLEAN_OPERATION", "REGULAR_POLYGON"
        ]
        
        node_type = node.get("type", "")
        
        # Проверяем тип узла
        if node_type in exportable_types:
            return True
        
        # Проверяем наличие экспортных настроек
        if "exportSettings" in node and len(node["exportSettings"]) > 0:
            return True
            
        return False
    
    def get_export_urls(self, file_key, node_ids, format="svg"):
        """
        Получает URL для экспорта изображений
        
        Args:
            file_key (str): Ключ файла Figma
            node_ids (list): Список ID узлов для экспорта
            format (str): Формат экспорта (svg, png, jpg)
            
        Returns:
            dict: Словарь с URL для скачивания
        """
        # Разбиваем на батчи по 100 узлов (ограничение API)
        batch_size = 100
        all_export_urls = {}
        
        for i in range(0, len(node_ids), batch_size):
            batch = node_ids[i:i + batch_size]
            ids_param = ",".join(batch)
            
            url = f"{self.base_url}/images/{file_key}"
            params = {
                "ids": ids_param,
                "format": format,
                "scale": 1
            }
            
            response = requests.get(url, headers=self.headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                if "images" in data:
                    all_export_urls.update(data["images"])
                    print(f"Получены URL для экспорта {len(batch)} изображений")
                else:
                    print(f"Предупреждение: Не получены URL для батча {i//batch_size + 1}")
            else:
                print(f"Ошибка получения URL для экспорта: {response.status_code} - {response.text}")
            
            # Небольшая пауза между запросами
            time.sleep(0.5)
        
        return all_export_urls
    
    def download_svg(self, url, filename, output_dir):
        """
        Скачивает SVG файл по URL
        
        Args:
            url (str): URL для скачивания
            filename (str): Имя файла
            output_dir (str): Директория для сохранения
        """
        if not url:
            print(f"Пустой URL для {filename}, пропускаем")
            return False
            
        try:
            response = requests.get(url)
            if response.status_code == 200:
                # Создаем директорию если не существует
                Path(output_dir).mkdir(parents=True, exist_ok=True)
                
                # Очищаем имя файла от недопустимых символов
                safe_filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
                if not safe_filename.endswith('.svg'):
                    safe_filename += '.svg'
                
                filepath = os.path.join(output_dir, safe_filename)
                
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                
                print(f"✓ Скачан: {safe_filename}")
                return True
            else:
                print(f"✗ Ошибка скачивания {filename}: {response.status_code}")
                return False
        except Exception as e:
            print(f"✗ Ошибка при скачивании {filename}: {e}")
            return False
    
    def download_all_svgs(self, figma_url, output_dir="figma_svgs"):
        """
        Основная функция для скачивания всех SVG из дизайна Figma
        
        Args:
            figma_url (str): URL дизайна Figma
            output_dir (str): Директория для сохранения
        """
        try:
            print("🚀 Начинаем скачивание SVG из Figma...")
            
            # Извлекаем file key
            file_key = self.extract_file_key(figma_url)
            print(f"📁 File key: {file_key}")
            
            # Получаем информацию о файле
            print("📋 Получаем структуру файла...")
            file_info = self.get_file_info(file_key)
            
            # Находим все экспортируемые узлы
            all_nodes = []
            node_name_map = {}
            
            for page in file_info["document"]["children"]:
                print(f"📄 Обрабатываем страницу: {page.get('name', 'Unnamed')}")
                page_nodes = self.find_all_nodes(page)
                all_nodes.extend(page_nodes)
                
                # Создаем карту ID -> имя
                for node in page_nodes:
                    node_name_map[node["id"]] = node["name"]
            
            print(f"🔍 Найдено {len(all_nodes)} экспортируемых узлов")
            
            if not all_nodes:
                print("❌ Не найдено узлов для экспорта")
                return
            
            # Получаем URL для экспорта
            print("🔗 Получаем URL для экспорта...")
            node_ids = [node["id"] for node in all_nodes]
            export_urls = self.get_export_urls(file_key, node_ids, "svg")
            
            print(f"📥 Получены URL для {len(export_urls)} изображений")
            
            # Скачиваем все SVG
            print("⬇️ Начинаем скачивание SVG файлов...")
            success_count = 0
            
            for node_id, url in export_urls.items():
                node_name = node_name_map.get(node_id, f"node_{node_id}")
                success = self.download_svg(url, node_name, output_dir)
                if success:
                    success_count += 1
                
                # Небольшая пауза между скачиваниями
                time.sleep(0.2)
            
            print(f"\n✅ Скачивание завершено!")
            print(f"📊 Успешно скачано: {success_count} из {len(export_urls)} файлов")
            print(f"📂 Файлы сохранены в: {os.path.abspath(output_dir)}")
            
        except Exception as e:
            print(f"❌ Ошибка: {e}")


def main():
    """
    Главная функция для запуска скрипта
    """
    print("=== Figma SVG Downloader ===")
    print()
    
    # URL вашего дизайна
    figma_url = "https://www.figma.com/design/IQgPIHYpGnotfOrtwPijJU/Terra-Vino?node-id=2035-4862&t=4mU0z4d1Yk6zYwRg-0"
    
    # Получаем токен доступа
    access_token = input("Введите ваш Figma Access Token: ").strip()
    
    if not access_token:
        print("❌ Токен доступа не может быть пустым")
        print()
        print("Для получения токена:")
        print("1. Откройте https://www.figma.com/")
        print("2. Войдите в аккаунт")
        print("3. Перейдите в Settings > Personal Access Tokens")
        print("4. Создайте новый токен")
        return
    
    # Создаем загрузчик
    downloader = FigmaSVGDownloader(access_token)
    
    # Скачиваем все SVG
    downloader.download_all_svgs(figma_url, "terra_vino_svgs")


if __name__ == "__main__":
    main()