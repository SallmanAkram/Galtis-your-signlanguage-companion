import React, { useState } from 'react';
import { Sparkles, BookOpen, CheckCircle2, Play, Volume2, RotateCcw } from 'lucide-react';

const LETTER_DESCRIPTIONS: Record<string, string> = {
  A: 'Fist with thumb resting alongside index finger',
  B: 'Flat hand held vertically, thumb folded across palm',
  C: 'Curved hand forming a C shape',
  D: 'Index finger pointing up, thumb touching middle, ring, pinky tips',
  E: 'All fingertips curled down touching the thumb tip',
  F: 'Thumb and index finger form circle, other three fingers upright',
  G: 'Index and thumb pointing horizontally parallel',
  H: 'Index and middle fingers pointing horizontally forward together',
  I: 'Pinky finger pointing up, all other fingers closed',
  J: 'Pinky finger traces a J curve in the air',
  K: 'Index up, middle pointing forward, thumb between them',
  L: 'Index and thumb form right angle L shape',
  M: 'Thumb tucked under three fingers',
  N: 'Thumb tucked under two fingers',
  O: 'All fingers curved to meet thumb forming an O',
  P: 'Down-pointing K handshape',
  Q: 'Down-pointing G handshape',
  R: 'Index and middle fingers crossed',
  S: 'Fist with thumb crossed over fingers',
  T: 'Thumb between index and middle fingers',
  U: 'Index and middle fingers straight up together',
  V: 'Index and middle fingers form a V peace sign',
  W: 'Index, middle, and ring fingers spread upwards forming a W',
  X: 'Index finger hooked like a curved claw',
  Y: 'Thumb and pinky extended, middle three fingers folded',
  Z: 'Index finger traces a Z in the air',
};

interface PracticeViewProps {
  onTriggerSign: (signName: string) => void;
  onTriggerFingerspell: (letter: string) => void;
  speed: number;
  onChangeSpeed: (speed: number) => void;
}

export const PracticeView: React.FC<PracticeViewProps> = ({
  onTriggerSign,
  onTriggerFingerspell,
  speed,
  onChangeSpeed,
}) => {
  const [selectedLetter, setSelectedLetter] = useState<string>('A');
  const [activeCategory, setActiveCategory] = useState<'alphabet' | 'essentials' | 'challenge'>(
    'alphabet'
  );
  const [completedSigns, setCompletedSigns] = useState<string[]>(['HELLO', 'PLEASE']);

  const alphabetLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const essentialSigns = [
    { word: 'HELLO', description: 'Open B-hand salutes outward from forehead edge', mocap: true },
    { word: 'YOU', description: 'Index finger points forward directly towards listener', mocap: true },
    { word: 'PLEASE', description: 'Open flat hand rubs clockwise circle over the chest', mocap: true },
    { word: 'MY NAME', description: 'Flat hand on chest followed by H-hands tapping', mocap: true },
    { word: 'WHERE', description: 'Index finger wiggles upright with furrowed brows', mocap: true },
    { word: 'WHICH', description: 'A-handshapes alternate up and down', mocap: true },
    { word: 'THIS', description: 'Index finger points downwards firmly', mocap: true },
    { word: 'FUTURE', description: 'Open hand moves forward in gentle arc from cheek', mocap: true },
    { word: 'EVERYONE', description: 'Thumbs move outwards from together to sides', mocap: true },
    { word: 'OR', description: 'Hands tilt side to side presenting choices', mocap: true },
  ];

  const handleCompleteSign = (word: string) => {
    onTriggerSign(word);
    if (!completedSigns.includes(word)) {
      setCompletedSigns((prev) => [...prev, word]);
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#26004d]/90 backdrop-blur-md overflow-y-auto px-4 pt-4 pb-20 text-white no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <h2 className="text-lg font-bold tracking-wide flex items-center gap-2 text-white">
            <BookOpen className="w-5 h-5 text-purple-300" />
            <span>Practice & Learn ASL</span>
          </h2>
          <p className="text-xs text-purple-200/70">
            Interactive tutor with Galtis 3D studio motions
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full border border-white/10">
          <span className="text-[11px] text-purple-200">Speed:</span>
          <button
            onClick={() => onChangeSpeed(speed === 0.5 ? 1.0 : 0.5)}
            className="text-xs font-bold text-teal-300 hover:underline"
          >
            {speed}x {speed <= 0.5 ? '(Slow Mo)' : ''}
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 my-3">
        <button
          onClick={() => setActiveCategory('alphabet')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            activeCategory === 'alphabet'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white/10 text-purple-200 hover:bg-white/15'
          }`}
        >
          Fingerspelling (A-Z)
        </button>
        <button
          onClick={() => setActiveCategory('essentials')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            activeCategory === 'essentials'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white/10 text-purple-200 hover:bg-white/15'
          }`}
        >
          Essential Studio Signs
        </button>
      </div>

      {/* Alphabet Practice Mode */}
      {activeCategory === 'alphabet' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl">
            <span className="text-xs text-purple-300 font-medium block mb-2">
              Select a letter to have Galtis demonstrate the finger shape:
            </span>
            <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5">
              {alphabetLetters.map((char) => (
                <button
                  key={char}
                  onClick={() => {
                    setSelectedLetter(char);
                    onTriggerFingerspell(char);
                  }}
                  className={`h-10 rounded-xl font-bold text-sm transition flex flex-col items-center justify-center ${
                    selectedLetter === char
                      ? 'bg-purple-500 text-white scale-105 shadow-lg shadow-purple-900/50'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  <span>{char}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Letter Detail Card */}
          <div className="p-4 bg-gradient-to-br from-purple-900/50 to-black/60 border border-purple-500/20 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-purple-300 uppercase tracking-wider font-semibold block">
                Letter {selectedLetter}
              </span>
              <p className="text-sm font-medium text-white mt-0.5">
                {LETTER_DESCRIPTIONS[selectedLetter] || 'Form handshape with precise fingers'}
              </p>
            </div>
            <button
              onClick={() => onTriggerFingerspell(selectedLetter)}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Demonstrate</span>
            </button>
          </div>
        </div>
      )}

      {/* Essentials Practice Mode */}
      {activeCategory === 'essentials' && (
        <div className="space-y-2">
          {essentialSigns.map((item) => (
            <div
              key={item.word}
              className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-between transition"
            >
              <div className="flex-1 pr-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white tracking-wide">{item.word}</span>
                  {item.mocap && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono">
                      Studio MoCap
                    </span>
                  )}
                  {completedSigns.includes(item.word) && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <p className="text-xs text-white/60 mt-0.5">{item.description}</p>
              </div>
              <button
                onClick={() => handleCompleteSign(item.word)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Watch</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
