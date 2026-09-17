import React, { useState, useMemo } from 'react';
import { Search, Check, Sparkles, User, Shirt, Volume2, RotateCcw } from 'lucide-react';
import { ALL_SIGNS } from '../data/aslDictionary';
import { STUDIO_GALT_DICTIONARY } from '../data/studioGaltDictionary';
import { GaltisModelSource } from './GaltisOriginalAvatar';
import { TranscriptItem, StageBackground } from '../types';
import { BottomNavBar, ActiveTab } from './BottomNavBar';
import { AiSignTrainingView } from './AiSignTrainingView';

export type BottomDrawerMode = 'dictionary' | 'skins' | 'ai' | null;

interface BottomHalfDrawerProps {
  mode: BottomDrawerMode;
  onClose: () => void;
  // Navigation
  activeTab?: ActiveTab;
  onChangeTab?: (tab: ActiveTab) => void;
  // Dictionary props
  onSelectWord: (word: string) => void;
  currentSignName: string | null;
  // Skins props
  activeSkin: GaltisModelSource;
  onSelectSkin: (skin: GaltisModelSource) => void;
  // Backgrounds props
  activeBackground?: StageBackground;
  onSelectBackground?: (bg: StageBackground) => void;
  // AI props
  isListening: boolean;
  onToggleListening: () => void;
  audioLevel: number;
  interimText: string;
  transcriptHistory: TranscriptItem[];
  uploadedVideoFile?: File | null;
  onClearUploadedFile?: () => void;
}

