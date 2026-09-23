import React, { useState, useRef, useCallback, useEffect } from 'react';
import { RecordedSignData, getSupportedVideoMimeType } from '../utils/mediaExporter';

interface UseAvatarRecorderReturn {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  isRecording: boolean;
  hasNewRecording: boolean;
  lastRecordedSign: RecordedSignData | null;
  startRecording: (initialWord?: string) => void;
  trackWord: (word: string) => void;
  stopRecording: () => void;
  clearNewRecordingBadge: () => void;
  setRecordedSign: (data: RecordedSignData) => void;
}

export function useAvatarRecorder(): UseAvatarRecorderReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingWordsRef = useRef<string[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [hasNewRecording, setHasNewRecording] = useState(false);
  const [lastRecordedSign, setLastRecordedSign] = useState<RecordedSignData | null>(null);

  const clearNewRecordingBadge = useCallback(() => {
    setHasNewRecording(false);
  }, []);

  const trackWord = useCallback((word: string) => {
    if (!word) return;
    const clean = word.trim().toUpperCase();
    if (!recordingWordsRef.current.includes(clean)) {
      recordingWordsRef.current.push(clean);
    }
  }, []);

  const startRecording = useCallback((initialWord?: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Clear any pending stop timeouts
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }

    // If already recording, just add word and continue
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      if (initialWord) trackWord(initialWord);
      return;
    }

    try {
      recordedChunksRef.current = [];
      recordingWordsRef.current = initialWord ? [initialWord.trim().toUpperCase()] : [];
      recordingStartTimeRef.current = performance.now();

      // Capture canvas stream at 30 FPS
      const stream = canvas.captureStream(30);
      const mimeType = getSupportedVideoMimeType();

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        setIsRecording(false);
        const durationSec = Math.max(
          0.8,
          (performance.now() - recordingStartTimeRef.current) / 1000
        );

        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const wordsStr = recordingWordsRef.current.join(' ') || 'SIGN';

          setLastRecordedSign({
            id: `rec-${Date.now()}`,
            blob,
            url,
            words: wordsStr,
            duration: durationSec,
            timestamp: Date.now(),
          });
          setHasNewRecording(true);
        }
      };

      recorder.start(150);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.warn('Canvas recording initialization failed:', err);
    }
  }, [trackWord]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
      return;
    }

    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
    }

    // Allow 350ms buffer for avatar to finish animation transition smoothly
    stopTimeoutRef.current = setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.warn('Error stopping MediaRecorder:', e);
        }
      }
    }, 350);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
    };
  }, []);

  return {
    canvasRef,
    isRecording,
    hasNewRecording,
    lastRecordedSign,
    startRecording,
    trackWord,
    stopRecording,
    clearNewRecordingBadge,
    setRecordedSign: setLastRecordedSign,
  };
}
