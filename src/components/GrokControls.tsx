import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Keyboard,
  RotateCcw,
  Volume2,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react';
import { Companion } from '../types';

interface GrokControlsProps {
  companion: Companion;
  isListening: boolean;
  onToggleListening: () => void;
  audioLevel: number;
  interimText: string;
  activeSpeechPill: string | null;
  currentSignName: string | null;
  onSendText: (text: string) => void;
  onQuickPrompt: (phrase: string) => void;
  errorMsg: string | null;
  showCaptions: boolean;
  queueLength: number;
  showCoordinatesHud?: boolean;
  onToggleCoordinatesHud?: () => void;
}

export const GrokControls: React.FC<GrokControlsProps> = ({
  companion,
  isListening,
  onToggleListening,
  audioLevel,
  interimText,
  activeSpeechPill,
  currentSignName,
  onSendText,
  onQuickPrompt,
  errorMsg,
  showCaptions,
  queueLength,
  showCoordinatesHud,
  onToggleCoordinatesHud,
}) => {
  const [showKeyboardInput, setShowKeyboardInput] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showPrompts, setShowPrompts] = useState(true);

  const quickPrompts = [
    { label: 'Hello', isMocap: true },
    { label: 'You', isMocap: true },
    { label: 'Please', isMocap: true },
    { label: 'My name is', isMocap: true },
    { label: 'Where', isMocap: true },
    { label: 'Which', isMocap: true },
    { label: 'This', isMocap: true },
    { label: 'Take', isMocap: true },
    { label: 'Future', isMocap: true },
    { label: 'Equal', isMocap: true },
    { label: 'Everyone', isMocap: true },
    { label: 'Turn off', isMocap: true },
    { label: 'Or', isMocap: true },
    { label: 'Thank you', isMocap: false },
    { label: 'Friend', isMocap: false },
    { label: 'Help', isMocap: false },
    { label: 'I love you', isMocap: false },
    { label: 'Peace', isMocap: false },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendText(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center pointer-events-none pb-6 px-4 select-none">
      {/* 1. Live Subtitle / Spoken Words Bubble */}
      {showCaptions && (activeSpeechPill || interimText || currentSignName) && (
        <div className="pointer-events-auto max-w-md w-full mb-3 px-4 py-2.5 rounded-2xl ios-glass border border-white/10 shadow-2xl backdrop-blur-2xl flex flex-col items-center text-center transition-all animate-in fade-in zoom-in-95 duration-200">
          {/* Active Word & Sign Indicator */}
          <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: companion.accentColor }}>
            <Sparkles className="w-3 h-3" />
            <span>LIVE ASL INTERPRETER</span>
            {queueLength > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/10 text-white/70 font-mono text-[9px]">
                {queueLength} in queue
              </span>
            )}
          </div>

          {/* Spoken Text */}
          <p className="text-sm font-medium text-white/95 leading-snug">
            {activeSpeechPill || interimText}
          </p>

          {/* Current Sign Gloss */}
          {currentSignName && (
            <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-xs font-mono font-bold text-white shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: companion.accentColor }} />
              SIGNING: {currentSignName}
            </div>
          )}
        </div>
      )}

      {/* Mic error banner if blocked */}
      {errorMsg && (
        <div className="pointer-events-auto max-w-sm mb-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-[11px] text-amber-200 text-center backdrop-blur-md">
          {errorMsg}
        </div>
      )}

      {/* 2. Quick Spoken Prompts Carousel */}
      <div className="pointer-events-auto w-full max-w-md mb-2 flex items-center justify-between">
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {quickPrompts.map((item) => (
            <button
              key={item.label}
              onClick={() => onQuickPrompt(item.label)}
              id={`quick-prompt-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={`whitespace-nowrap px-3 py-1 rounded-full ios-glass text-[11px] font-medium active:scale-95 transition flex items-center gap-1.5 border ${
                item.isMocap
                  ? 'text-orange-200 border-orange-500/30 hover:border-orange-500/50 hover:bg-orange-500/10'
                  : 'text-white/80 hover:text-white hover:bg-white/15 border-white/10'
              }`}
            >
              {item.isMocap && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
              )}
              <span>{item.label}</span>
              {item.isMocap && (
                <span className="text-[9px] font-mono text-orange-400/80 px-1 py-0.2 rounded bg-orange-500/20">
                  MoCap
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Text Input Drawer (if open) */}
      {showKeyboardInput && (
        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto w-full max-w-md mb-3 flex items-center gap-2 p-1.5 rounded-2xl ios-glass border border-white/15 shadow-2xl animate-in slide-in-from-bottom-2 duration-200"
        >
          <input
            type="text"
            id="input-text-to-sign"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type words to sign live (e.g. hello friend)..."
            className="flex-1 bg-transparent px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            id="btn-submit-text-to-sign"
            disabled={!inputText.trim()}
            className="px-3.5 py-1.5 rounded-xl text-black font-semibold text-xs flex items-center gap-1 disabled:opacity-30 transition active:scale-95 shadow-md"
            style={{ backgroundColor: companion.accentColor }}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Sign</span>
          </button>
        </form>
      )}

      {/* 4. Main Grok Companion Interaction Bar */}
      <div className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-full ios-glass border border-white/15 shadow-2xl shadow-black/90 backdrop-blur-3xl">
        {/* Keyboard Toggle */}
        <button
          onClick={() => setShowKeyboardInput(!showKeyboardInput)}
          id="btn-toggle-keyboard"
          aria-label="Toggle text input"
          title="Type text to sign"
          className={`w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95 ${
            showKeyboardInput
              ? 'bg-white text-black shadow-lg'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* StudioGalt Live MoCap Telemetry HUD toggle button */}
        {onToggleCoordinatesHud && (
          <button
            onClick={onToggleCoordinatesHud}
            id="btn-toggle-telemetry-hud"
            aria-label="Toggle StudioGalt MoCap Telemetry HUD"
            title="StudioGalt MoCap .anim HUD"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95 relative ${
              showCoordinatesHud
                ? 'bg-teal-400 text-black shadow-lg font-bold'
                : 'text-teal-300/80 hover:text-teal-200 hover:bg-white/10'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-teal-500 text-[8px] text-black font-mono font-bold">
              anim
            </span>
          </button>
        )}

        {/* Central Pulsating Grok Mic Button */}
        <div className="relative flex items-center justify-center">
          {/* Animated concentric audio rings when listening */}
          {isListening && (
            <>
              <div
                className="absolute w-20 h-20 rounded-full opacity-30 animate-ping pointer-events-none"
                style={{ backgroundColor: companion.accentColor }}
              />
              <div
                className="absolute w-16 h-16 rounded-full opacity-40 blur-sm pointer-events-none transition-transform duration-75"
                style={{
                  backgroundColor: companion.accentColor,
                  transform: `scale(${1 + audioLevel * 0.008})`,
                }}
              />
            </>
          )}

          <button
            onClick={onToggleListening}
            id="btn-toggle-mic"
            aria-label={isListening ? 'Stop listening' : 'Start microphone live sign'}
            className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl active:scale-90 ${
              isListening
                ? 'text-black shadow-cyan-500/40 scale-105'
                : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
            }`}
            style={
              isListening
                ? {
                    backgroundColor: companion.accentColor,
                    boxShadow: `0 0 25px ${companion.accentColor}`,
                  }
                : undefined
            }
          >
            {isListening ? (
              <Mic className="w-6 h-6 animate-pulse stroke-[2.5]" />
            ) : (
              <MicOff className="w-6 h-6 text-white/80" />
            )}
          </button>
        </div>

        {/* Audio Waveform Bars / Activity Indicator */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white/70">
          {isListening ? (
            <div className="flex items-center gap-0.5 h-4">
              {[0.4, 0.9, 0.6, 1.0, 0.5].map((mult, idx) => {
                const height = Math.max(3, Math.min(18, (audioLevel || 20) * mult * 0.25));
                return (
                  <div
                    key={idx}
                    className="w-1 rounded-full transition-all duration-75"
                    style={{
                      height: `${height}px`,
                      backgroundColor: companion.accentColor,
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="w-2 h-2 rounded-full bg-white/20" />
          )}
        </div>
      </div>

      {/* iOS Home Indicator Bar */}
      <div className="w-32 h-1 bg-white/30 rounded-full mt-3 pointer-events-auto" />
    </div>
  );
};
