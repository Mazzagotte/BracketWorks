'use client';

import React, { useState, useRef, useEffect } from 'react';

interface HoverPreviewProps {
  children: React.ReactNode;
  preview: React.ReactNode;
  delay?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export default function HoverPreview({
  children,
  preview,
  delay = 500,
  position = 'top',
  className = ''
}: HoverPreviewProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getPositionStyles = () => {
    const offset = 12;
    
    switch (position) {
      case 'top':
        return {
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: offset
        };
      case 'bottom':
        return {
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: offset
        };
      case 'left':
        return {
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginRight: offset
        };
      case 'right':
        return {
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: offset
        };
      default:
        return {
          top: mousePos.y - 40,
          left: mousePos.x + 10
        };
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {children}
      
      {isVisible && (
        <div
          className={`
            absolute z-50 px-3 py-2 text-sm
            bg-gray-900 text-white rounded-lg
            shadow-lg border border-gray-700
            pointer-events-none
            animate-fadeIn
            ${position === 'top' || position === 'bottom' ? 'whitespace-nowrap' : ''}
          `}
          style={getPositionStyles()}
        >
          {preview}
          
          {/* Tooltip Arrow */}
          <div
            className={`
              absolute w-2 h-2 bg-gray-900 border border-gray-700
              transform rotate-45
              ${position === 'top' && 'top-full left-1/2 -translate-x-1/2 -translate-y-1/2 border-t-0 border-l-0'}
              ${position === 'bottom' && 'bottom-full left-1/2 -translate-x-1/2 translate-y-1/2 border-b-0 border-r-0'}
              ${position === 'left' && 'left-full top-1/2 -translate-x-1/2 -translate-y-1/2 border-l-0 border-b-0'}
              ${position === 'right' && 'right-full top-1/2 translate-x-1/2 -translate-y-1/2 border-r-0 border-t-0'}
            `}
          />
        </div>
      )}
    </div>
  );
}