import CloseIcon from '@mui/icons-material/Close';
import React, { useState, useEffect, useRef } from 'react';

import { usePlayerSettingsStore, ActionAfterTrack } from '@shared/stores/playerSettingsStore';
import { useUIStore } from '@shared/stores/uiStore';

export const TrackSettingsModal: React.FC = () => {
  const { closeModal, addNotification } = useUIStore();
  const {
    defaultPauseBetweenTracks,
    defaultActionAfterTrack,
    setDefaultPauseBetweenTracks,
    setDefaultActionAfterTrack,
    getTrackSettings,
    setTrackSettings,
    getGroupSettings,
    setGroupSettings,
    editingTrackId,
    editingGroupId,
    editingIsGlobal,
  } = usePlayerSettingsStore();

  const trackId = editingTrackId;
  const groupId = editingGroupId;
  const isGlobal = editingIsGlobal;

  // Определяем тип настройки
  const settingsType = isGlobal ? 'global' : groupId ? 'group' : 'track';
  const currentSettings = isGlobal
    ? { pauseBetweenTracks: defaultPauseBetweenTracks, actionAfterTrack: defaultActionAfterTrack }
    : groupId
      ? getGroupSettings(groupId)
      : trackId
        ? getTrackSettings(trackId)
        : {};

  const [localActionAfterTrack, setLocalActionAfterTrack] = useState<ActionAfterTrack | 'default'>(
    currentSettings.actionAfterTrack || 'default',
  );
  const [localPauseBetweenTracks, setLocalPauseBetweenTracks] = useState<number>(
    currentSettings.pauseBetweenTracks ?? defaultPauseBetweenTracks,
  );

  const prevModalRef = useRef<string | null>(null);
  const modal = useUIStore((state) => state.modal);

  // Синхронизируем локальные значения при открытии модального окна
  useEffect(() => {
    if (modal === 'trackSettings' && prevModalRef.current !== 'trackSettings') {
      const timeoutId = setTimeout(() => {
        const settings = isGlobal
          ? { pauseBetweenTracks: defaultPauseBetweenTracks, actionAfterTrack: defaultActionAfterTrack }
          : groupId
            ? getGroupSettings(groupId)
            : trackId
              ? getTrackSettings(trackId)
              : {};
        setLocalActionAfterTrack(settings.actionAfterTrack || 'default');
        setLocalPauseBetweenTracks(settings.pauseBetweenTracks ?? defaultPauseBetweenTracks);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    prevModalRef.current = modal;
  }, [modal, isGlobal, trackId, groupId, defaultPauseBetweenTracks, defaultActionAfterTrack, getTrackSettings, getGroupSettings]);

  if (modal !== 'trackSettings') {
    return null;
  }

  const handleSave = () => {
    if (isGlobal) {
      setDefaultActionAfterTrack(
        localActionAfterTrack === 'default' ? defaultActionAfterTrack : localActionAfterTrack,
      );
      setDefaultPauseBetweenTracks(localPauseBetweenTracks);
    } else if (groupId) {
      setGroupSettings(groupId, {
        actionAfterTrack: localActionAfterTrack === 'default' ? null : localActionAfterTrack,
        pauseBetweenTracks:
          localPauseBetweenTracks === defaultPauseBetweenTracks ? null : localPauseBetweenTracks,
      });
    } else if (trackId) {
      setTrackSettings(trackId, {
        actionAfterTrack: localActionAfterTrack === 'default' ? null : localActionAfterTrack,
        pauseBetweenTracks:
          localPauseBetweenTracks === defaultPauseBetweenTracks ? null : localPauseBetweenTracks,
      });
    }

    addNotification({ type: 'success', message: 'Настройки сохранены' });
    closeModal();
  };

  const handleCancel = () => {
    closeModal();
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  };

  const handleOverlayKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    }
  };

  const getTitle = () => {
    if (isGlobal) return 'Глобальные настройки';
    if (groupId) return 'Настройки группы';
    return 'Настройки трека';
  };

  const showPauseInput = localActionAfterTrack === 'pauseAndNext';

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Close track settings modal"
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">{getTitle()}</h2>
          <button className="modal-close" onClick={handleCancel}>
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <div className="settings-group">
            <label className="settings-label" htmlFor="track-settings-action">
              Действие после трека
            </label>
            <select
              className="settings-select"
              value={localActionAfterTrack}
              onChange={(e) =>
                setLocalActionAfterTrack(e.target.value as ActionAfterTrack | 'default')
              }
              id="track-settings-action"
            >
              <option value="default">
                По умолчанию ({defaultActionAfterTrack === 'next' ? 'Сплошное воспроизведение' : defaultActionAfterTrack === 'pauseAndNext' ? 'Пауза между треками' : 'Пауза после трека'})
              </option>
              <option value="next">Сплошное воспроизведение</option>
              <option value="pauseAndNext">Пауза между треками</option>
              <option value="pause">Пауза после трека</option>
            </select>
          </div>

          {showPauseInput && (
            <div className="settings-group">
              <label className="settings-label" htmlFor="track-settings-pause">
                Пауза между треками (секунды)
              </label>
              <input
                type="number"
                className="settings-input"
                value={localPauseBetweenTracks}
                onChange={(e) => setLocalPauseBetweenTracks(Number(e.target.value) || 0)}
                id="track-settings-pause"
                min="0"
                step="1"
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-button secondary" onClick={handleCancel}>
            Отмена
          </button>
          <button className="modal-button primary" onClick={handleSave}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

