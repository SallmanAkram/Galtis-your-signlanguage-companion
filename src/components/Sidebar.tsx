import React from 'react';
import {
  X,
  Sparkles,
  Sliders,
  History,
  BookOpen,
  Volume2,
  Mic,
  Eye,
  Check,
  RefreshCw,
  Trash2,
  Layers,
  ChevronRight,
  Shield,
  Zap,
  Activity,
  Download,
} from 'lucide-react';
import { Companion, TranscriptItem, CameraViewMode, AppSettings } from '../types';
import { COMPANIONS } from '../data/aslDictionary';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentCompanion: Companion;
  onSelectCompanion: (companion: Companion) => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  transcriptHistory: TranscriptItem[];
  onReplayTranscript: (item: TranscriptItem) => void;
  onClearHistory: () => void;
  onOpenDictionary: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  currentCompanion,
  onSelectCompanion,
  settings,
  onUpdateSettings,
  transcriptHistory,
  onReplayTranscript,
  onClearHistory,
  onOpenDictionary,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Dimmed backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* iOS Frosted Glass Drawer */}
      <aside
        id="ios-sidebar-drawer"
        className="relative z-10 w-80 sm:w-96 max-w-[85vw] h-full bg-[#080b12]/92 backdrop-blur-2xl border-r border-white/10 flex flex-col shadow-2xl shadow-black overflow-hidden animate-in slide-in-from-left duration-300"
      >
        {/* Drawer Header */}
        <div className="px-5 pt-12 pb-4 flex items-center justify-between border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shadow-md"
              style={{
                backgroundColor: currentCompanion.accentColor,
                color: '#000',
              }}
            >
              <Sparkles className="w-4 h-4 fill-black" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold tracking-wider text-white uppercase">
                  SignBridge
                </h2>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 font-mono font-semibold">
                  Galtis 8
                </span>
              </div>
              <p className="text-[11px] text-white/50">StudioGalt MoCap Companion</p>
            </div>
          </div>

          <button
            onClick={onClose}
            id="btn-close-sidebar"
            aria-label="Close sidebar"
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Drawer Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 no-scrollbar">
          {/* 1. Companion Selectors */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-white/40">
                Galtis 3D Avatar Variants
              </span>
              <span className="text-[10px] text-white/40 font-mono">StudioGalt Rig</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {COMPANIONS.map((comp) => {
                const isSelected = comp.id === currentCompanion.id;
                return (
                  <button
                    key={comp.id}
                    id={`companion-select-${comp.id}`}
                    onClick={() => onSelectCompanion(comp)}
                    className={`p-3 rounded-2xl flex flex-col items-start text-left transition-all relative overflow-hidden border ${
                      isSelected
                        ? 'border-white/30 bg-white/10 shadow-lg'
                        : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15'
                    }`}
                  >
                    {/* Glowing highlight indicator */}
                    {isSelected && (
                      <div
                        className="absolute top-0 right-0 w-16 h-16 rounded-full blur-xl opacity-30 -mr-6 -mt-6 pointer-events-none"
                        style={{ backgroundColor: comp.accentColor }}
                      />
                    )}

                    <div className="w-full flex items-center justify-between mb-2">
                      <span className="text-xl">{comp.avatarIcon}</span>
                      {isSelected && (
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-black"
                          style={{ backgroundColor: comp.accentColor }}
                        >
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <span className="text-xs font-bold text-white tracking-wide">
                      {comp.name}
                    </span>
                    <span className="text-[10px] text-white/50 line-clamp-1">
                      {comp.tagline}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Companion Active Details Card */}
            <div className="mt-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-white/60 leading-relaxed">
              <span className="font-semibold text-white/80">{currentCompanion.name}:</span>{' '}
              {currentCompanion.lore}
            </div>
          </section>

          {/* 2. Sign Language & Stage Controls */}
          <section className="space-y-3">
            <span className="text-[11px] font-bold tracking-wider uppercase text-white/40 block mb-1">
              Signing Engine & Telemetry
            </span>

            {/* Speed Selector */}
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/80 font-medium">Interpreter Speed</span>
                <span className="text-xs font-mono text-white/90 font-bold">
                  {settings.signingSpeed}x
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[0.5, 1.0, 1.5, 2.0].map((s) => (
                  <button
                    key={s}
                    id={`speed-btn-${s}`}
                    onClick={() => onUpdateSettings({ signingSpeed: s })}
                    className={`py-1 rounded-lg text-xs font-mono font-medium transition ${
                      settings.signingSpeed === s
                        ? 'bg-white text-black font-bold shadow'
                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Camera View Angle */}
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/80 font-medium">Camera Angle</span>
                <span className="text-[10px] text-white/50 uppercase">{settings.viewMode}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                {[
                  { id: 'front', label: 'Front Portrait' },
                  { id: 'hands_closeup', label: 'Hands Closeup' },
                  { id: 'upper_body', label: 'Upper Torso' },
                  { id: 'stage_orbit', label: 'Stage View' },
                ].map((cam) => (
                  <button
                    key={cam.id}
                    id={`cam-btn-${cam.id}`}
                    onClick={() => onUpdateSettings({ viewMode: cam.id as CameraViewMode })}
                    className={`py-1.5 px-2 rounded-lg text-left transition truncate ${
                      settings.viewMode === cam.id
                        ? 'bg-white/20 text-white font-medium border border-white/20'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2 text-xs">
              {/* StudioGalt MoCap Telemetry HUD */}
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-teal-950/20 border border-teal-500/30 cursor-pointer hover:bg-teal-950/30 transition">
                <div>
                  <span className="text-teal-200 font-medium flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-teal-400" />
                    <span>MoCap .anim HUD</span>
                  </span>
                  <span className="text-[10px] text-white/40 block">Show bone coordinates & .anim exporter</span>
                </div>
                <input
                  type="checkbox"
                  id="toggle-hud"
                  checked={settings.showBoneCoordinatesHud}
                  onChange={(e) => onUpdateSettings({ showBoneCoordinatesHud: e.target.checked })}
                  className="w-4 h-4 accent-teal-400 rounded cursor-pointer"
                />
              </label>

              {/* Skeletal Joint Overlay */}
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.06] transition">
                <div>
                  <span className="text-white/90 font-medium block">Skeletal X-Ray Mesh</span>
                  <span className="text-[10px] text-white/40 block">Display optical joint tracking nodes</span>
                </div>
                <input
                  type="checkbox"
                  id="toggle-skeletal-joints"
                  checked={settings.showSkeletalJoints}
                  onChange={(e) => onUpdateSettings({ showSkeletalJoints: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                />
              </label>

              {/* Volumetric Mist */}
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.06] transition">
                <div>
                  <span className="text-white/90 font-medium block">Space Stage Mist</span>
                  <span className="text-[10px] text-white/40 block">Atmospheric floating mist particles</span>
                </div>
                <input
                  type="checkbox"
                  id="toggle-mist"
                  checked={settings.showMist}
                  onChange={(e) => onUpdateSettings({ showMist: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                />
              </label>

              {/* Subtitles / Captions */}
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.06] transition">
                <div>
                  <span className="text-white/90 font-medium block">Live Subtitles</span>
                  <span className="text-[10px] text-white/40 block">Display detected words overlay</span>
                </div>
                <input
                  type="checkbox"
                  id="toggle-captions"
                  checked={settings.showCaptions}
                  onChange={(e) => onUpdateSettings({ showCaptions: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                />
              </label>
            </div>
          </section>

          {/* 3. Open Sign Dictionary Explorer */}
          <section>
            <button
              onClick={() => {
                onClose();
                onOpenDictionary();
              }}
              id="btn-sidebar-dictionary"
              className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-teal-500/10 to-white/5 border border-teal-500/20 flex items-center justify-between text-left hover:bg-teal-500/20 active:scale-[0.98] transition group"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-black font-bold shadow-md"
                  style={{ backgroundColor: currentCompanion.accentColor }}
                >
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    StudioGalt MoCap Dictionary
                  </span>
                  <span className="text-[10px] text-white/50">
                    Browse 30+ signs, .anim files & A-Z
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white transition" />
            </button>
          </section>

          {/* 4. Speech Transcript History */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-white/40">
                Speech History
              </span>
              {transcriptHistory.length > 0 && (
                <button
                  onClick={onClearHistory}
                  id="btn-clear-history"
                  className="text-[10px] text-white/40 hover:text-rose-400 flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>

            {transcriptHistory.length === 0 ? (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-white/30 text-xs">
                No spoken words detected yet. Speak into mic or use quick prompts.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                {transcriptHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 hover:border-white/15 transition flex items-start justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-mono text-white/40">
                          {item.timestamp}
                        </span>
                        <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-white/10 text-white/60">
                          {item.source}
                        </span>
                      </div>
                      <p className="text-xs text-white/90 font-medium truncate">
                        "{item.text}"
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.signs.slice(0, 4).map((s, idx) => (
                          <span
                            key={idx}
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-mono"
                          >
                            {s}
                          </span>
                        ))}
                        {item.signs.length > 4 && (
                          <span className="text-[9px] text-white/40">
                            +{item.signs.length - 4}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onReplayTranscript(item)}
                      id={`btn-replay-${item.id}`}
                      title="Replay in Sign Language"
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition active:scale-95"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-white/10 bg-black/40 text-[10px] text-white/40 flex items-center justify-between">
          <span>SignBridge • StudioGalt Archive</span>
          <span className="text-teal-400/80 font-mono">Galtis 8 Rig</span>
        </div>
      </aside>
    </div>
  );
};
