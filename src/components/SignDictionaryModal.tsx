import React, { useState } from 'react';
import {
  X,
  Search,
  Sparkles,
  Play,
  BookOpen,
  Layers,
  Download,
  Activity,
  Code,
  Check,
  Copy,
  ChevronRight,
} from 'lucide-react';
import { Companion, SignDefinition, StudioGaltWordEntry } from '../types';
import { ALL_SIGNS } from '../data/aslDictionary';
import { downloadAnimCoordinateFile, generateAnimFileContent } from '../data/studioGaltDictionary';

interface SignDictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  companion: Companion;
  onTriggerSign: (signDef: SignDefinition) => void;
  onTriggerFingerspell: (char: string) => void;
  onInspectCoordinates?: (word: StudioGaltWordEntry) => void;
}

export const SignDictionaryModal: React.FC<SignDictionaryModalProps> = ({
  isOpen,
  onClose,
  companion,
  onTriggerSign,
  onTriggerFingerspell,
  onInspectCoordinates,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'studiogalt' | 'alphabet'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [previewWordForAnim, setPreviewWordForAnim] = useState<StudioGaltWordEntry | null>(null);
  const [copiedAnim, setCopiedAnim] = useState(false);

  if (!isOpen) return null;

  const categories = ['all', 'studiogalt', ...Array.from(new Set(ALL_SIGNS.map(sign => sign.category))).sort()];

  const filteredSigns = ALL_SIGNS.filter((sign) => {
    const matchesSearch =
      sign.gloss.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sign.matchedWords.some((w) => w.toLowerCase().includes(searchQuery.toLowerCase())) ||
      sign.description.toLowerCase().includes(searchQuery.toLowerCase());

    const isStudioGalt = !!sign.studioGaltData;
    if (activeTab === 'studiogalt' && !isStudioGalt) return false;

    const matchesCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'studiogalt' && isStudioGalt) ||
      sign.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const filteredAlphabet = alphabet.filter((char) =>
    char.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopyAnim = (word: StudioGaltWordEntry) => {
    const content = generateAnimFileContent(word);
    navigator.clipboard.writeText(content);
    setCopiedAnim(true);
    setTimeout(() => setCopiedAnim(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
      />

      {/* Modal Dialog */}
      <div
        id="sign-dictionary-dialog"
        className="relative z-10 w-full max-w-2xl max-h-[88vh] bg-[#090d16]/95 border border-white/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-3xl animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center text-black font-bold shadow-md"
              style={{ backgroundColor: companion.accentColor }}
            >
              <BookOpen className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  SignBridge MoCap Dictionary
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-mono text-[9px] font-semibold">
                  StudioGalt Archive
                </span>
              </div>
              <p className="text-[11px] text-white/50">
                MoCap dictionary & .anim coordinate files recorded for Galtis 3D
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            id="btn-close-dictionary"
            aria-label="Close dictionary modal"
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher & Search input */}
        <div className="px-6 py-3 border-b border-white/10 space-y-2.5 bg-white/[0.01]">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                id="search-dictionary-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search StudioGalt words, .anim files or signs..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/30"
              />
            </div>

            <div className="flex rounded-xl bg-white/5 p-0.5 border border-white/10 shrink-0">
              <button
                onClick={() => setActiveTab('all')}
                id="tab-all-signs"
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'all'
                    ? 'bg-white text-black shadow'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                All Signs ({ALL_SIGNS.length})
              </button>
              <button
                onClick={() => setActiveTab('studiogalt')}
                id="tab-studiogalt"
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  activeTab === 'studiogalt'
                    ? 'bg-teal-400 text-black shadow'
                    : 'text-teal-300/80 hover:text-teal-200'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>StudioGalt MoCap</span>
              </button>
              <button
                onClick={() => setActiveTab('alphabet')}
                id="tab-alphabet"
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'alphabet'
                    ? 'bg-white text-black shadow'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                A-Z (26)
              </button>
            </div>
          </div>

          {/* Category Filter Pills (when not on Alphabet tab) */}
          {activeTab !== 'alphabet' && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  id={`cat-filter-${cat}`}
                  className={`px-2.5 py-0.8 rounded-full text-[11px] font-medium capitalize transition whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {cat === 'studiogalt' ? 'StudioGalt Only' : cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Body: Cards List or .anim Coordinate Inspector Drawer */}
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          {previewWordForAnim ? (
            /* Dedicated .anim Coordinate Detail Viewer */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewWordForAnim(null)}
                      className="text-xs text-white/60 hover:text-white flex items-center gap-1"
                    >
                      ← Back to Dictionary
                    </button>
                    <span className="text-white/30">•</span>
                    <h4 className="text-sm font-bold text-teal-300 font-mono">
                      {previewWordForAnim.word} (.anim coordinates)
                    </h4>
                  </div>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    Motion: {previewWordForAnim.parentMotion} | {previewWordForAnim.keyposes.length} Keyposes | {previewWordForAnim.fps} FPS
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyAnim(previewWordForAnim)}
                    disabled={!previewWordForAnim.keyposes.length}
                    id="btn-copy-anim-viewer"
                    className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    {copiedAnim ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAnim ? 'Copied!' : 'Copy .anim'}</span>
                  </button>
                  <button
                    onClick={() => downloadAnimCoordinateFile(previewWordForAnim, 'anim')}
                    disabled={!previewWordForAnim.keyposes.length}
                    id="btn-download-anim-viewer"
                    className="px-3 py-1 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .anim</span>
                  </button>
                  <button
                    onClick={() => downloadAnimCoordinateFile(previewWordForAnim, 'json')}
                    id="btn-download-json-viewer"
                    className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON</span>
                  </button>
                </div>
              </div>

              {/* Keyposes Timeline Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {previewWordForAnim.keyposes.map((kp) => (
                  <div
                    key={kp.poseId}
                    className="p-3 rounded-2xl bg-black/60 border border-white/10 space-y-2 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between text-teal-300 font-bold">
                      <span>Keypose {kp.poseId}</span>
                      <span className="text-white/40 text-[10px]">Frame {kp.frame} ({((kp.frame / previewWordForAnim.fps) * 1000).toFixed(0)}ms)</span>
                    </div>
                    <div className="space-y-1 text-[10px] text-white/70">
                      <div>Tracked Bones: <span className="text-white font-bold">{kp.boneCount}</span></div>
                      <div className="p-2 rounded bg-white/5 space-y-1">
                        <div className="text-teal-200 font-semibold">bicepfk_R (Upper Arm):</div>
                        <div className="text-white/60">
                          Quat: [{kp.bones['bicepfk_R']?.quaternion.join(', ') || '1, 0, 0, 0'}]
                        </div>
                        <div className="text-white/60">
                          Euler: [{kp.bones['bicepfk_R']?.eulerDegrees.join('°, ') || '0, 0, 0'}°]
                        </div>
                      </div>
                      <div className="p-2 rounded bg-white/5 space-y-1">
                        <div className="text-sky-200 font-semibold">forearmfk_R (Elbow):</div>
                        <div className="text-white/60">
                          Quat: [{kp.bones['forearmfk_R']?.quaternion.join(', ') || '1, 0, 0, 0'}]
                        </div>
                        <div className="text-white/60">
                          Euler: [{kp.bones['forearmfk_R']?.eulerDegrees.join('°, ') || '0, 0, 0'}°]
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Raw .anim file preview box */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono text-white/50">
                  Serialized Unity/Blender .anim AnimationClip Track:
                </div>
                <pre className="p-3 rounded-xl bg-black/90 border border-white/10 font-mono text-[10px] text-white/70 overflow-x-auto max-h-48 whitespace-pre leading-relaxed">
                  {previewWordForAnim.keyposes.length ? generateAnimFileContent(previewWordForAnim) : `This sign uses a baked Three.js animation clip.\nFile: ${previewWordForAnim.animationFile}\nDuration: ${previewWordForAnim.durationSec?.toFixed(3)} seconds\nUse Download JSON to export the complete bone animation.`}
                </pre>
              </div>
            </div>
          ) : activeTab === 'words' || activeTab === 'all' || activeTab === 'studiogalt' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredSigns.map((sign) => {
                const isStudioGalt = !!sign.studioGaltData;
                return (
                  <div
                    key={sign.gloss}
                    id={`glossary-item-${sign.gloss.toLowerCase().replace(/\s+/g, '-')}`}
                    className={`p-4 rounded-2xl transition flex flex-col justify-between group ${
                      isStudioGalt
                        ? 'bg-teal-950/20 border border-teal-500/30 hover:border-teal-400/60 hover:bg-teal-950/30'
                        : 'bg-white/[0.03] border border-white/5 hover:border-white/20 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div>
                      {/* Header Badge */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-white tracking-wider flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shadow-sm"
                            style={{ backgroundColor: isStudioGalt ? '#2dd4bf' : companion.accentColor }}
                          />
                          {sign.gloss}
                        </span>

                        <span
                          className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-full font-semibold ${
                            isStudioGalt
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                              : 'bg-white/10 text-white/60'
                          }`}
                        >
                          {isStudioGalt ? 'StudioGalt MoCap' : sign.category}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-white/60 leading-relaxed mb-2">
                        {sign.description}
                      </p>

                      {/* StudioGalt Metadata Details */}
                      {sign.studioGaltData && (
                        <div className="mb-2 p-2 rounded-xl bg-black/40 border border-teal-500/20 space-y-1 text-[10px] font-mono text-white/60">
                          <div className="flex justify-between">
                            <span className="text-teal-300/80">Motion Capture ID:</span>
                            <span className="text-white truncate max-w-[150px]">{sign.studioGaltData.parentMotion}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-teal-300/80">Keyposes:</span>
                            <span className="text-white font-semibold">
                              {sign.studioGaltData.keyposes.length} poses (391 bones)
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Spoken Word Triggers */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {sign.matchedWords.map((w) => (
                          <span
                            key={w}
                            className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-white/40 font-mono"
                          >
                            "{w}"
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-1.5 mt-2">
                      <button
                        onClick={() => {
                          onTriggerSign(sign);
                          onClose();
                        }}
                        id={`btn-play-sign-${sign.gloss.toLowerCase().replace(/\s+/g, '-')}`}
                        className={`w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md ${
                          isStudioGalt
                            ? 'bg-teal-400 text-black hover:bg-teal-300'
                            : 'bg-white/15 hover:bg-white/25 text-white'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Perform on {companion.name}</span>
                      </button>

                      {sign.studioGaltData && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setPreviewWordForAnim(sign.studioGaltData!)}
                            id={`btn-inspect-anim-${sign.gloss.toLowerCase().replace(/\s+/g, '-')}`}
                            className="flex-1 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-mono font-medium flex items-center justify-center gap-1 transition"
                          >
                            <Code className="w-3 h-3" />
                            <span>Inspect .anim</span>
                          </button>
                          <button
                            onClick={() => downloadAnimCoordinateFile(sign.studioGaltData!, 'anim')}
                            disabled={!sign.studioGaltData!.keyposes.length}
                            id={`btn-download-anim-${sign.gloss.toLowerCase().replace(/\s+/g, '-')}`}
                            title="Download .anim file"
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 text-[10px] font-mono flex items-center gap-1 transition"
                          >
                            <Download className="w-3 h-3" />
                            <span>.anim</span>
                          </button>
                          <button
                            onClick={() => downloadAnimCoordinateFile(sign.studioGaltData!, 'json')}
                            id={`btn-download-json-${sign.gloss.toLowerCase().replace(/\s+/g, '-')}`}
                            title="Download raw bone coordinate JSON"
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 text-[10px] font-mono flex items-center gap-1 transition"
                          >
                            <Download className="w-3 h-3" />
                            <span>.json</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
              {filteredAlphabet.map((char) => (
                <button
                  key={char}
                  id={`alphabet-char-${char}`}
                  onClick={() => {
                    onTriggerFingerspell(char);
                    onClose();
                  }}
                  className="aspect-square rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/30 hover:bg-white/10 transition flex flex-col items-center justify-center group active:scale-95"
                >
                  <span className="text-xl font-bold font-mono text-white group-hover:scale-110 transition">
                    {char}
                  </span>
                  <span className="text-[9px] text-white/40 font-mono mt-0.5">
                    ASL
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white/[0.02] border-t border-white/10 text-[11px] text-white/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            <span>StudioGalt Motion-Capture Archive Integration</span>
          </div>
          <span className="text-teal-300 font-mono">SignBridge Galtis 8 Rig</span>
        </div>
      </div>
    </div>
  );
};
