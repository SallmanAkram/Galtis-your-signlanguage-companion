import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  RotateCcw,
  Send,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { TranscriptItem } from '../types';

interface AiSpeechTranslatorViewProps {
  isListening: boolean;
  onToggleListening: () => void;
  audioLevel: number;
  interimText: string;
  transcriptHistory: TranscriptItem[];
  onReplayTranscript: (item: TranscriptItem) => void;
  onClearHistory: () => void;
  onSendText: (text: string) => void;
  onQuickPrompt: (text: string) => void;
}

export const AiSpeechTranslatorView: React.FC<AiSpeechTranslatorViewProps> = ({
  isListening,
  onToggleListening,
  audioLevel,
  interimText,
  transcriptHistory,
  onReplayTranscript,
  onClearHistory,
  onSendText,
  onQuickPrompt,
}) => {
  const [inputText, setInputText] = useState('');

  const samplePrompts = [
    'Hello, my name is Alex. Where are you?',
    'Please take this future.',
    'Everyone is equal here.',
    'Which way should we go?',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendText(inputText.trim());
    setInputText('');
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#26004d]/90 backdrop-blur-md overflow-y-auto px-4 pt-4 pb-20 text-white no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <h2 className="text-lg font-bold tracking-wide flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-purple-300" />
            <span>AI Voice-to-Sign Translator</span>
          </h2>
          <p className="text-xs text-purple-200/70">
            Translates real-time speech directly to ASL gloss motions
          </p>
        </div>
        {transcriptHistory.length > 0 && (
          <button
            onClick={onClearHistory}
            className="text-[11px] text-white/50 hover:text-white flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Voice Recognition Central Stage */}
      <div className="my-5 flex flex-col items-center justify-center p-6 bg-white/5 border border-white/10 rounded-3xl">
        {/* Pulsing Mic Circle */}
        <div className="relative flex items-center justify-center">
          {isListening && (
            <div
              className="absolute rounded-full bg-purple-500/30 animate-ping"
              style={{
                width: `${90 + audioLevel * 70}px`,
                height: `${90 + audioLevel * 70}px`,
              }}
            />
          )}
          <button
            type="button"
            onClick={onToggleListening}
            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-90 ${
              isListening
                ? 'bg-purple-600 text-white ring-4 ring-purple-400/50 shadow-purple-500/50'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
          >
            {isListening ? (
              <Mic className="w-9 h-9 animate-pulse" />
            ) : (
              <MicOff className="w-8 h-8 text-white/60" />
            )}
          </button>
        </div>

        {/* Status Text */}
        <div className="mt-4 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">
            {isListening ? 'Listening to speech...' : 'Tap microphone to speak'}
          </span>
          {interimText ? (
            <p className="mt-1 text-sm font-medium text-white px-4 py-1.5 rounded-full bg-purple-900/60 border border-purple-400/30">
              "{interimText}"
            </p>
          ) : (
            <p className="text-[11px] text-white/50 mt-0.5">
              Natural spoken English will be mapped to Galtis ASL motions
            </p>
          )}
        </div>
      </div>

      {/* Quick Prompt Ideas */}
      <div className="mb-4">
        <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider block mb-2">
          Try Quick Spoken Sentences:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {samplePrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onQuickPrompt(prompt)}
              className="text-xs px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 transition text-left"
            >
              "{prompt}"
            </button>
          ))}
        </div>
      </div>

      {/* Manual Text Translation Input */}
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type English sentence to sign..."
          className="flex-1 bg-white/10 border border-white/15 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-purple-400 transition"
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 active:scale-95 rounded-2xl text-white font-medium text-xs flex items-center gap-1.5 shadow-md shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Translate</span>
        </button>
      </form>

      {/* Transcript History */}
      {transcriptHistory.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider block">
            Recent Translations ({transcriptHistory.length})
          </span>
          <div className="space-y-1.5">
            {transcriptHistory.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between"
              >
                <div className="flex-1 pr-2">
                  <p className="text-xs font-medium text-white">"{item.text}"</p>
                  <span className="text-[10px] text-purple-300/60 font-mono">
                    {item.signs.length} ASL signs identified
                  </span>
                </div>
                <button
                  onClick={() => onReplayTranscript(item)}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs flex items-center gap-1 text-teal-300"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>Replay</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
