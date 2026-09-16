import React, { useState } from 'react';
import {
  Activity,
  Download,
  FileCode,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  Maximize2,
  Minimize2,
  Copy,
  Check,
} from 'lucide-react';
import { Companion, StudioGaltWordEntry } from '../types';
import { LiveMocapCoordinates } from './CharacterRig';
import { downloadAnimCoordinateFile, generateAnimFileContent } from '../data/studioGaltDictionary';

interface LiveCoordinateHudProps {
  isOpen: boolean;
  onClose: () => void;
  companion: Companion;
  coordinates: LiveMocapCoordinates | null;
  activeStudioGaltWord?: StudioGaltWordEntry | null;
  onSelectKeypose?: (poseIdx: number) => void;
  activeKeyposeIdx?: number;
}

export const LiveCoordinateHud: React.FC<LiveCoordinateHudProps> = ({
  isOpen,
  onClose,
  companion,
  coordinates,
  activeStudioGaltWord,
  onSelectKeypose,
  activeKeyposeIdx = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedBone, setSelectedBone] = useState<string>('bicepfk_R');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'coordinates' | 'facs' | 'anim_raw'>('coordinates');

  if (!isOpen) return null;

  const bones = coordinates?.bones || {};
  const boneKeys = Object.keys(bones);
  const currentBoneData = bones[selectedBone] || bones['bicepfk_R'];

  const handleCopyRawAnim = () => {
    if (!activeStudioGaltWord) return;
    const animText = generateAnimFileContent(activeStudioGaltWord);
    navigator.clipboard.writeText(animText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      id="live-mocap-coordinate-hud"
      className={`fixed right-4 bottom-24 z-40 bg-[#070a13]/95 border border-white/20 rounded-2xl shadow-2xl backdrop-blur-2xl transition-all duration-300 text-white select-none ${
        isExpanded ? 'w-[420px] max-h-[70vh]' : 'w-[360px] max-h-[380px]'
      } flex flex-col overflow-hidden animate-in slide-in-from-right-4`}
      style={{
        boxShadow: `0 12px 40px -10px ${companion.accentColor}33`,
      }}
    >
      {/* HUD Header */}
      <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: companion.accentColor }}
          />
          <div>
            <h4 className="text-xs font-bold tracking-wider uppercase text-white flex items-center gap-1.5">
              <span>StudioGalt MoCap Telemetry</span>
            </h4>
            <div className="flex items-center gap-2 text-[10px] text-white/50 font-mono">
              <span>60 FPS</span>
              <span>•</span>
              <span className="text-teal-300">Galtis 8 Skeleton</span>
              <span>•</span>
              <span>Frame #{coordinates?.frame || 1}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            id="btn-hud-expand"
            title={isExpanded ? 'Collapse HUD' : 'Expand HUD'}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            id="btn-hud-close"
            aria-label="Close telemetry HUD"
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active Motion Metadata Strip */}
      <div className="px-3.5 py-1.5 bg-black/40 border-b border-white/5 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-white/40 font-mono">ACTIVE:</span>
          <span className="font-bold text-white uppercase truncate">
            {coordinates?.signName || 'IDLE'}
          </span>
        </div>
        {activeStudioGaltWord && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => downloadAnimCoordinateFile(activeStudioGaltWord, 'anim')}
              id="btn-download-anim-quick"
              title="Download .anim file for Unity/Blender"
              className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 text-[10px] font-mono font-medium flex items-center gap-1 transition"
            >
              <Download className="w-2.5 h-2.5" />
              .anim
            </button>
            <button
              onClick={() => downloadAnimCoordinateFile(activeStudioGaltWord, 'json')}
              id="btn-download-json-quick"
              title="Download Raw MoCap JSON"
              className="px-2 py-0.5 rounded bg-white/10 text-white/80 hover:bg-white/20 text-[10px] font-mono font-medium flex items-center gap-1 transition"
            >
              .json
            </button>
          </div>
        )}
      </div>

      {/* Keypose Stepper / Scrubbing Controls (if StudioGalt word has multiple poses) */}
      {activeStudioGaltWord && activeStudioGaltWord.keyposes.length > 1 && onSelectKeypose && (
        <div className="px-3.5 py-2 bg-white/[0.02] border-b border-white/5 flex items-center justify-between text-xs">
          <span className="text-[11px] text-white/60 font-mono">
            Keypose Frame:
          </span>
          <div className="flex items-center gap-1">
            {activeStudioGaltWord.keyposes.map((kp, idx) => (
              <button
                key={kp.poseId}
                onClick={() => onSelectKeypose(idx)}
                id={`btn-select-keypose-${idx}`}
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold transition ${
                  activeKeyposeIdx === idx
                    ? 'bg-teal-400 text-black shadow-sm'
                    : 'bg-white/5 text-white/60 hover:bg-white/15'
                }`}
              >
                {kp.poseId} (F{kp.frame})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex border-b border-white/10 text-[11px] font-medium bg-black/20">
        <button
          onClick={() => setActiveTab('coordinates')}
          id="hud-tab-coordinates"
          className={`flex-1 py-1.5 text-center transition ${
            activeTab === 'coordinates'
              ? 'border-b-2 text-white font-semibold'
              : 'text-white/50 hover:text-white'
          }`}
          style={{
            borderColor: activeTab === 'coordinates' ? companion.accentColor : 'transparent',
          }}
        >
          Bone Coordinates
        </button>
        <button
          onClick={() => setActiveTab('facs')}
          id="hud-tab-facs"
          className={`flex-1 py-1.5 text-center transition ${
            activeTab === 'facs'
              ? 'border-b-2 text-white font-semibold'
              : 'text-white/50 hover:text-white'
          }`}
          style={{
            borderColor: activeTab === 'facs' ? companion.accentColor : 'transparent',
          }}
        >
          FACS Blendshapes
        </button>
        <button
          onClick={() => setActiveTab('anim_raw')}
          id="hud-tab-raw"
          className={`flex-1 py-1.5 text-center transition ${
            activeTab === 'anim_raw'
              ? 'border-b-2 text-white font-semibold'
              : 'text-white/50 hover:text-white'
          }`}
          style={{
            borderColor: activeTab === 'anim_raw' ? companion.accentColor : 'transparent',
          }}
        >
          Raw .anim Track
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2.5">
        {activeTab === 'coordinates' && (
          <>
            {/* Bone Selector Pills */}
            <div>
              <div className="text-[10px] uppercase font-mono text-white/40 mb-1">
                Select Bone Joint:
              </div>
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {boneKeys.map((bName) => (
                  <button
                    key={bName}
                    onClick={() => setSelectedBone(bName)}
                    id={`btn-bone-select-${bName}`}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap transition ${
                      selectedBone === bName
                        ? 'bg-teal-500/30 text-teal-200 border border-teal-500/50'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {bName}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Bone Telemetry Card */}
            {currentBoneData && (
              <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-teal-300 font-semibold text-[11px]">
                  <span>{selectedBone}</span>
                  <span className="text-[9px] text-white/40">StudioGalt Rig v8</span>
                </div>

                {/* Quaternion [w, x, y, z] */}
                <div className="space-y-1">
                  <div className="text-[10px] text-white/50 flex items-center justify-between">
                    <span>Quaternion (W, X, Y, Z)</span>
                    <span className="text-[9px] text-white/30">Unit Rotation</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                    <div className="p-1 rounded bg-white/5">
                      <span className="text-white/40 block text-[8px]">W</span>
                      <span className="text-emerald-300">{currentBoneData.quaternion[0]}</span>
                    </div>
                    <div className="p-1 rounded bg-white/5">
                      <span className="text-white/40 block text-[8px]">X</span>
                      <span className="text-sky-300">{currentBoneData.quaternion[1]}</span>
                    </div>
                    <div className="p-1 rounded bg-white/5">
                      <span className="text-white/40 block text-[8px]">Y</span>
                      <span className="text-amber-300">{currentBoneData.quaternion[2]}</span>
                    </div>
                    <div className="p-1 rounded bg-white/5">
                      <span className="text-white/40 block text-[8px]">Z</span>
                      <span className="text-purple-300">{currentBoneData.quaternion[3]}</span>
                    </div>
                  </div>
                </div>

                {/* Euler Degrees */}
                <div className="space-y-1">
                  <div className="text-[10px] text-white/50 flex items-center justify-between">
                    <span>Euler Angles (Pitch, Yaw, Roll)</span>
                    <span className="text-[9px] text-white/30">Degrees (°)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                    <div className="p-1 rounded bg-white/5">
                      <span className="text-white/40 block text-[8px]">Pitch (X)</span>
                      <span className="text-white">{currentBoneData.eulerDegrees[0]}°</span>
                    </div>
                    <div className="p-1 rounded bg-white/5">
                      <span className="text-white/40 block text-[8px]">Yaw (Y)</span>
                      <span className="text-white">{currentBoneData.eulerDegrees[1]}°</span>
                    </div>
                    <div className="p-1 rounded bg-white/5">
                      <span className="text-white/40 block text-[8px]">Roll (Z)</span>
                      <span className="text-white">{currentBoneData.eulerDegrees[2]}°</span>
                    </div>
                  </div>
                </div>

                {/* 3D Translation */}
                <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-white/5 text-white/60">
                  <span>3D Pivot Vector:</span>
                  <span className="text-white font-mono">
                    [{currentBoneData.position[0]}, {currentBoneData.position[1]}, {currentBoneData.position[2]}]
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'facs' && (
          <div className="space-y-2 text-xs">
            <div className="text-[10px] uppercase font-mono text-white/40 mb-1">
              Facial Action Coding System (FACS):
            </div>

            {/* Brow Raise */}
            <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-white/80">Eyebrow Raise (AU1 + AU2)</span>
                <span className="font-mono text-teal-300">
                  {Math.round((coordinates?.facs.browRaise || 0) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-400 transition-all duration-150"
                  style={{ width: `${(coordinates?.facs.browRaise || 0) * 100}%` }}
                />
              </div>
            </div>

            {/* Brow Furrow */}
            <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-white/80">Eyebrow Furrow (AU4 - Questions)</span>
                <span className="font-mono text-amber-300">
                  {Math.round((coordinates?.facs.browFurrow || 0) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-150"
                  style={{ width: `${(coordinates?.facs.browFurrow || 0) * 100}%` }}
                />
              </div>
            </div>

            {/* Mouth Smile */}
            <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-white/80">Lip Corner Pull (AU12 - Smile)</span>
                <span className="font-mono text-rose-300">
                  {Math.round((coordinates?.facs.mouthSmile || 0) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-400 transition-all duration-150"
                  style={{ width: `${(coordinates?.facs.mouthSmile || 0) * 100}%` }}
                />
              </div>
            </div>

            {/* Eye Blink */}
            <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-white/80">Eye Blink (AU45)</span>
                <span className="font-mono text-sky-300">
                  {Math.round((coordinates?.facs.eyeBlink || 0) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-150"
                  style={{ width: `${(coordinates?.facs.eyeBlink || 0) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'anim_raw' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-white/50">
              <span>Standard Unity/Blender .anim Curve</span>
              <button
                onClick={handleCopyRawAnim}
                id="btn-copy-raw-anim"
                className="flex items-center gap-1 text-teal-300 hover:text-teal-200 transition"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy File'}</span>
              </button>
            </div>
            <pre className="p-2 rounded-lg bg-black/80 border border-white/10 font-mono text-[9px] text-white/70 overflow-x-auto max-h-48 whitespace-pre">
              {activeStudioGaltWord
                ? generateAnimFileContent(activeStudioGaltWord)
                : '# Select or speak a StudioGalt word to inspect raw .anim curves'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
