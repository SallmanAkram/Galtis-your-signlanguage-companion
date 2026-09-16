import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Stage3D } from './components/Stage3D';
import { BottomNavBar, ActiveTab } from './components/BottomNavBar';
import { SettingsDrawer } from './components/SettingsDrawer';
import { BottomHalfDrawer, BottomDrawerMode } from './components/BottomHalfDrawer';
import { PracticeView } from './components/PracticeView';
import { SignDictionaryModal } from './components/SignDictionaryModal';
import { LiveCoordinateHud } from './components/LiveCoordinateHud';
import { Character3D, LiveMocapCoordinates } from './components/CharacterRig';
import { GaltisModelSource } from './components/GaltisOriginalAvatar';
import LightRays from './components/backgrounds/LightRays';
import Lightfall from './components/backgrounds/Lightfall';
import GradientWaves from './components/backgrounds/GradientWaves';
import Aurora from './components/backgrounds/Aurora';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { COMPANIONS, ALL_SIGNS } from './data/aslDictionary';
import { STUDIO_GALT_DICTIONARY, convertStudioGaltKeyposeToRigPose } from './data/studioGaltDictionary';
import {
  Companion,
  AppSettings,
  TranscriptItem,
  SignDefinition,
  CameraViewMode,
  StudioGaltWordEntry,
  GestureKeyframe,
  StageBackground,
} from './types';
import { Sparkles, Mic, MicOff, Send, Eye, Activity } from 'lucide-react';

