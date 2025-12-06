# Build Resources

Эта папка содержит ресурсы для сборки релизной версии приложения.

## Иконки

Для сборки дистрибутива необходимы следующие иконки:

### Windows

- **icon.ico** - Иконка для Windows (рекомендуемый размер: 256x256 или 512x512, с несколькими размерами внутри)

### macOS

- **icon.icns** - Иконка для macOS (рекомендуемый размер: 512x512 или 1024x1024)

### Linux

- **icon.png** - Иконка для Linux (рекомендуемый размер: 512x512)

## Генерация иконок

### Из одного PNG файла

1. Создайте PNG файл 1024x1024 пикселей с прозрачностью
2. Используйте онлайн-сервисы или инструменты:
   - **Windows (.ico)**: [ICO Convert](https://icoconvert.com/) или `ImageMagick`
   - **macOS (.icns)**: Используйте `iconutil` на macOS или онлайн-конвертеры
   - **Linux (.png)**: Просто используйте PNG файл

### Используя ImageMagick (для Windows .ico)

```bash
# Установите ImageMagick
# Затем выполните:
magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

### Используя iconutil (для macOS .icns)

```bash
# Создайте папку iconset
mkdir icon.iconset

# Создайте все необходимые размеры
sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png

# Создайте .icns файл
iconutil -c icns icon.iconset -o icon.icns
```

## Дополнительные файлы (опционально)

### installer.nsh (для Windows NSIS)

Можно создать кастомный NSIS скрипт для установщика Windows.

### entitlements.mac.plist (для macOS)

Файл с правами доступа для macOS приложения (необходим для подписи).

## Временное решение

Если иконки отсутствуют, electron-builder создаст приложение с дефолтной иконкой Electron.
Однако рекомендуется добавить собственные иконки перед релизом.
