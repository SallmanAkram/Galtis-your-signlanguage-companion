import React, { useState, useRef, useCallback } from 'react';

export type ActiveTab = 'play' | 'dictionary' | 'skins' | 'ai';
export interface BottomNavBarProps {
  activeTab: ActiveTab | null;
  onChangeTab: (tab: ActiveTab | null) => void;
  embedded?: boolean;
  className?: string;
}

const tabs = [
  { id: 'play', label: 'Avatar Stage View', iconSrc: '/icons/play_no_bg.png', name: 'play_no_bg' },
  { id: 'dictionary', label: 'Search ASL Dictionary', iconSrc: '/icons/dictionary.png', name: 'dictionary' },
  { id: 'skins', label: 'Avatar Skins', iconSrc: '/icons/skins.png', name: 'skins' },
  { id: 'ai', label: 'AI Sign Detection & Training', iconSrc: '/icons/train.png', name: 'train' },
] as const;

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onChangeTab,
  embedded = false,
  className = '',
}) => {
  const navRef = useRef<HTMLElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetPx, setDragOffsetPx] = useState<number | null>(null);

  // Gesture tracking refs to eliminate Android tap conflicts and touch delays
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef<boolean>(false);
  const dragHandledRef = useRef<boolean>(false);

  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  const getMetrics = useCallback(() => {
    if (!navRef.current) return null;
    const rect = navRef.current.getBoundingClientRect();
    const padding = embedded ? 4 : 8;
    const innerWidth = rect.width - padding * 2;
    const pillWidth = innerWidth / tabs.length;
    return { rect, padding, innerWidth, pillWidth };
  }, [embedded]);

  // Haptic feedback for Android devices
  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle primary touch/click
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    touchStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasMovedRef.current = false;
    dragHandledRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!touchStartPosRef.current) return;

    const deltaX = e.clientX - touchStartPosRef.current.x;
    const deltaY = e.clientY - touchStartPosRef.current.y;

    // Movement threshold for drag activation: 8px horizontal with horizontal dominance
    if (!hasMovedRef.current && Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
      hasMovedRef.current = true;
      setIsDragging(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
    }

    if (hasMovedRef.current) {
      const metrics = getMetrics();
      if (!metrics) return;

      const relativeX = e.clientX - metrics.rect.left - metrics.padding;
      const targetOffset = relativeX - metrics.pillWidth / 2;
      const clamped = Math.max(0, Math.min(metrics.innerWidth - metrics.pillWidth, targetOffset));
      setDragOffsetPx(clamped);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (hasMovedRef.current) {
      dragHandledRef.current = true;
      const metrics = getMetrics();
      if (metrics && dragOffsetPx !== null) {
        const finalIndex = Math.max(
          0,
          Math.min(tabs.length - 1, Math.round(dragOffsetPx / metrics.pillWidth))
        );
        if (tabs[finalIndex]) {
          triggerHaptic();
          onChangeTab(tabs[finalIndex].id);
        }
      }
    }

    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}

    touchStartPosRef.current = null;
    hasMovedRef.current = false;
    setIsDragging(false);
    setDragOffsetPx(null);
  };

  const handlePointerCancel = () => {
    touchStartPosRef.current = null;
    hasMovedRef.current = false;
    setIsDragging(false);
    setDragOffsetPx(null);
  };

  // Clean tap handler for button tabs that works 100% reliably across Android and iOS
  const handleTabClick = (id: ActiveTab, e: React.MouseEvent) => {
    e.stopPropagation();

    // If this click was part of a drag gesture, ignore click
    if (dragHandledRef.current) {
      dragHandledRef.current = false;
      return;
    }

    triggerHaptic();

    if (activeTab === id) {
      onChangeTab(null);
    } else {
      onChangeTab(id);
    }
  };

  const padding = embedded ? 4 : 8;

  return (
    <nav
      ref={navRef}
      id="app-bottom-navbar"
      aria-label="Main Navigation"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`relative shrink-0 select-none cursor-pointer ${
        embedded
          ? `flex items-center justify-between w-full max-w-[340px] mx-auto ${
              activeTab
                ? 'p-1 rounded-full bg-white/[0.08] border border-white/18 backdrop-blur-md'
                : 'h-full px-1'
            }`
          : 'z-30 mx-auto flex h-16 w-[calc(100%-2rem)] max-w-[340px] items-center rounded-full border border-white/20 bg-white/10 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-xl'
      } ${className}`}
      style={{
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {/* Hardware-accelerated sliding selection pill (GPU optimized for Android 60/120fps) */}
      {activeIndex !== -1 && (
        <div
          aria-hidden="true"
          className="absolute rounded-full bg-white/90 shadow-[0_2px_14px_rgba(255,255,255,0.25)] pointer-events-none z-0"
          style={{
            top: padding,
            bottom: padding,
            left: padding,
            width: `calc((100% - ${padding * 2}px) / ${tabs.length})`,
            transform:
              isDragging && dragOffsetPx !== null
                ? `translate3d(${dragOffsetPx}px, 0, 0)`
                : `translate3d(${activeIndex * 100}%, 0, 0)`,
            transition: isDragging
              ? 'none'
              : 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        />
      )}

      {tabs.map(({ id, label, iconSrc, name }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            id={`nav-tab-${id}`}
            type="button"
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            onClick={(e) => handleTabClick(id, e)}
            className={`relative z-10 flex flex-1 items-center justify-center rounded-full transition-transform duration-150 active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white group ${
              embedded ? 'h-10 min-h-[40px]' : 'h-12 min-h-[48px]'
            }`}
            style={{
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              outline: 'none',
            }}
          >
            <span
              role="img"
              aria-label={name}
              className={`transition-all duration-200 pointer-events-none ${
                embedded ? 'w-[22px] h-[22px]' : 'w-6 h-6'
              } ${
                isActive
                  ? 'scale-110 bg-purple-950 opacity-100'
                  : 'scale-100 bg-white/75 group-hover:bg-white opacity-85 group-hover:opacity-100'
              }`}
              style={{
                display: 'inline-block',
                WebkitMaskImage: `url(${iconSrc})`,
                maskImage: `url(${iconSrc})`,
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
                transform: 'translateZ(0)',
                willChange: 'transform, opacity',
              }}
            />
          </button>
        );
      })}
    </nav>
  );
};
