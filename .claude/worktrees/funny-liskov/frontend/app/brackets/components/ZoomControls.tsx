import React from 'react';
import styles from '../styles/zoom-controls.module.css';

export interface ZoomControlsProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onPanChange?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  minZoom?: number;
  maxZoom?: number;
  showMinimap?: boolean;
}

export function ZoomControls({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onPanChange,
  minZoom = 50,
  maxZoom = 200,
  showMinimap = false,
}: ZoomControlsProps) {
  const isMinZoom = zoomLevel <= minZoom;
  const isMaxZoom = zoomLevel >= maxZoom;

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.zoomGroup}>
          <button
            onClick={onZoomOut}
            disabled={isMinZoom}
            className={styles.controlButton}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <span className={styles.icon}>−</span>
          </button>

          <div className={styles.zoomIndicator}>
            <span className={styles.zoomValue}>{zoomLevel}%</span>
          </div>

          <button
            onClick={onZoomIn}
            disabled={isMaxZoom}
            className={styles.controlButton}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <span className={styles.icon}>+</span>
          </button>
        </div>

        {zoomLevel !== 100 && (
          <button
            onClick={onResetZoom}
            className={styles.resetButton}
            aria-label="Reset zoom"
            title="Reset to 100%"
          >
            <span className={styles.resetIcon}>⟲</span>
            <span>Reset</span>
          </button>
        )}

        {onPanChange && (
          <div className={styles.panGroup}>
            <div className={styles.panControls}>
              <button
                onClick={() => onPanChange('up')}
                className={styles.panButton}
                aria-label="Pan up"
                title="Pan up"
              >
                ▲
              </button>
              <div className={styles.panMiddle}>
                <button
                  onClick={() => onPanChange('left')}
                  className={styles.panButton}
                  aria-label="Pan left"
                  title="Pan left"
                >
                  ◀
                </button>
                <div className={styles.panCenter}>⊕</div>
                <button
                  onClick={() => onPanChange('right')}
                  className={styles.panButton}
                  aria-label="Pan right"
                  title="Pan right"
                >
                  ▶
                </button>
              </div>
              <button
                onClick={() => onPanChange('down')}
                className={styles.panButton}
                aria-label="Pan down"
                title="Pan down"
              >
                ▼
              </button>
            </div>
          </div>
        )}
      </div>

      {showMinimap && (
        <div className={styles.minimap}>
          <div className={styles.minimapLabel}>Overview</div>
          <div className={styles.minimapCanvas}>
            <div className={styles.minimapViewport} />
          </div>
        </div>
      )}
    </div>
  );
}