export const BottomHalfDrawer: React.FC<BottomHalfDrawerProps> = ({
  mode,
  onClose,
  activeTab,
  onChangeTab,
  onSelectWord,
  currentSignName,
  activeSkin,
  onSelectSkin,
  activeBackground = 'mist',
  onSelectBackground,
  isListening,
  onToggleListening,
  audioLevel,
  interimText,
  transcriptHistory,
  uploadedVideoFile,
  onClearUploadedFile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');

  // Searchable word list from StudioGalt MoCap Dictionary
  const dictionaryWords = useMemo(() => {
    const list: { word: string; isMocap: boolean; category: string }[] = [];
    const seen = new Set<string>();

    // Add StudioGalt MoCap verified words
    STUDIO_GALT_DICTIONARY.forEach((entry) => {
      const upper = entry.word.toUpperCase();
      if (!seen.has(upper)) {
        seen.add(upper);
        list.push({ word: entry.word, isMocap: true, category: entry.category });
      }
    });

    ALL_SIGNS.forEach((sign) => {
      const upper = sign.gloss.toUpperCase();
      if (!seen.has(upper)) {
        seen.add(upper);
        list.push({ word: sign.gloss, isMocap: true, category: sign.category });
      }
    });

    // Sort alphabetically
    return list.sort((a, b) => a.word.localeCompare(b.word));
  }, []);

  // Filtered words
  const filteredWords = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return dictionaryWords.filter((item) => item.word.toLowerCase().includes(query) && (category === 'all' || item.category === category));
  }, [dictionaryWords, searchQuery, category]);
  const categories = useMemo(() => [...new Set(dictionaryWords.map(item => item.category))].sort(), [dictionaryWords]);

  // Skin options with custom images and names as requested
  const skinOptions: {
    id: GaltisModelSource;
    title: string;
    image: string;
    isPrimary?: boolean;
  }[] = [
    {
      id: 'full_mesh',
      title: 'Male',
      image: '/skins/galtis_1.png',
      isPrimary: true,
    },
    {
      id: 'hello',
      title: 'Female',
      image: '/skins/galtis_2.png',
    },
    {
      id: 'charcoal_suit',
      title: 'Charcoal Suit',
      image: '/skins/galtis_charcoal.png',
    },
  ];

  const [skinsSubTab, setSkinsSubTab] = useState<'skins' | 'backgrounds'>('skins');

  const backgroundOptions: {
    id: StageBackground;
    title: string;
    subtitle: string;
    gradient: string;
    accent: string;
    tag: '3D' | 'Shader';
  }[] = [
    {
      id: 'studio_mist',
      title: 'Studio Mist',
      subtitle: 'Authentic Studio Mist',
      gradient: 'from-[#3b0764] via-[#26004d] to-[#160033]',
      accent: '#a855f7',
      tag: '3D',
    },
    {
      id: 'cyberpunk_grid',
      title: 'Cyberpunk',
      subtitle: 'Synthwave Neon Grid',
      gradient: 'from-[#083344] via-[#0e1726] to-[#164e63]',
      accent: '#06b6d4',
      tag: '3D',
    },
    {
      id: 'cosmic_space',
      title: 'Cosmic Space',
      subtitle: 'Stars & Nebula Dust',
      gradient: 'from-[#1e1b4b] via-[#0b0c2a] to-[#2e1065]',
      accent: '#818cf8',
      tag: '3D',
    },
    {
      id: 'zen_garden',
      title: 'Zen Garden',
      subtitle: 'Bamboo & Stone',
      gradient: 'from-[#064e3b] via-[#0d2818] to-[#14532d]',
      accent: '#34d399',
      tag: '3D',
    },
    {
      id: 'sunset_horizon',
      title: 'Sunset Horizon',
      subtitle: 'Warm Dusk Glow',
      gradient: 'from-[#7c2d12] via-[#3b0764] to-[#1c1917]',
      accent: '#fb923c',
      tag: '3D',
    },
    {
      id: 'deep_ocean',
      title: 'Deep Ocean',
      subtitle: 'Underwater Caustics',
      gradient: 'from-[#0c4a6e] via-[#032840] to-[#082f49]',
      accent: '#38bdf8',
      tag: '3D',
    },
    {
      id: 'lightrays',
      title: 'Light Rays',
      subtitle: 'Volumetric Rays',
      gradient: 'from-[#4c1d95] via-[#2e1065] to-[#0f172a]',
      accent: '#c084fc',
      tag: 'Shader',
    },
    {
      id: 'lightfall',
      title: 'Lightfall',
      subtitle: 'Falling Streaks',
      gradient: 'from-[#1e1b4b] via-[#311042] to-[#18002e]',
      accent: '#f472b6',
      tag: 'Shader',
    },
    {
      id: 'gradientwaves',
      title: 'Gradient Waves',
      subtitle: 'Sine Ocean Waves',
      gradient: 'from-[#581c87] via-[#3b0764] to-[#1e1b4b]',
      accent: '#38bdf8',
      tag: 'Shader',
    },
    {
      id: 'aurora',
      title: 'Aurora',
      subtitle: 'Northern Lights',
      gradient: 'from-[#064e3b] via-[#1e1b4b] to-[#4a044e]',
      accent: '#4ade80',
      tag: 'Shader',
    },
  ];

  if (!mode) return null;

  return (
    <div
      id="bottom-half-drawer"
      role="region"
      aria-label={mode === 'dictionary' ? 'Sign dictionary' : mode === 'skins' ? 'Avatar skins' : 'Speech assistant'}
      className="w-full h-full min-h-0 flex flex-col overflow-hidden text-white select-none"
    >

        {/* 1. DICTIONARY MODE (Faithful to Screenshot 2) */}
        {mode === 'dictionary' && (
          <div className="flex-1 flex flex-col px-5 pb-3 overflow-hidden">
            {/* Search Input matching Screenshot 2 */}
            <div className="my-2 shrink-0">
              <div className="w-full bg-white rounded-full px-4 py-2 flex items-center gap-2 shadow-inner">
                <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ASL Dictionary..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-neutral-800 placeholder-neutral-500 italic outline-none font-sans"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-neutral-400 hover:text-neutral-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Word List with visible right-side scrollbar */}
            <div className="flex items-center justify-between gap-2 pb-2 text-xs shrink-0">
              <select aria-label="Dictionary category" value={category} onChange={e => setCategory(e.target.value)} className="min-w-0 rounded-lg bg-purple-950 text-white border border-white/20 px-2 py-1.5">
                <option value="all">All categories</option>
                {categories.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <span aria-live="polite" className="text-white/70">{filteredWords.length.toLocaleString()} signs</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/20 pr-2">
              {filteredWords.length === 0 ? (
                <div className="py-8 text-center text-white/70 text-sm italic">
                  No signs matching "{searchQuery}"
                </div>
              ) : (
                filteredWords.map((item) => {
                  const isCurrent = currentSignName?.toUpperCase() === item.word.toUpperCase();
                  return (
                    <button
                      key={item.word}
                      type="button"
                      onClick={() => onSelectWord(item.word)}
                      className={`w-full py-3 px-3 text-left font-sans text-[15px] font-normal transition flex items-center justify-between rounded-lg active:bg-white/20 ${
                        isCurrent
                          ? 'bg-purple-900/40 font-semibold text-white'
                          : 'text-white/90 hover:bg-white/10'
                      }`}
                    >
                      <span className="tracking-wide">{item.word}</span>
                      {item.isMocap && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-800/40 text-purple-100 font-mono">
                          Studio MoCap
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 2. SKINS & BACKGROUNDS MODE */}
        {mode === 'skins' && (
          <div className="flex-1 flex flex-col px-4 sm:px-5 pb-2 overflow-y-auto no-scrollbar">
            {/* Segmented Switcher: Skins vs Backgrounds */}
            <div className="w-full flex items-center justify-center my-1 shrink-0">
              <div className="flex items-center p-0.5 rounded-full bg-white/[0.08] border border-white/18 backdrop-blur-md shadow-inner">
                <button
                  type="button"
                  onClick={() => setSkinsSubTab('skins')}
                  className={`px-4 py-1 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
                    skinsSubTab === 'skins'
                      ? 'bg-white text-purple-950 shadow-md font-bold'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  <Shirt className="w-3.5 h-3.5" />
                  <span>Skins</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSkinsSubTab('backgrounds')}
                  className={`px-4 py-1 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
                    skinsSubTab === 'backgrounds'
                      ? 'bg-white text-purple-950 shadow-md font-bold'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Backgrounds</span>
                </button>
              </div>
            </div>

            {skinsSubTab === 'skins' ? (
              <>
                {/* Skin Cards Grid */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3 my-1">
                  {skinOptions.map((skin) => {
                    const isSelected = activeSkin === skin.id;
                    return (
                      <button
                        key={skin.id}
                        type="button"
                        onClick={() => onSelectSkin(skin.id)}
                        className={`group relative flex flex-col h-[180px] sm:h-[192px] rounded-2xl border-2 transition-all active:scale-95 overflow-hidden ${
                          isSelected
                            ? 'border-purple-400 bg-purple-500/20 shadow-xl ring-2 ring-purple-400/50'
                            : 'border-white/20 bg-neutral-900/60 hover:border-white/40'
                        }`}
                      >
                        {/* Picture filling 100% of card width & height */}
                        <div className="absolute inset-0 w-full h-full overflow-hidden bg-neutral-950">
                          <img
                            src={skin.image}
                            alt={skin.title}
                            className="w-full h-full object-cover object-[center_14%] group-hover:scale-105 transition-transform duration-300"
                            loading="eager"
                          />
                        </div>

                        {/* Selected Checkmark Badge */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg ring-2 ring-white/80 z-20">
                            <Check className="w-3 h-3 text-white stroke-[3]" />
                          </div>
                        )}

                        {/* Title Overlay at Bottom ("Male" / "Female" / "Charcoal Suit") */}
                        <div className="absolute inset-x-0 bottom-0 pt-8 pb-2 px-1.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex items-center justify-center z-10 pointer-events-none">
                          <span className="text-xs sm:text-sm font-bold text-white tracking-wider drop-shadow-md text-center">
                            {skin.title}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                {/* Background Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-1 overflow-y-auto no-scrollbar max-h-[220px] p-0.5">
                  {backgroundOptions.map((bg) => {
                    const isSelected =
                      activeBackground === bg.id ||
                      (bg.id === 'studio_mist' && activeBackground === 'mist') ||
                      (bg.id === 'mist' && activeBackground === 'studio_mist');
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => onSelectBackground && onSelectBackground(bg.id)}
                        className={`flex flex-col items-center p-2 rounded-2xl border-2 transition-all active:scale-95 text-left ${
                          isSelected
                            ? 'border-white bg-white/25 shadow-lg ring-2 ring-white/40'
                            : 'border-white/25 bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        {/* Animated Visual Thumbnail */}
                        <div
                          className={`w-full h-14 rounded-xl bg-gradient-to-br ${bg.gradient} relative overflow-hidden shadow-inner flex items-center justify-center mb-1 border border-white/15`}
                        >
                          <div
                            className="w-5 h-5 rounded-full blur-xs opacity-80"
                            style={{ backgroundColor: bg.accent }}
                          />
                          {/* 3D vs Shader Badge */}
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[9px] font-mono font-semibold text-white/90 border border-white/10">
                            {bg.tag}
                          </div>
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow">
                              <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-white tracking-wide truncate w-full text-center">
                          {bg.title}
                        </span>
                        <span className="text-[10px] text-white/70 font-medium truncate w-full text-center">
                          {bg.subtitle}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-center text-white/75 mt-0.5">
                  Live 3D environments and WebGL shaders rendered in real-time.
                </p>
              </>
            )}
          </div>
        )}

        {/* 3. AI SIGN RECOGNITION & TRAINING MODE (POWERED BY MEDIAPIPE) */}
        {mode === 'ai' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-1.5 sm:p-2">
            <AiSignTrainingView
              onSelectWord={onSelectWord}
              currentSignName={currentSignName}
              uploadedFile={uploadedVideoFile}
              onClearUploadedFile={onClearUploadedFile}
            />
          </div>
        )}
      </div>
  );
};
