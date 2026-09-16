import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  UserPlus,
  ChevronRight,
  Moon,
  Zap,
  X,
  Activity,
  BookOpen,
} from 'lucide-react';
import { AppSettings, Companion, TranscriptItem } from '../types';

interface SettingsDrawerProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  currentCompanion: Companion;
  onSelectCompanion: (companion: Companion) => void;
  onOpenDictionary: () => void;
  onRequestWord?: (word: string) => void;
  transcriptHistory?: TranscriptItem[];
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onOpen,
  onClose,
  settings,
  onUpdateSettings,
  currentCompanion,
  onSelectCompanion,
  onOpenDictionary,
  onRequestWord,
  transcriptHistory = [],
}) => {
  // Friends state
  const [friends, setFriends] = useState([
    { id: '1', name: 'Friend 1', status: 'online', signsLearned: 24 },
    { id: '2', name: 'Friend 2', status: 'idle', signsLearned: 18 },
  ]);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [newFriendInput, setNewFriendInput] = useState('');

  // Other Settings
  const [highQualityAvatar, setHighQualityAvatar] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Request Words
  const [requestWordInput, setRequestWordInput] = useState('');
  const [requestFeedback, setRequestFeedback] = useState<string | null>(null);

  // Drag Gesture Handling
  const drawerRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  // Width of drawer in px: three quarters (72%) of screen, capped at 295px so handle stays cleanly on-screen
  const [drawerWidth, setDrawerWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      return Math.min(Math.round(window.innerWidth * 0.72), 295);
    }
    return 265;
  });

  useEffect(() => {
    const handleResize = () => {
      setDrawerWidth(Math.min(Math.round(window.innerWidth * 0.72), 295));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle pointer down on the pull tab or drawer edge
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    currentXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    currentXRef.current = e.clientX;
    const deltaX = currentXRef.current - startXRef.current;

    if (isOpen) {
      // Drawer is open (at 0px), dragging left gives negative offset
      const newOffset = Math.min(0, Math.max(-drawerWidth, deltaX));
      setDragOffset(newOffset);
    } else {
      // Drawer is closed (at -drawerWidth px), dragging right gives positive delta
      const newOffset = Math.max(-drawerWidth, Math.min(0, -drawerWidth + deltaX));
      setDragOffset(newOffset);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const deltaX = currentXRef.current - startXRef.current;

    // Check if it was a quick click/tap without significant drag
    if (Math.abs(deltaX) < 8) {
      if (isOpen) {
        onClose();
      } else {
        onOpen();
      }
      setDragOffset(null);
      return;
    }

    if (isOpen) {
      // If pulled left more than 70px, close
      if (deltaX < -70) {
        onClose();
      } else {
        onOpen();
      }
    } else {
      // If pulled right more than 60px, open
      if (deltaX > 60) {
        onOpen();
      } else {
        onClose();
      }
    }
    setDragOffset(null);
  };

  // Request word submission
  const handleSendWordRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestWordInput.trim()) return;
    const word = requestWordInput.trim().toUpperCase();
    if (onRequestWord) {
      onRequestWord(word);
    }
    setRequestFeedback(`"${word}" submitted! Galtis will demonstrate.`);
    setRequestWordInput('');
    setTimeout(() => setRequestFeedback(null), 3500);
  };

  // Calculate current translation transform
  let translateX = isOpen ? 0 : -drawerWidth;
  if (dragOffset !== null) {
    translateX = dragOffset;
  }

  // Calculate backdrop opacity
  const openFraction = (translateX + drawerWidth) / drawerWidth;

  return (
    <>
      {/* Dimmed backdrop when open or dragging */}
      {openFraction > 0.05 && (
        <div
          id="drawer-backdrop"
          onClick={onClose}
          style={{ opacity: openFraction * 0.65 }}
          className="fixed inset-0 z-40 bg-black backdrop-blur-[2px] transition-opacity duration-200"
        />
      )}

      {/* Main Drawer Container with Physical Protruding Handle */}
      <aside
        id="settings-side-menu"
        ref={drawerRef}
        style={{
          width: `${drawerWidth}px`,
          transform: `translateX(${translateX}px)`,
          transition: dragOffset !== null ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="fixed top-0 bottom-0 left-0 z-50 select-none touch-none"
      >
        {/* PHYSICAL PULL HANDLE TAB ATTACHED TO DRAWER'S RIGHT EDGE */}
        <div
          id="drawer-drag-handle-tab"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="button"
          tabIndex={0}
          aria-label={isOpen ? 'Close Settings drawer' : 'Open Settings drawer'}
          className="absolute top-[58%] -right-[32px] -translate-y-1/2 w-8 h-28 glass-handle-tab rounded-r-2xl flex items-center justify-center cursor-grab active:cursor-grabbing hover:brightness-110 active:brightness-95 transition-all z-50"
        >
          {/* Two vertical debossed lines (Grip indicator) */}
          <div className="flex items-center gap-[4px] pointer-events-none">
            <span className="w-[2.5px] h-10 bg-white/40 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
            <span className="w-[2.5px] h-10 bg-white/40 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
          </div>
        </div>

        {/* Clipped Inner Drawer Shell with Transparent Glassmorphism */}
        <div className="relative w-full h-full glass-panel text-white rounded-tr-[32px] rounded-br-2xl flex flex-col overflow-hidden">
          {/* Top Title: Fixed Header */}
          <div className="shrink-0 pt-7 pb-2 px-5 flex items-center justify-center border-b border-white/10 relative z-10">
            <h1 className="text-[24px] font-bold text-white tracking-tight text-center drop-shadow-sm">
              Settings
            </h1>
          </div>

          {/* Scroll Area Container with Top & Bottom Blur Fade Effect */}
          <div className="relative flex-1 min-h-0 w-full my-1.5 overflow-hidden z-10">
            {/* Top Fade Gradient Overlay */}
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 z-10 bg-gradient-to-b from-white/[0.08] via-transparent to-transparent" />

            {/* Scrollable Settings Content */}
            <div
              className="h-full overflow-y-auto px-5 py-3 space-y-6 no-scrollbar touch-pan-y"
              style={{
                maskImage: 'linear-gradient(to bottom, transparent 0px, black 22px, black calc(100% - 22px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 22px, black calc(100% - 22px), transparent 100%)',
              }}
            >
              {/* SECTION 1: FRIENDS (Account section deleted as requested) */}
              <div>
                <h2 className="text-[12px] font-bold text-white/70 tracking-wider mb-2 uppercase px-1">
                  Friends
                </h2>
                <div className="glass-subcard rounded-2xl p-2 space-y-1">
                  {friends.map((friend, idx) => (
                    <div
                      key={friend.id}
                      className={`flex items-center justify-between px-3 py-2.5 ${
                        idx !== friends.length - 1 ? 'border-b border-white/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-purple-200 stroke-[1.8]" />
                        <span className="text-[15px] font-medium text-white/90">{friend.name}</span>
                      </div>
                      {idx === 0 ? (
                        <span className="w-2.5 h-3.5 bg-emerald-400/80 rounded-xs shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-white/40" />
                      )}
                    </div>
                  ))}

                  {/* Add Friends Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      id="btn-add-friends"
                      onClick={() => setShowAddFriendModal(true)}
                      className="w-full py-2.5 px-4 bg-white/[0.14] hover:bg-white/[0.22] active:bg-white/[0.10] border border-white/20 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98"
                    >
                      <UserPlus className="w-4 h-4 text-purple-200" />
                      <span>Add Friends</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 2: OTHER */}
              <div>
                <h2 className="text-[12px] font-bold text-white/70 tracking-wider mb-2 uppercase px-1">
                  Other
                </h2>
                <div className="glass-subcard rounded-2xl overflow-hidden">
                  {/* Row 1: High quality avatar */}
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-xs border border-white/30 flex items-center justify-center text-[9px] font-bold text-white leading-none bg-white/[0.08]">
                        HQ
                      </div>
                      <span className="text-[15px] font-medium text-white/90">High quality avatar</span>
                    </div>
                    {/* Toggle */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={highQualityAvatar}
                        onChange={(e) => setHighQualityAvatar(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600/90 shadow-inner" />
                    </label>
                  </div>

                  {/* Row 2: Dark Mode */}
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <Moon className="w-5 h-5 text-purple-200 stroke-[1.8]" />
                      <span className="text-[15px] font-medium text-white/90">Dark Mode</span>
                    </div>
                    {/* Toggle */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={darkMode}
                        onChange={(e) => setDarkMode(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600/90 shadow-inner" />
                    </label>
                  </div>

                  {/* Row 3: Animation Speed */}
                  <div className="px-4 pt-3.5 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-purple-200 stroke-[1.8]" />
                        <span className="text-[15px] font-medium text-white/90">Animation Speed</span>
                      </div>
                      <span className="text-[15px] font-semibold text-white">
                        {settings.signingSpeed.toFixed(1)}x
                      </span>
                    </div>

                    {/* Slider Control */}
                    <div className="px-1">
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={settings.signingSpeed}
                        onChange={(e) => onUpdateSettings({ signingSpeed: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-400"
                      />
                      <div className="flex justify-between text-[10px] text-white/50 font-mono mt-1 px-0.5">
                        <span>0.5x</span>
                        <span>1.0x (Normal)</span>
                        <span>2.0x (Fast)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: REQUEST WORDS */}
              <div>
                <h2 className="text-[12px] font-bold text-white/70 tracking-wider mb-2 uppercase px-1">
                  Request Words
                </h2>
                <form
                  onSubmit={handleSendWordRequest}
                  className="glass-subcard rounded-2xl p-1.5 pl-3 flex items-center gap-2 overflow-hidden"
                >
                  <div className="text-white/60 shrink-0">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="w-4 h-4 stroke-[1.8]"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="9" y1="13" x2="15" y2="13" />
                      <line x1="12" y1="10" x2="12" y2="16" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={requestWordInput}
                    onChange={(e) => setRequestWordInput(e.target.value)}
                    placeholder="type here..."
                    className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-white placeholder-white/40 outline-none"
                  />
                  <button
                    type="submit"
                    id="btn-send-request-word"
                    className="shrink-0 bg-white/[0.16] hover:bg-white/[0.25] active:bg-white/[0.12] border border-white/20 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm"
                  >
                    Send
                  </button>
                </form>
                {requestFeedback && (
                  <p className="text-xs text-purple-200 bg-purple-900/40 border border-purple-400/30 rounded-lg p-2 mt-2">
                    {requestFeedback}
                  </p>
                )}
              </div>

              {/* SECTION 4: STUDIO GALT RIG & DICTIONARY FEATURES */}
              <div>
                <h2 className="text-[12px] font-bold text-white/70 tracking-wider mb-2 uppercase px-1">
                  Features & Dictionary
                </h2>
                <div className="glass-subcard rounded-2xl p-2 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenDictionary();
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left rounded-xl hover:bg-white/10 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="w-4 h-4 text-purple-300" />
                      <span className="text-sm font-medium text-white/90">
                        Open Full ASL & MoCap Dictionary
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/40" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSettings({
                        showBoneCoordinatesHud: !settings.showBoneCoordinatesHud,
                      });
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left rounded-xl hover:bg-white/10 transition border-t border-white/10"
                  >
                    <div className="flex items-center gap-2.5">
                      <Activity className="w-4 h-4 text-teal-300" />
                      <span className="text-sm font-medium text-white/90">
                        Live MoCap Skeleton HUD
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-white/70">
                      {settings.showBoneCoordinatesHud ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Fade Gradient Overlay */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 z-10 bg-gradient-to-t from-white/[0.08] via-transparent to-transparent" />
          </div>
        </div>
      </aside>

      {/* Add Friends Modal */}
      {showAddFriendModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-panel text-white rounded-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-200">
                <UserPlus className="w-5 h-5 text-purple-300" />
                <h3 className="font-bold text-white text-base">Add ASL Practice Friends</h3>
              </div>
              <button
                onClick={() => setShowAddFriendModal(false)}
                className="p-1 text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              Connect with friends or other signers to share practice lessons and compare signing
              scores.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter username or ID"
                value={newFriendInput}
                onChange={(e) => setNewFriendInput(e.target.value)}
                className="flex-1 text-sm bg-white/10 placeholder:text-white/40 text-white rounded-xl px-3 py-2 outline-none border border-white/20 focus:border-purple-400"
              />
              <button
                onClick={() => {
                  if (newFriendInput.trim()) {
                    setFriends((prev) => [
                      ...prev,
                      {
                        id: Date.now().toString(),
                        name: newFriendInput.trim(),
                        status: 'online',
                      },
                    ]);
                    setNewFriendInput('');
                    setShowAddFriendModal(false);
                  }
                }}
                className="px-4 py-2 bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-semibold rounded-xl transition-colors border border-purple-400/30 shadow-sm"
              >
                Add
              </button>
            </div>

            <div className="pt-2 border-t border-white/10">
              <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider block mb-2">
                Suggested Signers
              </span>
              <div className="space-y-1.5">
                {[
                  { name: 'Maya_ASL', streak: '14 days' },
                  { name: 'Alex_DeafEcho', streak: '7 days' },
                ].map((sug) => (
                  <div
                    key={sug.name}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-colors"
                  >
                    <span className="text-xs font-medium text-white/90">{sug.name}</span>
                    <button
                      onClick={() => {
                        setFriends((prev) => [
                          ...prev,
                          {
                            id: Date.now().toString(),
                            name: sug.name,
                            status: 'online',
                            signsLearned: 12,
                          },
                        ]);
                        setShowAddFriendModal(false);
                      }}
                      className="text-xs text-purple-300 font-semibold hover:text-purple-200 hover:underline"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
