import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Sparkles } from 'lucide-react';
import { InstallInstructionsModal } from './InstallInstructionsModal';

export const InstallAppButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState<boolean>(false);
  const [platform, setPlatform] = useState<'ios' | 'desktop' | 'android' | 'other'>('other');

  useEffect(() => {
    // 1. Detect if app is already running in standalone mode (already installed)
    const checkIsStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsInstalled(isStandaloneMode);
    };

    checkIsStandalone();

    // 2. Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos =
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(userAgent);
    const isDesktop = !isIos && !isAndroid;

    if (isIos) setPlatform('ios');
    else if (isAndroid) setPlatform('android');
    else if (isDesktop) setPlatform('desktop');

    // 3. Listen for Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // 4. Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstructionsModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // If already installed as standalone PWA, hide the install button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    // If native prompt is available (Android Chrome, Edge, Chrome Desktop)
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.warn('[PWA] Native install prompt error:', err);
        setShowInstructionsModal(true);
      }
    } else {
      // For iOS Safari or browsers without native prompt support, show instructions modal
      setShowInstructionsModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        title="Add SignBridge to your Home Screen / Install as an App"
        aria-label="Install SignBridge App"
        className="pointer-events-auto group relative flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-full bg-gradient-to-r from-purple-600/30 via-indigo-600/25 to-purple-600/30 hover:from-purple-600/45 hover:via-indigo-600/40 hover:to-purple-600/45 border border-purple-400/40 hover:border-purple-300/70 text-purple-200 hover:text-white shadow-[0_0_16px_rgba(168,85,247,0.25)] hover:shadow-[0_0_22px_rgba(168,85,247,0.4)] backdrop-blur-md transition-all duration-200 active:scale-95"
      >
        <span className="relative flex items-center justify-center">
          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-300 group-hover:text-purple-100 transition-colors animate-bounce" />
        </span>
        <span className="text-[11px] sm:text-xs font-semibold tracking-wide">
          Install
        </span>
        <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/30 border border-purple-400/30 text-purple-200 font-medium">
          App
        </span>
      </button>

      <InstallInstructionsModal
        isOpen={showInstructionsModal}
        onClose={() => setShowInstructionsModal(false)}
        platform={platform}
      />
    </>
  );
};
