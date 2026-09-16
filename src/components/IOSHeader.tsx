import React from 'react';
import { Menu, BookOpen, Eye, Sliders, Volume2, Sparkles, Mic } from 'lucide-react';
import { Companion, CameraViewMode } from '../types';

interface IOSHeaderProps {
  companion: Companion;
  isListening: boolean;
  onOpenSidebar: () => void;
  onOpenDictionary: () => void;
  speed: number;
  onChangeSpeed: () => void;
  viewMode: CameraViewMode;
  onChangeViewMode: () => void;
  currentSignName: string | null;
}

export const IOSHeader: React.FC<IOSHeaderProps> = ({
  companion,
  isListening,
  onOpenSidebar,
  onOpenDictionary,
  speed,
  onChangeSpeed,
  viewMode,
  onChangeViewMode,
  currentSignName,
}) => {
  return (
    <header className="absolute top-0 left-0 right-0 z-30 flex flex-col pointer-events-none select-none">
      {/* iOS Top Status Bar */}
      <div className="w-full flex items-center justify-between px-6 pt-3 pb-1 text-xs font-semibold tracking-tight text-white/70">
        <span className="font-medium text-[13px] text-white/90">9:41</span>

        {/* iOS Dynamic Island with Live Sign / Mic Activity */}
        <div className="pointer-events-auto flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/90 border border-white/10 shadow-lg shadow-black/80 transition-all duration-300">
          <div className="relative flex items-center justify-center">
            {isListening ? (
              <span className="relative flex h-2 w-2">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: companion.accentColor }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ backgroundColor: companion.accentColor }}
                />
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-white/20" />
            )}
          </div>

          <span className="text-[11px] font-medium tracking-wide text-white/80">
            {currentSignName ? (
              <span className="text-white font-bold flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" style={{ color: companion.accentColor }} />
                SIGN: {currentSignName}
              </span>
            ) : isListening ? (
              'LISTENING...'
            ) : (
              'STANDBY'
            )}
          </span>
        </div>

        {/* Battery / Wifi icons */}
        <div className="flex items-center gap-1.5 text-white/80">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4z" />
          </svg>
          <div className="w-5 h-2.5 border border-white/60 rounded-xs p-0.5 flex items-center">
            <div className="h-full w-3.5 bg-white/90 rounded-2xs" />
          </div>
        </div>
      </div>

      {/* Grok Companion Top Navigation Bar */}
      <div className="w-full flex items-center justify-between px-4 py-2 pointer-events-auto">
        {/* Left: Sidebar Menu Toggle */}
        <button
          onClick={onOpenSidebar}
          id="btn-open-sidebar"
          aria-label="Open sidebar menu"
          className="w-10 h-10 rounded-full ios-glass flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 active:scale-95 transition"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Center: Companion Title Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full ios-glass border border-white/10 shadow-md">
          <div
            className="w-2 h-2 rounded-full shadow-sm"
            style={{
              backgroundColor: companion.accentColor,
              boxShadow: `0 0 10px ${companion.accentColor}`,
            }}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold tracking-wider text-white">
              SignBridge
            </span>
            <span className="text-[10px] text-teal-300 font-mono font-semibold">
              {companion.name}
            </span>
          </div>
        </div>

        {/* Right: Quick Tool Controls */}
        <div className="flex items-center gap-1.5">
          {/* Camera View Angle Preset */}
          <button
            onClick={onChangeViewMode}
            id="btn-camera-view"
            title={`Current View: ${viewMode}`}
            className="w-9 h-9 rounded-full ios-glass flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Speed Toggle */}
          <button
            onClick={onChangeSpeed}
            id="btn-speed-toggle"
            title="Signing Speed"
            className="px-2.5 h-9 rounded-full ios-glass text-[11px] font-mono font-semibold text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition flex items-center justify-center"
          >
            {speed}x
          </button>

          {/* Sign Glossary / Dictionary */}
          <button
            onClick={onOpenDictionary}
            id="btn-open-dictionary"
            title="ASL Sign Dictionary"
            className="w-9 h-9 rounded-full ios-glass flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
