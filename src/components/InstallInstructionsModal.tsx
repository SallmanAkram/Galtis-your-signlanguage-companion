import React from 'react';
import {
  X,
  Share,
  PlusSquare,
  Smartphone,
  Monitor,
  Sparkles,
  Download,
} from 'lucide-react';

interface InstallInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: 'ios' | 'desktop' | 'android' | 'other';
}

export const InstallInstructionsModal: React.FC<InstallInstructionsModalProps> = ({
  isOpen,
  onClose,
  platform,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md p-6 rounded-3xl bg-[#0f0f1b]/95 border border-white/15 shadow-2xl shadow-purple-950/50 text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 p-0.5 shadow-lg shadow-purple-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-[#131325] rounded-[14px] flex items-center justify-center">
              <Download className="w-6 h-6 text-purple-300" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
              Add to Home Screen
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h3>
            <p className="text-xs text-white/60">
              {platform === 'ios'
                ? 'Install on your iPhone or iPad'
                : platform === 'desktop'
                ? 'Install on your computer as a desktop app'
                : 'Install SignBridge to your device'}
            </p>
          </div>
        </div>

        {/* Platform specific steps */}
        {platform === 'ios' ? (
          <div className="space-y-3.5 mb-6">
            <p className="text-xs text-white/70 leading-relaxed">
              Apple Safari does not allow automatic 1-tap installs, but you can add SignBridge to your Home Screen in 3 quick taps:
            </p>

            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.05] border border-white/10">
                <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 font-bold text-xs">
                  1
                </div>
                <div className="text-xs text-white/90">
                  Tap the <span className="font-semibold text-white inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10"><Share className="w-3 h-3 text-blue-300" /> Share</span> button in Safari's bottom toolbar.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.05] border border-white/10">
                <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 font-bold text-xs">
                  2
                </div>
                <div className="text-xs text-white/90">
                  Scroll down the menu and tap <span className="font-semibold text-white inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10"><PlusSquare className="w-3 h-3 text-purple-300" /> Add to Home Screen</span>.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.05] border border-white/10">
                <div className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 font-bold text-xs">
                  3
                </div>
                <div className="text-xs text-white/90">
                  Tap <span className="font-bold text-teal-300">"Add"</span> in the top right corner. SignBridge will now launch in full-screen like a native app!
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 mb-6">
            <p className="text-xs text-white/70 leading-relaxed">
              Install SignBridge for full-screen view, faster load times, and offline access:
            </p>

            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.05] border border-white/10">
                <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 font-bold text-xs">
                  <Monitor className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs text-white/90">
                  Look for the <span className="font-semibold text-white">Install App</span> icon (<Download className="w-3 h-3 inline text-purple-300" />) on the right side of your browser's address bar.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.05] border border-white/10">
                <div className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 font-bold text-xs">
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs text-white/90">
                  Or click the browser menu (<span className="font-bold text-white">⋮</span> or <span className="font-bold text-white">⋯</span>) and select <span className="font-semibold text-teal-300">"Install SignBridge..."</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dismiss button */}
        <button
          onClick={onClose}
          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-purple-600/30 transition-all active:scale-[0.98]"
        >
          Got It!
        </button>
      </div>
    </div>
  );
};
