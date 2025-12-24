# Collection Workspace Module

## Описание

Модуль Collection предоставляет функционал для работы с коллекциями треков. Коллекции похожи на плейлисты, но могут иметь динамические ID и поддерживают экспорт в различные форматы.

## Зависимости

### Core
- `@core/types/workspace` - WorkspaceId, WorkspaceType
- `@core/types/track` - Track

### Shared
- `@shared/stores/trackWorkspaceStoreFactory` - создание store для коллекции
- `@shared/stores/demoPlayerStore` - управление воспроизведением
- `@shared/stores/uiStore` - уведомления
- `@shared/services/exportService` - экспорт коллекций
- `@shared/services/fileService` - работа с файлами
- `@shared/services/ipcService` - IPC коммуникация
- `@shared/services/playlistService` - сохранение/загрузка плейлистов
- `@shared/hooks/useTrackWorkspaceDragAndDrop` - drag-and-drop
- `@shared/hooks/useTrackDuration` - загрузка длительности треков
- `@shared/components/PlaylistItem` - компонент элемента коллекции
- `@shared/utils` - утилиты (formatDuration, logger)

## Функциональность

### Основные возможности

1. **Управление треками**
   - Добавление треков (drag-and-drop, файлы, папки)
   - Удаление треков
   - Перемещение треков внутри коллекции
   - Выделение треков (одиночное, множественное, диапазон)

2. **Воспроизведение**
   - Воспроизведение треков
   - Пауза
   - Отображение активного трека

3. **Экспорт**
   - Экспорт в JSON формат
   - Копирование треков в папку
   - Меню экспорта с выбором формата

4. **Редактирование**
   - Изменение названия коллекции
   - Undo/Redo операций
   - История изменений (глубина 50 операций)

5. **Drag-and-Drop**
   - Перемещение треков внутри коллекции
   - Перемещение треков между workspace
   - Копирование треков (Ctrl+drag)
   - Добавление файлов и папок

### Особенности реализации

- Использует `ensureTrackWorkspaceStore()` для создания/получения store
- Каждая коллекция имеет свой уникальный store
- Поддерживает неограниченное количество треков (`maxTracks: null`)
- История операций с глубиной 50

## Использование

Модуль используется автоматически через `WorkspaceRenderer` для workspace с типом `'collection'`. Реестр находит модуль по типу, так как ID коллекций динамические.
