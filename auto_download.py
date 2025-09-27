#!/usr/bin/env python3
"""
Автоматический загрузчик SVG из Figma
Версия с предустановленными параметрами для Terra-Vino дизайна
"""

import os
import sys
from figma_svg_downloader import FigmaSVGDownloader

def main():
    """Автоматическое скачивание SVG с минимальными настройками"""
    
    print("=== Автоматический загрузчик Terra-Vino SVG ===")
    print()
    
    # URL дизайна Terra-Vino (уже установлен)
    figma_url = "https://www.figma.com/design/IQgPIHYpGnotfOrtwPijJU/Terra-Vino?node-id=2035-4862&t=4mU0z4d1Yk6zYwRg-0"
    
    # Проверяем токен в переменных окружения
    access_token = os.getenv('FIGMA_ACCESS_TOKEN')
    
    if not access_token:
        print("🔑 Figma Access Token не найден в переменных окружения.")
        print("Вы можете:")
        print("1. Установить переменную окружения: export FIGMA_ACCESS_TOKEN='ваш_токен'")
        print("2. Ввести токен сейчас")
        print()
        access_token = input("Введите ваш Figma Access Token: ").strip()
    
    if not access_token:
        print("❌ Токен доступа обязателен для работы")
        sys.exit(1)
    
    print("🚀 Начинаем автоматическое скачивание...")
    print(f"📋 Дизайн: Terra-Vino")
    print(f"📂 Папка сохранения: terra_vino_svgs/")
    print()
    
    try:
        # Создаем загрузчик и запускаем скачивание
        downloader = FigmaSVGDownloader(access_token)
        downloader.download_all_svgs(figma_url, "terra_vino_svgs")
        
        print("\n🎉 Готово! Все SVG файлы скачаны.")
        print("📁 Проверьте папку 'terra_vino_svgs' в текущей директории.")
        
    except Exception as e:
        print(f"\n❌ Произошла ошибка: {e}")
        print("\n💡 Убедитесь что:")
        print("   - У вас есть доступ к дизайну Figma")
        print("   - Токен доступа корректный и активный")
        print("   - Есть подключение к интернету")

if __name__ == "__main__":
    main()