export default function App() {
  // Active companion (Defaulting to Galtis MoCap Rig)
  const [currentCompanion, setCurrentCompanion] = useState<Companion>(COMPANIONS[0]);

  // Primary Avatar Skin: Full Body Rig ('full_mesh') as primary, Mesh + Hair ('hello') as secondary skin
  const [avatarSkin, setAvatarSkin] = useState<GaltisModelSource>('full_mesh');

  // Active Stage Background (mist, lightrays, lightfall, gradientwaves, aurora)
  const [stageBackground, setStageBackground] = useState<StageBackground>('mist');

  // Bottom Navigation Bar Active Tab (play, dictionary, skins, ai, or null when closed)
  const [activeTab, setActiveTab] = useState<ActiveTab | null>('play');

  // App & Stage Settings
  const [settings, setSettings] = useState<AppSettings>({
    signingSpeed: 1.2,
    autoFingerspellUnknown: true,
    continuousListening: true,
    showMist: true,
    showCaptions: true,
    showBoneCoordinatesHud: false,
    showSkeletalJoints: false,
    soundFeedback: true,
    viewMode: 'front',
  });

  // Settings Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFullDictionaryModalOpen, setIsFullDictionaryModalOpen] = useState(false);

  // Quick text input on main stage
  const [quickInputText, setQuickInputText] = useState('');

  // Active Sign Queue for 3D character execution
  const [signQueue, setSignQueue] = useState<{
    type: 'gloss' | 'letter';
    id: string;
    name: string;
    def?: any;
    char?: string;
  }[]>([]);
  const [currentSignName, setCurrentSignName] = useState<string | null>(null);

  // StudioGalt Live Telemetry state
  const [liveCoordinates, setLiveCoordinates] = useState<LiveMocapCoordinates | null>(null);
  const [selectedStudioGaltWord, setSelectedStudioGaltWord] = useState<StudioGaltWordEntry | null>(
    STUDIO_GALT_DICTIONARY[0] || null
  );
  const [activeKeyposeIdx, setActiveKeyposeIdx] = useState<number>(0);
  const [manualKeyframe, setManualKeyframe] = useState<GestureKeyframe | null>(null);

  // Quick signs list exclusively with StudioGalt authentic MoCap gestures
  const quickSigns = [
    { label: 'Hello', word: 'HELLO', isMocap: true },
    { label: 'You', word: 'YOU', isMocap: true },
    { label: 'Please', word: 'PLEASE', isMocap: true },
    { label: 'My name is', word: 'MY NAME IS', isMocap: true },
    { label: 'Where', word: 'WHERE', isMocap: true },
    { label: 'Which', word: 'WHICH', isMocap: true },
    { label: 'This', word: 'THIS', isMocap: true },
    { label: 'Take', word: 'TAKE', isMocap: true },
    { label: 'Equal', word: 'EQUAL', isMocap: true },
    { label: 'Everyone', word: 'EVERYONE', isMocap: true },
    { label: 'Future', word: 'FUTURE', isMocap: true },
    { label: 'Or', word: 'OR', isMocap: true },
    { label: 'Turn Off', word: 'TURN OFF', isMocap: true },
  ];

  // Callback when new signs parsed from microphone or inputs
  const handleNewSignsParsed = useCallback((newSigns: typeof signQueue) => {
    setSignQueue((prev) => [...prev, ...newSigns]);
  }, []);

  // Speech Recognition Hook (Used for Live ASL signing performance)
  const {
    isListening,
    interimText,
    latestTranscribedText,
    audioLevel,
    audioFrequencies,
    transcriptHistory,
    toggleListening,
    triggerSimulatedSpeech,
    processFinalSpeech,
    clearHistory,
  } = useSpeechRecognition({
    continuous: settings.continuousListening,
    autoFingerspell: settings.autoFingerspellUnknown,
    onNewSignsParsed: handleNewSignsParsed,
  });

  // Dedicated speech recognition for transcribing text into the input field ONLY
  const [isDictatingInput, setIsDictatingInput] = useState(false);
  const inputRecognitionRef = useRef<any>(null);

  const toggleInputDictation = useCallback(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isDictatingInput) {
      try {
        inputRecognitionRef.current?.stop();
      } catch {}
      setIsDictatingInput(false);
      return;
    }

    // Free microphone if live mic is currently active
    if (isListening) {
      toggleListening();
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let baseText = quickInputText ? quickInputText.trim() + ' ' : '';

      recognition.onstart = () => {
        setIsDictatingInput(true);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalTrans = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const updated = (baseText + finalTrans + ' ' + interim).trim();
        setQuickInputText(updated);
        if (finalTrans) {
          baseText = (baseText + finalTrans + ' ').trim() + ' ';
        }
      };

      recognition.onerror = () => {
        setIsDictatingInput(false);
      };

      recognition.onend = () => {
        setIsDictatingInput(false);
      };

      inputRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start dictation:', err);
      setIsDictatingInput(false);
    }
  }, [isDictatingInput, quickInputText, isListening, toggleListening]);

  useEffect(() => {
    return () => {
      try {
        inputRecognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  // Close the bottom window if user clicks outside the dock/window
  useEffect(() => {
    if (!activeTab) return;

    const handlePointerDownOutside = (e: MouseEvent | PointerEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const dockEl = document.getElementById('app-bottom-dock');
      const navbarEl = document.getElementById('app-bottom-navbar');

      if (dockEl?.contains(target) || navbarEl?.contains(target)) {
        return;
      }

      if (
        target.closest('#settings-drawer') ||
        target.closest('#dictionary-modal') ||
        target.closest('#live-coordinate-hud')
      ) {
        return;
      }

      setActiveTab(null);
    };

    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handlePointerDownOutside);
    }, 60);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [activeTab]);

  // Current queue item
  const currentQueueItem = signQueue.length > 0 ? signQueue[0] : null;

  // Active StudioGalt word
  const activeStudioGaltWord = useMemo(() => {
    if (currentQueueItem && currentQueueItem.def?.studioGaltData) {
      return currentQueueItem.def.studioGaltData as StudioGaltWordEntry;
    }
    return selectedStudioGaltWord;
  }, [currentQueueItem, selectedStudioGaltWord]);

  // Handle Sign Item Completion
  const handleSignComplete = useCallback((id: string) => {
    setSignQueue((prev) => {
      const remaining = prev.filter((item) => item.id !== id);
      if (remaining.length === 0) {
        setCurrentSignName(null);
      }
      return remaining;
    });
  }, []);

  const handleSignStart = useCallback((name: string) => {
    setCurrentSignName(name);
    const match = STUDIO_GALT_DICTIONARY.find(
      (w) => w.word.toUpperCase() === name.toUpperCase()
    );
    if (match) {
      setSelectedStudioGaltWord(match);
      setActiveKeyposeIdx(0);
    }
  }, []);

  // Camera view angle cycle
  const handleCycleViewMode = () => {
    const modes: CameraViewMode[] = ['front', 'hands_closeup', 'upper_body', 'stage_orbit'];
    const nextIdx = (modes.indexOf(settings.viewMode) + 1) % modes.length;
    setSettings((prev) => ({ ...prev, viewMode: modes[nextIdx] }));
  };

  // Update Partial Settings
  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // Trigger sign directly by word string
  const handleTriggerWord = (word: string) => {
    const sign = ALL_SIGNS.find(s => s.gloss.toUpperCase() === word.toUpperCase());
    if (sign) handleTriggerSignFromDictionary(sign);
    else processFinalSpeech(word, 'keyboard');
  };

  // Trigger fingerspelling directly
  const handleTriggerLetter = (letter: string) => {
    const item = {
      type: 'letter' as const,
      id: `letter-${letter}-${Date.now()}`,
      name: letter,
      char: letter,
    };
    setSignQueue((prev) => [...prev, item]);
  };

  // Direct trigger from full dictionary modal
  const handleTriggerSignFromDictionary = (signDef: SignDefinition) => {
    if (signDef.studioGaltData) {
      setSelectedStudioGaltWord(signDef.studioGaltData);
      setActiveKeyposeIdx(0);
    }
    const item = {
      type: 'gloss' as const,
      id: `${signDef.gloss}-${Date.now()}`,
      name: signDef.gloss,
      def: signDef,
    };
    setSignQueue((prev) => [...prev, item]);
  };

  // Handle Tab Change from Bottom Navigation Bar
  const handleChangeTab = (tab: ActiveTab | null) => {
    setActiveTab(tab);
  };

  // Scrub or select keypose in HUD
  const handleSelectKeypose = (poseIdx: number) => {
    if (!activeStudioGaltWord || !activeStudioGaltWord.keyposes[poseIdx]) return;
    setActiveKeyposeIdx(poseIdx);
    const keypose = activeStudioGaltWord.keyposes[poseIdx];
    const pose = convertStudioGaltKeyposeToRigPose(keypose);
    setManualKeyframe({
      ...pose,
      durationMs: 400,
    });
  };

  const handleInspectCoordinates = (word: StudioGaltWordEntry) => {
    setSelectedStudioGaltWord(word);
    setActiveKeyposeIdx(0);
    setSettings((prev) => ({ ...prev, showBoneCoordinatesHud: true }));
  };

  // Derive bottom half drawer mode
  const bottomDrawerMode: BottomDrawerMode =
    activeTab === 'dictionary'
      ? 'dictionary'
      : activeTab === 'skins'
      ? 'skins'
      : activeTab === 'ai'
      ? 'ai'
      : null;

  // Check if active background is a 2D WebGL shader
  const isShaderBg = ['lightrays', 'lightfall', 'gradientwaves', 'aurora'].includes(stageBackground);

  return (
    <div className={`relative w-full h-dvh ${isShaderBg ? 'bg-[#090314]' : 'bg-[#26004d]'} overflow-hidden flex items-center justify-center font-sans antialiased text-white select-none transition-colors duration-500`}>
      {/* Main Viewport Container */}
      <main
        id="app-main-viewport"
        className={`relative w-full h-full min-h-0 mx-auto flex flex-col justify-between overflow-hidden ${isShaderBg ? 'bg-[#090314]' : 'bg-[#26004d]'} transition-colors duration-500`}
      >
        {/* 3D PURPLE STAGE & BACKGROUND (FULLSCREEN ACROSS ALL DEVICES) */}
        <div
          id="stage-panel"
          className={`absolute inset-0 w-full h-full overflow-hidden z-0 ${isShaderBg ? 'bg-transparent' : 'bg-[#26004d]'} transition-colors duration-500`}
        >
          {/* Animated WebGL Shader Background (Behind 3D Avatar) */}
          <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {stageBackground === 'lightrays' && (
              <LightRays
                raysOrigin="top-center"
                raysColor="#c084fc"
                raysSpeed={1.1}
                lightSpread={0.9}
                rayLength={1.6}
                followMouse={true}
                mouseInfluence={0.12}
                noiseAmount={0.06}
                distortion={0.03}
              />
            )}
            {stageBackground === 'lightfall' && (
              <Lightfall
                colors={['#A6C8FF', '#a855f7', '#f472b6']}
                backgroundColor="#1a0033"
                speed={0.7}
                streakCount={5}
                streakWidth={1.2}
                streakLength={1.3}
                glow={1.1}
                density={0.7}
                twinkle={1}
                zoom={2.2}
                backgroundGlow={0.6}
                opacity={1}
                mouseInteraction={true}
              />
            )}
            {stageBackground === 'gradientwaves' && (
              <GradientWaves
                horizonColor="#3b0764"
                waveColor="#7e22ce"
                crestColor="#f0abfc"
                speed={0.35}
                amplitude={2.2}
                waveScale={0.65}
                waveRatio={0.9}
                swell={30}
                turbulence={18}
                tilt={1.11}
                zoom={1.0}
                height={5.2}
                fogDepth={16}
                detail="medium"
                brightness={1.0}
                opacity={1.0}
                mouseInteraction={true}
              />
            )}
            {stageBackground === 'aurora' && (
              <Aurora
                colorStops={['#a855f7', '#06b6d4', '#ec4899']}
                blend={0.6}
                amplitude={1.2}
                speed={0.6}
              />
            )}
          </div>

          {/* 3D Canvas with avatar and stage */}
          <div className="absolute inset-0 w-full h-full z-10">
            <Stage3D
              companion={currentCompanion}
              currentSignQueueItem={currentQueueItem}
              onSignComplete={handleSignComplete}
              onSignStart={handleSignStart}
              speed={settings.signingSpeed}
              viewMode={settings.viewMode}
              showMist={settings.showMist}
              showSkeletalJoints={settings.showSkeletalJoints}
              onCoordinatesUpdate={setLiveCoordinates}
              manualKeyposeKeyframe={manualKeyframe}
              avatarSkin={avatarSkin}
              stageBackground={stageBackground}
            />
          </div>
        </div>

        {/* TOP STATUS BAR */}
        <div className="relative top-0 left-0 right-0 z-20 px-6 pt-3 pb-2 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Live Sign Activity Badge */}
            <div className="px-3 py-1 rounded-full bg-black/40 border border-purple-400/20 backdrop-blur-md flex items-center gap-2 shadow-lg">
              <span
                className={`w-2 h-2 rounded-full ${
                  currentSignName ? 'bg-teal-400 animate-ping' : 'bg-purple-300/60'
                }`}
              />
              <span className="text-xs font-semibold tracking-wide text-white/90">
                {currentSignName ? `SIGN: ${currentSignName}` : 'GALTIS 8 MoCap'}
              </span>
            </div>
          </div>

          {/* Quick Camera & Rig Telemetry Controls */}
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="flex items-center p-1 rounded-full bg-black/40 border border-white/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.35)] gap-1">
              {/* Camera View Mode Switcher */}
              <button
                onClick={handleCycleViewMode}
                title={`Camera Framing: ${settings.viewMode.replace('_', ' ').toUpperCase()} (Click to cycle)`}
                aria-label="Cycle camera framing"
                className="group flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-full bg-white/[0.07] hover:bg-white/[0.16] border border-white/10 hover:border-white/25 text-white transition-all duration-200 active:scale-95 shadow-sm"
              >
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-300 group-hover:text-purple-200 transition-colors" />
                <span className="text-[11px] sm:text-xs font-semibold tracking-wide text-white/90 group-hover:text-white">
                  {settings.viewMode === 'front'
                    ? 'Front'
                    : settings.viewMode === 'hands_closeup'
                    ? 'Hands'
                    : settings.viewMode === 'upper_body'
                    ? 'Body'
                    : 'Orbit'}
                </span>
              </button>

              {/* Live MoCap Skeleton Telemetry HUD Toggle */}
              <button
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    showBoneCoordinatesHud: !prev.showBoneCoordinatesHud,
                  }))
                }
                title={
                  settings.showBoneCoordinatesHud
                    ? 'Hide MoCap Skeletal HUD'
                    : 'Show MoCap Skeletal HUD'
                }
                aria-label="Toggle MoCap HUD"
                className={`group flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-full border transition-all duration-200 active:scale-95 ${
                  settings.showBoneCoordinatesHud
                    ? 'bg-teal-500/25 border-teal-400/80 text-teal-200 shadow-[0_0_14px_rgba(45,212,191,0.35)]'
                    : 'bg-white/[0.07] hover:bg-white/[0.16] border-white/10 hover:border-white/25 text-white/80 hover:text-white'
                }`}
              >
                <Activity
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${
                    settings.showBoneCoordinatesHud
                      ? 'text-teal-300 animate-pulse'
                      : 'text-purple-300 group-hover:text-purple-200'
                  }`}
                />
                <span className="text-[11px] sm:text-xs font-semibold tracking-wide">HUD</span>
                {settings.showBoneCoordinatesHud && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400" />
                  </span>
                )}
              </button>

              {/* Real-time Voice Transcription Toggle Button */}
              <button
                onClick={toggleListening}
                title={isListening ? 'Turn off real-time transcription mic' : 'Turn on real-time transcription mic'}
                aria-label="Toggle real-time voice transcription"
                className={`group flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-full border transition-all duration-200 active:scale-95 ${
                  isListening
                    ? 'bg-rose-500/25 border-rose-400/80 text-rose-200 shadow-[0_0_14px_rgba(244,63,94,0.4)] ring-1 ring-rose-400/40'
                    : 'bg-white/[0.07] hover:bg-white/[0.16] border-white/10 hover:border-white/25 text-white/80 hover:text-white'
                }`}
              >
                {isListening ? (
                  <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-300 animate-pulse" />
                ) : (
                  <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/60 group-hover:text-white/80" />
                )}
                <span className="text-[11px] sm:text-xs font-semibold tracking-wide">
                  {isListening ? 'Live' : 'Mic'}
                </span>
                {isListening && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400" />
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* REALTIME TRANSCRIPTION OVERLAY FIELD (Right above bottom dock, invisible background, white text) */}
        <div
          id="realtime-transcription-field"
          role="region"
          aria-live="polite"
          aria-label="Real-time Speech Transcription"
          className="fixed z-25 pointer-events-none flex flex-col items-center justify-end px-4"
          style={{
            bottom: `calc(${
              activeTab === 'skins'
                ? 320
                : activeTab === 'dictionary'
                ? 390
                : activeTab === 'ai'
                ? 440
                : 165
            }px + max(14px, env(safe-area-inset-bottom)) + 12px)`,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 1.5rem)',
            maxWidth: '560px',
            transition: 'bottom 360ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Live Audio Meter & Listening Indicator */}
          {isListening && (
            <div className="flex items-center gap-2 mb-1.5 opacity-90 transition-opacity">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400" />
              </span>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                {interimText ? 'Listening & Transcribing...' : 'Listening to Microphone...'}
              </span>
              {/* Dynamic waveform visualizer bars driven by live audioLevel */}
              <div className="flex items-center gap-0.5 h-3 ml-0.5">
                {[0.4, 0.9, 0.6, 1.0, 0.5, 0.8].map((mult, idx) => (
                  <span
                    key={idx}
                    className="w-0.5 rounded-full bg-rose-300/90 transition-all duration-75"
                    style={{
                      height: `${Math.max(3, Math.min(14, audioLevel * 14 * mult))}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Transcript text: invisible background, pure white text with high readability drop-shadow */}
          {(interimText || latestTranscribedText) ? (
            <div className="w-full text-center px-2 py-1 select-none">
              <p className="text-base sm:text-lg md:text-xl font-medium text-white tracking-wide leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                {interimText ? (
                  <span>
                    {latestTranscribedText && (
                      <span className="text-white/65 mr-1">{latestTranscribedText}</span>
                    )}
                    <span className="text-white italic underline decoration-rose-400/60 decoration-2 underline-offset-4">
                      {interimText}
                    </span>
                  </span>
                ) : (
                  <span>{latestTranscribedText}</span>
                )}
              </p>
            </div>
          ) : isListening ? (
            <div className="w-full text-center px-2 py-0.5 select-none">
              <p className="text-xs sm:text-sm text-white/70 italic tracking-wide drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                Speak into your mic to transcribe in real-time...
              </p>
            </div>
          ) : null}
        </div>

        {/* FLOATING LIVE MIC WITH 4 IRREGULAR SOUND-REACTIVE VERTICAL LINES (VISIBLE ONLY WHEN NAVBAR WINDOWS ARE CLOSED) */}
        {!activeTab && (
          <div
            id="floating-live-mic-widget"
            className="fixed z-30 pointer-events-auto flex items-center justify-center animate-fadeIn"
            style={{
              bottom: 'max(78px, calc(env(safe-area-inset-bottom) + 74px))',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            <button
              type="button"
              id="live-audio-pill-button"
              onClick={(e) => {
                e.stopPropagation();
                toggleListening();
              }}
              aria-label={isListening ? 'Stop live speech signing' : 'Start live speech signing'}
              title={isListening ? 'Live mic active - tap to stop' : 'Tap to start live mic'}
              className={`group relative flex items-center gap-3 px-4 py-2 rounded-full border transition-all duration-300 active:scale-95 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl ${
                isListening
                  ? 'bg-neutral-900/85 text-white border-purple-400/60 ring-2 ring-purple-500/30'
                  : 'bg-black/50 hover:bg-black/65 text-white/90 hover:text-white border-white/20 hover:border-white/40'
              }`}
            >
              {/* Mic Icon indicator */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white/10 text-white/75 group-hover:text-white group-hover:bg-white/20'
                }`}
              >
                <Mic className={`w-3.5 h-3.5 ${isListening ? 'animate-pulse' : ''}`} />
              </div>

              {/* Four irregular vertical sound bars that move dynamically according to audio intake */}
              <div
                className="flex items-center justify-center gap-1.5 h-7 px-1"
                aria-hidden="true"
              >
                {[
                  { baseH: 9, maxH: 26, mult: 1.3, idx: 0 },
                  { baseH: 15, maxH: 30, mult: 1.6, idx: 1 },
                  { baseH: 7, maxH: 22, mult: 1.1, idx: 2 },
                  { baseH: 12, maxH: 28, mult: 1.45, idx: 3 },
                ].map((bar) => {
                  const freq = audioFrequencies ? audioFrequencies[bar.idx] || 0 : 0;
                  const normLevel = (audioLevel || 0) / 100;
                  // Dynamic height responding in real-time to sound intake
                  const computedHeight = isListening
                    ? Math.min(
                        bar.maxH,
                        Math.max(
                          4,
                          bar.baseH + (freq * 0.7 + normLevel * 0.3) * (bar.maxH - 5) * bar.mult
                        )
                      )
                    : bar.baseH;

                  return (
                    <span
                      key={bar.idx}
                      className={`w-1 rounded-full transition-all duration-75 ${
                        isListening
                          ? 'bg-gradient-to-t from-purple-400 to-white shadow-[0_0_8px_rgba(192,132,252,0.6)]'
                          : 'bg-white/40 group-hover:bg-white/60'
                      }`}
                      style={{
                        height: `${computedHeight}px`,
                      }}
                    />
                  );
                })}
              </div>

              {/* Status Label */}
              <span className="text-xs font-semibold tracking-wide pr-1 select-none">
                {isListening ? (
                  <span className="text-purple-300">Live</span>
                ) : (
                  <span className="text-white/80">Tap to Talk</span>
                )}
              </span>
            </button>
          </div>
        )}

        {/* FIXED BOTTOM ANCHORED DOCK CONTAINER WITH SMOOTH UPWARD SLIDING ANIMATION */}
        <div
          id="app-bottom-dock"
          role="region"
          aria-label="Companion Navigation and Controls Dock"
          className={`glass-panel fixed z-30 pointer-events-auto flex flex-col overflow-hidden transition-all duration-300 ${
            activeTab ? 'rounded-[28px] sm:rounded-[32px]' : 'rounded-full'
          }`}
          style={{
            bottom: 'max(14px, env(safe-area-inset-bottom))',
            left: '50%',
            transform: 'translateX(-50%)',
            width: activeTab ? 'calc(100% - 1.5rem)' : 'calc(100% - 2rem)',
            maxWidth: activeTab ? '560px' : '340px',
            height: `${
              activeTab === 'skins'
                ? 330
                : activeTab === 'dictionary'
                ? 390
                : activeTab === 'ai'
                ? 440
                : activeTab === 'play'
                ? 165
                : 56
            }px`,
            maxHeight: 'min(calc(100dvh - 68px), 490px)',
            transition: 'height 360ms cubic-bezier(0.16, 1, 0.3, 1), max-width 360ms ease, width 360ms ease, border-radius 360ms ease',
            willChange: 'height, width',
          }}
        >
          {/* UPPER CONTENT AREA (EXPANDS UPWARD WHEN ACTIVE) */}
          {activeTab && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
              {activeTab === 'play' ? (
                <div className="w-full h-full flex flex-col justify-center gap-2 pt-3.5 pb-1 px-3.5 sm:px-4 animate-fadeIn">
                  {/* Quick Signs Horizontal Carousel */}
                  <div className="w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5 px-1">
                    {quickSigns.map((s) => (
                      <button
                        key={s.word}
                        type="button"
                        onClick={() => handleTriggerWord(s.word)}
                        className="shrink-0 px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 border border-white/20 text-xs font-medium text-white backdrop-blur-md flex items-center gap-1.5 transition shadow-sm"
                      >
                        {s.isMocap && <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Quick Input Bar with Dedicated Voice Dictation Button */}
                  <div className="w-full flex items-center gap-2">
                    <button
                      type="button"
                      id="input-dictate-button"
                      onClick={toggleInputDictation}
                      aria-label={isDictatingInput ? 'Stop voice dictation' : 'Dictate voice into input field'}
                      title={isDictatingInput ? 'Listening... Speak to type' : 'Dictate into text input'}
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border transition-all active:scale-95 shadow-md ${
                        isDictatingInput
                          ? 'bg-amber-500 border-amber-300 text-white animate-pulse ring-2 ring-amber-400/50'
                          : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/20 text-white/90 hover:text-white'
                      }`}
                    >
                      {isDictatingInput ? <Mic className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-white/80" />}
                    </button>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!quickInputText.trim()) return;
                        handleTriggerWord(quickInputText.trim());
                        setQuickInputText('');
                      }}
                      className="min-w-0 flex-1 flex items-center gap-2 bg-white/[0.08] border border-white/20 rounded-full px-3.5 py-1 backdrop-blur-md shadow-inner"
                    >
                      <input
                        type="text"
                        value={quickInputText}
                        onChange={(e) => setQuickInputText(e.target.value)}
                        placeholder={isDictatingInput ? 'Listening... Speak now to type' : 'Type words to sign...'}
                        className="min-w-0 flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-white/50 outline-none"
                      />
                      <button
                        type="submit"
                        aria-label="Send text to sign"
                        className="w-7 h-7 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shrink-0 transition shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
                  {/* Drag / Minimize Pull Handle Indicator */}
                  <div
                    onClick={() => setActiveTab(null)}
                    className="w-full flex items-center justify-center pt-2.5 pb-1 shrink-0 cursor-pointer group"
                    title="Click to close"
                  >
                    <div className="w-10 h-1 rounded-full bg-white/40 group-hover:bg-white/75 transition-colors" />
                  </div>

                  {/* Drawer Content */}
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <BottomHalfDrawer
                      mode={bottomDrawerMode}
                      onClose={() => setActiveTab(null)}
                      onSelectWord={handleTriggerWord}
                      currentSignName={currentSignName}
                      activeSkin={avatarSkin}
                      onSelectSkin={(skin) => setAvatarSkin(skin)}
                      activeBackground={stageBackground}
                      onSelectBackground={(bg) => setStageBackground(bg)}
                      isListening={isListening}
                      onToggleListening={toggleListening}
                      audioLevel={audioLevel}
                      interimText={interimText}
                      transcriptHistory={transcriptHistory}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BOTTOM EMBEDDED NAVBAR - ALWAYS ANCHORED AT FIXED BOTTOM POSITION */}
          <div className={`w-full flex items-center justify-center shrink-0 ${
            activeTab ? 'px-3 pt-1 pb-2 sm:pb-2.5 border-t border-white/10' : 'h-full p-1.5 border-t-0'
          }`}>
            <BottomNavBar
              activeTab={activeTab}
              onChangeTab={handleChangeTab}
              embedded
            />
          </div>
        </div>

        {/* DRAG-TO-OPEN & DRAG-TO-CLOSE SETTINGS DRAWER */}
        <SettingsDrawer
          isOpen={isDrawerOpen}
          onOpen={() => setIsDrawerOpen(true)}
          onClose={() => setIsDrawerOpen(false)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          currentCompanion={currentCompanion}
          onSelectCompanion={setCurrentCompanion}
          onOpenDictionary={() => setIsFullDictionaryModalOpen(true)}
          onRequestWord={handleTriggerWord}
          transcriptHistory={transcriptHistory}
        />

        {/* Full Modal ASL & StudioGalt MoCap Dictionary */}
        <SignDictionaryModal
          isOpen={isFullDictionaryModalOpen}
          onClose={() => setIsFullDictionaryModalOpen(false)}
          companion={currentCompanion}
          onTriggerSign={handleTriggerSignFromDictionary}
          onTriggerFingerspell={handleTriggerLetter}
          onInspectCoordinates={handleInspectCoordinates}
        />

        {/* Live StudioGalt MoCap Bone Coordinates HUD Inspector */}
        <LiveCoordinateHud
          isOpen={settings.showBoneCoordinatesHud}
          onClose={() => setSettings((prev) => ({ ...prev, showBoneCoordinatesHud: false }))}
          companion={currentCompanion}
          coordinates={liveCoordinates}
          activeStudioGaltWord={activeStudioGaltWord}
          onSelectKeypose={handleSelectKeypose}
          activeKeyposeIdx={activeKeyposeIdx}
        />
      </main>
    </div>
  );
}
