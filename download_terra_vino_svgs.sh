#!/bin/bash

# Terra-Vino SVG Downloader
# Скрипт для автоматического скачивания всех SVG из дизайна Figma

echo "=== Terra-Vino SVG Downloader ==="
echo

# Проверяем наличие Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 не найден. Установите Python3 для продолжения."
    exit 1
fi

# Проверяем наличие pip
if ! command -v pip3 &> /dev/null && ! command -v pip &> /dev/null; then
    echo "❌ pip не найден. Установите pip для продолжения."
    exit 1
fi

# Устанавливаем зависимости
echo "📦 Устанавливаем зависимости..."
pip3 install -r requirements.txt || pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "❌ Ошибка установки зависимостей"
    exit 1
fi

echo "✅ Зависимости установлены"
echo

# Запускаем скрипт
echo "🚀 Запускаем загрузчик..."
python3 auto_download.py || python auto_download.py

echo
echo "🏁 Скрипт завершен"