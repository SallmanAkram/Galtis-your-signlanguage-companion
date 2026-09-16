import React, { useState, useRef } from 'react';

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

  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  const getMetrics = () => {
    if (!navRef.current) return null;
    const rect = navRef.current.getBoundingClientRect();
    const padding = embedded ? 4 : 8;
    const innerWidth = rect.width - padding * 2;
    const pillWidth = innerWidth / tabs.length;
    return { rect, padding, innerWidth, pillWidth };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const metrics = getMetrics();
    if (!metrics) return;
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const relativeX = e.clientX - metrics.rect.left - metrics.padding;
    const targetOffset = relativeX - metrics.pillWidth / 2;
    const clamped = Math.max(0, Math.min(metrics.innerWidth - metrics.pillWidth, targetOffset));
    setDragOffsetPx(clamped);

    const index = Math.max(0, Math.min(tabs.length - 1, Math.floor((relativeX / metrics.innerWidth) * tabs.length)));
    if (tabs[index] && tabs[index].id !== activeTab) {
      onChangeTab(tabs[index].id);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const metrics = getMetrics();
    if (!metrics) return;

    const relativeX = e.clientX - metrics.rect.left - metrics.padding;
    const targetOffset = relativeX - metrics.pillWidth / 2;
    const clamped = Math.max(0, Math.min(metrics.innerWidth - metrics.pillWidth, targetOffset));
    setDragOffsetPx(clamped);

    const index = Math.max(0, Math.min(tabs.length - 1, Math.floor((relativeX / metrics.innerWidth) * tabs.length)));
    if (tabs[index] && tabs[index].id !== activeTab) {
      onChangeTab(tabs[index].id);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      const metrics = getMetrics();
      if (metrics && dragOffsetPx !== null) {
        const finalIndex = Math.max(0, Math.min(tabs.length - 1, Math.round(dragOffsetPx / metrics.pillWidth)));
        if (tabs[finalIndex] && tabs[finalIndex].id !== activeTab) {
          onChangeTab(tabs[finalIndex].id);
        }
      }
    }
    setIsDragging(false);
    setDragOffsetPx(null);
  };

  if (embedded) {
    return (
      <nav
        ref={navRef}
        id="app-bottom-navbar"
        aria-label="Main Navigation"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative flex items-center justify-between w-full max-w-[340px] mx-auto select-none touch-none cursor-pointer ${
          activeTab
            ? 'p-1 rounded-full bg-white/[0.08] border border-white/18 backdrop-blur-md'
            : 'h-full px-1'
        } ${className}`}
      >
        {/* Animated Sliding Selection Pill */}
        {activeIndex !== -1 && (
          <div
            aria-hidden="true"
            className="absolute top-1 bottom-1 rounded-full bg-white/90 shadow-[0_2px_14px_rgba(255,255,255,0.25)] pointer-events-none z-0"
            style={{
              width: `calc((100% - 8px) / ${tabs.length})`,
              left: 4,
              transform:
                isDragging && dragOffsetPx !== null
                  ? `translateX(${dragOffsetPx}px)`
                  : `translateX(${activeIndex * 100}%)`,
              transition: isDragging
                ? 'none'
                : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
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
              onClick={(e) => {
                e.stopPropagation();
                if (activeTab === id) {
                  onChangeTab(null);
                } else {
                  onChangeTab(id);
                }
              }}
              className="relative z-10 flex h-10 flex-1 items-center justify-center rounded-full transition-colors duration-200 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white group"
            >
              <span
                role="img"
                aria-label={name}
                className={`w-[22px] h-[22px] transition-transform duration-200 ${
                  isActive ? 'scale-110 bg-purple-950' : 'scale-100 bg-white/70 group-hover:bg-white'
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
                }}
              />
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      ref={navRef}
      id="app-bottom-navbar"
      aria-label="Main Navigation"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative shrink-0 z-30 mx-auto flex h-16 w-[calc(100%-2rem)] max-w-[340px] items-center rounded-full border border-white/20 bg-white/10 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-xl select-none touch-none cursor-pointer ${className}`}
    >
      {/* Animated Sliding Selection Pill */}
      {activeIndex !== -1 && (
        <div
          aria-hidden="true"
          className="absolute top-2 bottom-2 rounded-full bg-white/90 shadow-[0_2px_14px_rgba(255,255,255,0.25)] pointer-events-none z-0"
          style={{
            width: `calc((100% - 16px) / ${tabs.length})`,
            left: 8,
            transform:
              isDragging && dragOffsetPx !== null
                ? `translateX(${dragOffsetPx}px)`
                : `translateX(${activeIndex * 100}%)`,
            transition: isDragging
              ? 'none'
              : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
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
            onClick={(e) => {
              e.stopPropagation();
              if (activeTab === id) {
                onChangeTab(null);
              } else {
                onChangeTab(id);
              }
            }}
            className="relative z-10 flex h-12 flex-1 items-center justify-center rounded-full transition-colors duration-200 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white group"
          >
            <span
              role="img"
              aria-label={name}
              className={`w-6 h-6 transition-transform duration-200 ${
                isActive ? 'scale-110 bg-purple-950' : 'scale-100 bg-white/70 group-hover:bg-white'
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
              }}
            />
          </button>
        );
      })}
    </nav>
  );
};
