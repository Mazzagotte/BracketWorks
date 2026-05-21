"use client";

import { type ReactNode, useEffect, useState } from "react";

interface DelayedRouteFallbackProps {
  children: ReactNode;
  delayMs?: number;
}

export function DelayedRouteFallback({ children, delayMs = 650 }: DelayedRouteFallbackProps) {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowFallback(true);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delayMs]);

  if (!showFallback) {
    return null;
  }

  return <>{children}</>;
}
