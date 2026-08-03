'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './demo.module.css';

export default function DemoDashboard({ embedded = false }: { embedded?: boolean }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const interactionCleanupRef = useRef<(() => void) | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const fitFrameToDashboard = useCallback(() => {
    const frame = frameRef.current;
    const document = frame?.contentDocument;
    if (!frame || !document?.body || !document.documentElement) return;

    const syncHeight = () => {
      const nextHeight = Math.ceil(Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight,
      ));
      if (nextHeight > 0) frame.style.height = `${nextHeight}px`;
    };

    resizeObserverRef.current?.disconnect();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(document.body);
    observer.observe(document.documentElement);
    resizeObserverRef.current = observer;
    syncHeight();
    requestAnimationFrame(syncHeight);
  }, []);

  const handleLoad = useCallback(() => {
    fitFrameToDashboard();
    setIsLoaded(true);

    const document = frameRef.current?.contentDocument;
    if (!document) return;
    const preventDemoNavigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a, button') : null;
      if (target) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', preventDemoNavigation, true);
    interactionCleanupRef.current?.();
    interactionCleanupRef.current = () => document.removeEventListener('click', preventDemoNavigation, true);
  }, [fitFrameToDashboard]);

  useEffect(() => () => {
    resizeObserverRef.current?.disconnect();
    interactionCleanupRef.current?.();
  }, []);

  return (
    <div className={`${styles.demoSurface} ${styles.frameSurface} ${embedded ? styles.embedded : ''}`}>
      {!isLoaded && <div className={styles.frameLoading} role="status">Loading tournament dashboard…</div>}
      <iframe
        ref={frameRef}
        className={styles.dashboardFrame}
        src="/demo/dashboard?modal=1&sample=famous-frames-v1"
        title="The Famous Frames Invitational tournament dashboard"
        loading="lazy"
        onLoad={handleLoad}
        data-loaded={isLoaded}
      />
    </div>
  );
}
