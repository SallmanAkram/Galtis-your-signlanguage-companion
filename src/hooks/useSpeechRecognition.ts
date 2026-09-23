import { useState, useEffect, useRef, useCallback } from 'react';
import { TranscriptItem } from '../types';
import { parseSpeechToSigns } from '../data/aslDictionary';

interface UseSpeechRecognitionOptions {
  continuous?: boolean;
  autoFingerspell?: boolean;
  onNewSignsParsed?: (signs: { type: 'gloss' | 'letter'; id: string; name: string; def?: any; char?: string }[]) => void;
}

export function useSpeechRecognition({
  continuous = true,
  autoFingerspell = true,
  onNewSignsParsed,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptItem[]>([]);
  const [interimText, setInterimText] = useState('');
  const [latestTranscribedText, setLatestTranscribedText] = useState('');
  const [activeSpeechPill, setActiveSpeechPill] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioFrequencies, setAudioFrequencies] = useState<[number, number, number, number]>([0, 0, 0, 0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeEngineRef = useRef<'native' | 'media_recorder' | null>(null);
  const hasReceivedNativeResultsRef = useRef(false);
  const isManuallyStoppedRef = useRef(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Check browser speech recognition & media recording support
  useEffect(() => {
    const hasWebSpeech = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    const hasMediaDevices = typeof navigator !== 'undefined' && !!(navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined');

    setIsSupported(hasWebSpeech || hasMediaDevices);

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setErrorMsg('Microphone & Camera require HTTPS or http://localhost when accessing from mobile devices. Please open the HTTPS development URL.');
    }
  }, []);

  // Process finalized text into ASL sign queue and history
  const processFinalSpeech = useCallback((text: string, source: 'mic' | 'quick_prompt' | 'keyboard' = 'mic') => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const { tokens, signQueue } = parseSpeechToSigns(trimmed, autoFingerspell);
    const signNames = signQueue.map(s => s.name);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newItem: TranscriptItem = {
      id: `transcript-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: trimmed,
      timestamp: timeStr,
      signs: signNames,
      isCompleted: false,
      source,
    };

    setTranscriptHistory(prev => [newItem, ...prev].slice(0, 50));
    setActiveSpeechPill(trimmed);
    setLatestTranscribedText(trimmed);

    if (onNewSignsParsed && signQueue.length > 0) {
      onNewSignsParsed(signQueue);
    }
  }, [autoFingerspell, onNewSignsParsed]);

  // Connect an audio MediaStream to Web Audio API for Grok waveform visualization
  const attachAudioMeterStream = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch {}
      }

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));

        // Divide frequencies into 4 distinct bands for the 4 visualizer lines
        const quarter = Math.max(1, Math.floor(bufferLength / 4));
        const b1 = dataArray.slice(0, quarter).reduce((a, b) => a + b, 0) / (quarter * 255);
        const b2 = dataArray.slice(quarter, quarter * 2).reduce((a, b) => a + b, 0) / (quarter * 255);
        const b3 = dataArray.slice(quarter * 2, quarter * 3).reduce((a, b) => a + b, 0) / (quarter * 255);
        const b4 = dataArray.slice(quarter * 3).reduce((a, b) => a + b, 0) / (quarter * 255);
        setAudioFrequencies([b1, b2, b3, b4]);

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      updateMeter();
    } catch (err) {
      console.warn('Audio meter initialization error:', err);
    }
  }, []);

  // Request audio meter stream if not already provided
  const startAudioMeter = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Audio level fallback loop if mic permission blocked or in restricted context
      const fallbackLoop = () => {
        if (!isListening) return;
        const base = 0.2 + Math.random() * 0.5;
        setAudioLevel(Math.floor(base * 100));
        setAudioFrequencies([
          Math.min(1, base * (0.6 + Math.random() * 0.7)),
          Math.min(1, base * (0.9 + Math.random() * 0.8)),
          Math.min(1, base * (0.5 + Math.random() * 0.9)),
          Math.min(1, base * (0.7 + Math.random() * 0.6)),
        ]);
        animFrameRef.current = requestAnimationFrame(fallbackLoop);
      };
      fallbackLoop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      attachAudioMeterStream(stream);
    } catch (err) {
      console.warn('Could not start audio meter from mic:', err);
    }
  }, [attachAudioMeterStream, isListening]);

  const stopAudioMeter = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
    setAudioFrequencies([0, 0, 0, 0]);
  }, []);

  // Send recorded audio blob to /api/transcribe (powered by Gemini)
  const sendAudioForTranscription = useCallback(async (blob: Blob) => {
    if (blob.size < 400) return;

    try {
      setIsTranscribing(true);
      setInterimText('Transcribing audio with AI...');

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': blob.type || 'audio/webm',
        },
        body: blob,
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('AI transcription service not found. For direct native voice recognition, use Google Chrome, Edge, or Safari.');
        }
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setInterimText('');

      if (data.text && data.text.trim()) {
        processFinalSpeech(data.text.trim(), 'mic');
      } else if (data.warning) {
        setErrorMsg(data.warning);
      }
    } catch (err: any) {
      console.warn('Transcription request error:', err);
      setInterimText('');
      setErrorMsg(err?.message?.includes('Chrome') ? err.message : 'Could not transcribe audio. Check server connection or use Quick Prompts.');
    } finally {
      setIsTranscribing(false);
    }
  }, [processFinalSpeech]);

  // Fallback MediaRecorder implementation for Firefox, Brave, and unsupported Web Speech browsers
  const startMediaRecorderFallback = useCallback(async () => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setErrorMsg('Microphone & Camera require HTTPS or http://localhost when accessing from mobile devices. Please open the HTTPS development URL.');
      setIsListening(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Microphone access is not supported in this browser context. Please use Quick Prompts or Keyboard Input.');
      setIsListening(false);
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setErrorMsg('MediaRecorder is not supported in this browser.');
      setIsListening(false);
      return;
    }

    try {
      isManuallyStoppedRef.current = false;
      setErrorMsg(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      attachAudioMeterStream(stream);

      // Determine best supported container MIME type
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        '',
      ].find(type => type === '' || MediaRecorder.isTypeSupported(type)) || '';

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      activeEngineRef.current = 'media_recorder';

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const chunks = [...audioChunksRef.current];
        audioChunksRef.current = [];
        if (chunks.length > 0) {
          const recordedBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          await sendAudioForTranscription(recordedBlob);
        }

        if (!isManuallyStoppedRef.current && continuous) {
          // Restart recording slice if still in continuous mode
          try {
            if (mediaStreamRef.current && mediaStreamRef.current.active) {
              recorder.start(1000);
              return;
            }
          } catch {}
        }

        setIsListening(false);
        stopAudioMeter();
        activeEngineRef.current = null;
      };

      recorder.start(1000);
      setIsListening(true);
      setInterimText('Recording voice... tap mic again when done');
    } catch (err: any) {
      console.warn('MediaRecorder fallback failed to start:', err);
      setErrorMsg(
        err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
          ? 'Microphone permission denied. Please allow microphone access in browser settings.'
          : window.isSecureContext === false
          ? 'Microphone requires HTTPS when accessed from a mobile device on local IP.'
          : (err?.message || 'Could not access microphone')
      );
      setIsListening(false);
      stopAudioMeter();
      activeEngineRef.current = null;
    }
  }, [attachAudioMeterStream, continuous, sendAudioForTranscription, stopAudioMeter]);

  // Start listening (Hybrid strategy: Web Speech primary, MediaRecorder fallback)
  const startListening = useCallback(() => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setErrorMsg('Microphone & Camera require HTTPS or http://localhost when accessing from mobile devices. Please open the HTTPS development URL.');
    }

    const SpeechRec = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

    // If Web Speech API is completely absent (e.g. Firefox), directly use MediaRecorder
    if (!SpeechRec) {
      startMediaRecorderFallback();
      return;
    }

    isManuallyStoppedRef.current = false;
    hasReceivedNativeResultsRef.current = false;
    setErrorMsg(null);

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }

      const recognition = new SpeechRec();
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        activeEngineRef.current = 'native';
        startAudioMeter();
      };

      recognition.onresult = (event: any) => {
        hasReceivedNativeResultsRef.current = true;
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        setInterimText(interim);

        if (final.trim()) {
          processFinalSpeech(final, 'mic');
          setInterimText('');
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Native speech recognition error:', event.error);

        // In browsers like Brave or privacy setups that block Google Speech backend,
        // automatically switch to MediaRecorder + Gemini fallback!
        if (
          (event.error === 'service-not-allowed' || event.error === 'network' || event.error === 'audio-capture') &&
          !hasReceivedNativeResultsRef.current
        ) {
          console.info('Switching to MediaRecorder transcription fallback due to:', event.error);
          try { recognition.stop(); } catch {}
          startMediaRecorderFallback();
          return;
        }

        if (event.error === 'not-allowed') {
          setErrorMsg(
            window.isSecureContext === false
              ? 'Microphone access requires HTTPS when accessing from mobile devices.'
              : 'Microphone access denied. Please enable microphone permissions in your browser.'
          );
        } else if (event.error !== 'no-speech') {
          setErrorMsg(`Mic note: ${event.error}. Listening continues.`);
        }
      };

      recognition.onend = () => {
        if (activeEngineRef.current !== 'native') return;

        // Auto restart if continuous and not manually stopped
        if (!isManuallyStoppedRef.current && continuous) {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
            stopAudioMeter();
            activeEngineRef.current = null;
          }
        } else {
          setIsListening(false);
          stopAudioMeter();
          activeEngineRef.current = null;
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err: any) {
      console.warn('Failed to start native SpeechRecognition, falling back:', err);
      startMediaRecorderFallback();
    }
  }, [continuous, processFinalSpeech, startAudioMeter, startMediaRecorderFallback, stopAudioMeter]);

  // Stop listening
  const stopListening = useCallback(() => {
    isManuallyStoppedRef.current = true;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    setIsListening(false);
    stopAudioMeter();
  }, [stopAudioMeter]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Fallback simulator for quick speech button (e.g. "Hello! Thank you!")
  const triggerSimulatedSpeech = useCallback((phrase: string) => {
    processFinalSpeech(phrase, 'quick_prompt');
  }, [processFinalSpeech]);

  // Clear history
  const clearHistory = useCallback(() => {
    setTranscriptHistory([]);
    setActiveSpeechPill(null);
    setLatestTranscribedText('');
    setInterimText('');
  }, []);

  return {
    isListening,
    isSupported,
    isTranscribing,
    interimText,
    latestTranscribedText,
    setLatestTranscribedText,
    activeSpeechPill,
    audioLevel,
    audioFrequencies,
    errorMsg,
    setErrorMsg,
    transcriptHistory,
    startListening,
    stopListening,
    toggleListening,
    triggerSimulatedSpeech,
    processFinalSpeech,
    clearHistory,
  };
}
