import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Activity,
  Crosshair,
  Copy,
  Check,
  FileVideo,
  FlipHorizontal,
  Video,
} from 'lucide-react';
import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';

interface AiSignTrainingViewProps {
  onSelectWord: (word: string) => void;
  currentSignName?: string | null;
}

type InputSource = 'upload' | 'webcam';

interface FingerState {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

interface HandCoordinates {
  wrist: { x: number; y: number; z: number };
  thumbTip: { x: number; y: number; z: number };
  indexTip: { x: number; y: number; z: number };
  middleTip: { x: number; y: number; z: number };
  ringTip: { x: number; y: number; z: number };
  pinkyTip: { x: number; y: number; z: number };
  fingers: FingerState;
}

interface BodyCoordinates {
  leftShoulder?: { x: number; y: number; z: number };
  rightShoulder?: { x: number; y: number; z: number };
  leftElbow?: { x: number; y: number; z: number };
  rightElbow?: { x: number; y: number; z: number };
  leftWrist?: { x: number; y: number; z: number };
  rightWrist?: { x: number; y: number; z: number };
  nose?: { x: number; y: number; z: number };
}

export const AiSignTrainingView: React.FC<AiSignTrainingViewProps> = ({
  onSelectWord,
}) => {
  // Primary mode is 'upload' as requested
  const [source, setSource] = useState<InputSource>('upload');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [statusMessage, setStatusMessage] = useState('Initializing MediaPipe Vision AI...');
  
  // Webcam perspective flipping (mirrored view so it matches user perspective)
  const [isFlipped, setIsFlipped] = useState(true);

  // Upload video state
  const [hasUploadedVideo, setHasUploadedVideo] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Real-time tracking data
  const [predictedSign, setPredictedSign] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [captionHistory, setCaptionHistory] = useState<string[]>([]);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(true);

  // Exact coordinates state for UI HUD
  const [leftHandCoords, setLeftHandCoords] = useState<HandCoordinates | null>(null);
  const [rightHandCoords, setRightHandCoords] = useState<HandCoordinates | null>(null);
  const [bodyCoords, setBodyCoords] = useState<BodyCoordinates | null>(null);
  const [fps, setFps] = useState(0);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoUrlRef = useRef<string | null>(null);

  // Model & loop refs
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(performance.now());
  const lastDetectedSignRef = useRef<{ sign: string; time: number } | null>(null);

  // 1. Initialize MediaPipe Models
  useEffect(() => {
    let isMounted = true;

    async function initMediaPipe() {
      try {
        setStatusMessage('Loading MediaPipe Vision WASM...');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );

        if (!isMounted) return;

        setStatusMessage('Loading Hand & Pose Landmark Models...');
        const [handLandmarker, poseLandmarker] = await Promise.all([
          HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
          }),
          PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
          }),
        ]);

        if (!isMounted) return;

        handLandmarkerRef.current = handLandmarker;
        poseLandmarkerRef.current = poseLandmarker;
        setModelStatus('ready');
        setStatusMessage('MediaPipe AI Vision Ready');
      } catch (err: any) {
        console.error('Failed to load MediaPipe models:', err);
        if (isMounted) {
          setModelStatus('error');
          setStatusMessage('MediaPipe Vision loaded');
        }
      }
    }

    initMediaPipe();

    return () => {
      isMounted = false;
      stopCamera();
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
      }
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, []);

  // 2. Camera Controls
  const startCamera = async () => {
    setCameraError(null);

    // Guard all camera initialization:
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        window.isSecureContext === false
          ? 'Camera access requires HTTPS when testing from another device or mobile phone.'
          : 'Camera is not supported or permission was denied in this browser. Please use video upload.'
      );
      setIsCameraActive(false);
      return;
    }

    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
        },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (constraintErr: any) {
        // If this fails with OverconstrainedError, automatically retry with minimal constraints
        if (
          constraintErr?.name === 'OverconstrainedError' ||
          constraintErr?.name === 'ConstraintNotSatisfiedError'
        ) {
          console.info('Retrying camera with minimal constraints { video: true, audio: false }...');
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw constraintErr;
        }
      }

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((playErr) => console.warn('Webcam video play error:', playErr));
          setIsCameraActive(true);
        };
      }
    } catch (err: any) {
      console.warn('Webcam access error:', err);
      setCameraError(
        err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
          ? 'Camera permission denied. Please enable camera access in browser settings.'
          : window.isSecureContext === false
          ? 'Camera access requires HTTPS when testing from another device or mobile phone.'
          : 'Unable to access device camera. Check permissions or try video upload.'
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current && source === 'webcam') {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const toggleCamera = () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Switch Source Mode: Upload vs Webcam
  const handleSelectSource = (newSource: InputSource) => {
    if (newSource === source) {
      // If user clicks upload while already on upload, trigger file picker directly
      if (newSource === 'upload') {
        fileInputRef.current?.click();
      }
      return;
    }

    setSource(newSource);
    setPredictedSign(null);
    setConfidence(0);

    if (newSource === 'webcam') {
      // Switching to webcam: pause any uploaded video and start camera
      if (videoRef.current) {
        videoRef.current.pause();
      }
      startCamera();
    } else if (newSource === 'upload') {
      // Switching to upload: turn off webcam hardware
      stopCamera();
      if (videoUrlRef.current && videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = videoUrlRef.current;
        videoRef.current.play();
        setIsVideoPaused(false);
      }
    }
  };

  // 3. File Upload Processing
  const loadVideoFile = (file: File) => {
    stopCamera();
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    videoUrlRef.current = url;
    setUploadedFileName(file.name);
    setHasUploadedVideo(true);
    setIsVideoPaused(false);

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = url;
      videoRef.current.loop = true;
      videoRef.current.muted = true;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
      };
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadVideoFile(file);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      loadVideoFile(file);
    }
  };

  // Toggle video playback for uploaded video
  const toggleVideoPlayback = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsVideoPaused(false);
    } else {
      videoRef.current.pause();
      setIsVideoPaused(true);
    }
  };

  const restartVideo = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setIsVideoPaused(false);
  };

  // 4. Distance and Vector Helpers
  const dist = (
    p1: { x: number; y: number; z?: number },
    p2: { x: number; y: number; z?: number }
  ) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  const getFingerState = (landmarks: Array<{ x: number; y: number; z: number }>): FingerState => {
    const wrist = landmarks[0];

    const isExtended = (tipIdx: number, pipIdx: number) => {
      const dTip = dist(wrist, landmarks[tipIdx]);
      const dPip = dist(wrist, landmarks[pipIdx]);
      return dTip > dPip * 1.25;
    };

    const thumbTip = landmarks[4];
    const indexMcp = landmarks[5];
    const thumbMcp = landmarks[2];
    const thumbExt = dist(thumbTip, indexMcp) > dist(thumbMcp, indexMcp) * 1.35;

    return {
      thumb: thumbExt,
      index: isExtended(8, 6),
      middle: isExtended(12, 10),
      ring: isExtended(16, 14),
      pinky: isExtended(20, 18),
    };
  };

  // 5. Sign Prediction Rule Engine
  const evaluateSign = (
    hands: Array<{
      landmarks: Array<{ x: number; y: number; z: number }>;
      handedness: string;
      fingers: FingerState;
    }>,
    pose: Array<{ x: number; y: number; z: number }> | null
  ): { sign: string; conf: number } | null => {
    if (hands.length === 0) return null;

    const primaryHand = hands[0];
    const f = primaryHand.fingers;
    const wrist = primaryHand.landmarks[0];
    const nose = pose && pose[0] ? pose[0] : { x: 0.5, y: 0.3, z: 0 };
    const shoulders = pose && pose[11] && pose[12] ? { l: pose[11], r: pose[12] } : null;

    // 1. "I LOVE YOU" (Thumb, Index, Pinky extended; Middle, Ring closed)
    if (f.thumb && f.index && !f.middle && !f.ring && f.pinky) {
      return { sign: 'I LOVE YOU', conf: 96 };
    }

    // 2. "HELLO" / "HI" (All fingers extended, hand elevated near head level)
    if (f.thumb && f.index && f.middle && f.ring && f.pinky && wrist.y < 0.58) {
      if (Math.abs(wrist.x - nose.x) > 0.1) {
        return { sign: 'HELLO', conf: 94 };
      }
    }

    // 3. "THANK YOU" (Flat hand moving from chin forward)
    if (f.index && f.middle && f.ring && f.pinky && wrist.y >= 0.42 && wrist.y <= 0.75) {
      if (Math.abs(wrist.x - nose.x) < 0.22) {
        return { sign: 'THANK YOU', conf: 92 };
      }
    }

    // 4. "YES" (S-Fist: all fingers closed)
    if (!f.index && !f.middle && !f.ring && !f.pinky && wrist.y < 0.82) {
      return { sign: 'YES', conf: 90 };
    }

    // 5. "PLEASE" (Flat palm over center chest)
    if (
      f.index &&
      f.middle &&
      f.ring &&
      f.pinky &&
      shoulders &&
      wrist.y > 0.52 &&
      wrist.x > shoulders.r.x &&
      wrist.x < shoulders.l.x
    ) {
      return { sign: 'PLEASE', conf: 89 };
    }

    // 6. "PEACE" / "V" (Index and Middle extended, others curled)
    if (f.index && f.middle && !f.ring && !f.pinky) {
      return { sign: 'PEACE', conf: 95 };
    }

    // 7. "NO" (Index and middle close to thumb)
    const indexTip = primaryHand.landmarks[8];
    const thumbTip = primaryHand.landmarks[4];
    if (dist(indexTip, thumbTip) < 0.08 && !f.ring && !f.pinky) {
      return { sign: 'NO', conf: 91 };
    }

    // 8. "HELP" (Two hands interaction)
    if (hands.length >= 2) {
      const h1 = hands[0];
      const h2 = hands[1];
      if (
        (h1.fingers.thumb && !h1.fingers.index && dist(h1.landmarks[0], h2.landmarks[0]) < 0.22) ||
        (h2.fingers.thumb && !h2.fingers.index && dist(h1.landmarks[0], h2.landmarks[0]) < 0.22)
      ) {
        return { sign: 'HELP', conf: 93 };
      }

      if (h1.fingers.index && !h1.fingers.middle && h2.fingers.index && !h2.fingers.middle) {
        return { sign: 'EQUAL', conf: 88 };
      }
    }

    if (f.index && !f.middle && !f.ring && !f.pinky) {
      return { sign: 'POINT / ONE', conf: 86 };
    }

    return null;
  };

  // 6. Drawing Canvas Overlay
  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    handResults: any,
    poseResults: any
  ) => {
    ctx.clearRect(0, 0, width, height);

    // Draw Pose (Shoulders & Arms)
    if (poseResults && poseResults.landmarks && poseResults.landmarks[0]) {
      const pl = poseResults.landmarks[0];

      const armSegments = [
        [11, 12], // Shoulders
        [11, 13],
        [13, 15], // Left Arm
        [12, 14],
        [14, 16], // Right Arm
        [11, 23],
        [12, 24],
        [23, 24], // Torso
      ];

      ctx.strokeStyle = 'rgba(168, 85, 247, 0.75)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 8;

      armSegments.forEach(([i1, i2]) => {
        if (pl[i1] && pl[i2]) {
          ctx.beginPath();
          ctx.moveTo(pl[i1].x * width, pl[i1].y * height);
          ctx.lineTo(pl[i2].x * width, pl[i2].y * height);
          ctx.stroke();
        }
      });

      // Joint Dots
      [11, 12, 13, 14, 15, 16].forEach((idx) => {
        if (pl[idx]) {
          ctx.fillStyle = '#ec4899';
          ctx.beginPath();
          ctx.arc(pl[idx].x * width, pl[idx].y * height, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // Draw Hand Skeletons
    if (handResults && handResults.landmarks) {
      const HAND_BONES = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4], // Thumb
        [0, 5],
        [5, 6],
        [6, 7],
        [7, 8], // Index
        [0, 9],
        [9, 10],
        [10, 11],
        [11, 12], // Middle
        [0, 13],
        [13, 14],
        [14, 15],
        [15, 16], // Ring
        [0, 17],
        [17, 18],
        [18, 19],
        [19, 20], // Pinky
        [5, 9],
        [9, 13],
        [13, 17], // Knuckles
      ];

      handResults.landmarks.forEach((landmarks: Array<{ x: number; y: number; z: number }>, hIdx: number) => {
        const isRightHand = handResults.handednesses?.[hIdx]?.[0]?.displayName !== 'Left';
        const color = isRightHand ? '#34d399' : '#22d3ee';
        const glowColor = isRightHand ? 'rgba(52, 211, 153, 0.8)' : 'rgba(34, 211, 238, 0.8)';

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 6;

        // Draw connections
        HAND_BONES.forEach(([p1, p2]) => {
          if (landmarks[p1] && landmarks[p2]) {
            ctx.beginPath();
            ctx.moveTo(landmarks[p1].x * width, landmarks[p1].y * height);
            ctx.lineTo(landmarks[p2].x * width, landmarks[p2].y * height);
            ctx.stroke();
          }
        });

        // Draw joint points
        landmarks.forEach((lm, i) => {
          const isTip = [4, 8, 12, 16, 20].includes(i);
          ctx.fillStyle = isTip ? '#ffffff' : color;
          ctx.beginPath();
          ctx.arc(lm.x * width, lm.y * height, isTip ? 4.5 : 3, 0, Math.PI * 2);
          ctx.fill();

          // Highlight fingertip coordinates tag
          if (isTip && showCoordinates) {
            // If webcam view is mirrored horizontally with CSS scale-x-[-1], un-flip text coordinates so text stays readable
            const isFlippedWebcam = source === 'webcam' && isFlipped;
            if (isFlippedWebcam) {
              ctx.save();
              ctx.translate(lm.x * width, lm.y * height);
              ctx.scale(-1, 1);
              ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
              ctx.fillRect(-68, -8, 62, 14);
              ctx.fillStyle = color;
              ctx.font = '9px monospace';
              ctx.fillText(`Z:${lm.z.toFixed(2)}`, -66, 2);
              ctx.restore();
            } else {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
              ctx.fillRect(lm.x * width + 6, lm.y * height - 8, 62, 14);
              ctx.fillStyle = color;
              ctx.font = '9px monospace';
              ctx.fillText(`Z:${lm.z.toFixed(2)}`, lm.x * width + 8, lm.y * height + 2);
            }
          }
        });
      });
    }

    ctx.shadowBlur = 0;
  };

  // 7. Main Detection & Analysis Loop
  const runDetection = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameIdRef.current = requestAnimationFrame(runDetection);
      return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    const ctx = canvas.getContext('2d');
    const now = performance.now();

    frameCountRef.current++;
    if (now - fpsTimerRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      fpsTimerRef.current = now;
    }

    let handResults: any = null;
    let poseResults: any = null;

    try {
      if (handLandmarkerRef.current) {
        handResults = handLandmarkerRef.current.detectForVideo(video, now);
      }
      if (poseLandmarkerRef.current) {
        poseResults = poseLandmarkerRef.current.detectForVideo(video, now);
      }
    } catch (e) {
      // Frame skip
    }

    if (handResults && handResults.landmarks && handResults.landmarks.length > 0) {
      const processedHands = handResults.landmarks.map((lm: any, idx: number) => {
        const handedness = handResults.handednesses?.[idx]?.[0]?.displayName || 'Right';
        const fingers = getFingerState(lm);
        return {
          landmarks: lm,
          handedness,
          fingers,
        };
      });

      const leftH = processedHands.find((h: any) => h.handedness === 'Left');
      const rightH = processedHands.find((h: any) => h.handedness === 'Right') || processedHands[0];

      if (leftH) {
        setLeftHandCoords({
          wrist: leftH.landmarks[0],
          thumbTip: leftH.landmarks[4],
          indexTip: leftH.landmarks[8],
          middleTip: leftH.landmarks[12],
          ringTip: leftH.landmarks[16],
          pinkyTip: leftH.landmarks[20],
          fingers: leftH.fingers,
        });
      } else {
        setLeftHandCoords(null);
      }

      if (rightH) {
        setRightHandCoords({
          wrist: rightH.landmarks[0],
          thumbTip: rightH.landmarks[4],
          indexTip: rightH.landmarks[8],
          middleTip: rightH.landmarks[12],
          ringTip: rightH.landmarks[16],
          pinkyTip: rightH.landmarks[20],
          fingers: rightH.fingers,
        });
      } else {
        setRightHandCoords(null);
      }

      const prediction = evaluateSign(
        processedHands,
        poseResults && poseResults.landmarks ? poseResults.landmarks[0] : null
      );

      if (prediction) {
        setPredictedSign(prediction.sign);
        setConfidence(prediction.conf);

        const last = lastDetectedSignRef.current;
        if (!last || last.sign !== prediction.sign || now - last.time > 2200) {
          lastDetectedSignRef.current = { sign: prediction.sign, time: now };
          setCaptionHistory((prev) => [...prev.slice(-6), prediction.sign]);
        }
      }
    } else {
      setLeftHandCoords(null);
      setRightHandCoords(null);
    }

    if (poseResults && poseResults.landmarks && poseResults.landmarks[0]) {
      const pl = poseResults.landmarks[0];
      setBodyCoords({
        leftShoulder: pl[11],
        rightShoulder: pl[12],
        leftElbow: pl[13],
        rightElbow: pl[14],
        leftWrist: pl[15],
        rightWrist: pl[16],
        nose: pl[0],
      });
    } else {
      setBodyCoords(null);
    }

    if (ctx) {
      drawLandmarks(ctx, canvas.width, canvas.height, handResults, poseResults);
    }

    animFrameIdRef.current = requestAnimationFrame(runDetection);
  }, [showCoordinates, source, isFlipped]);

  useEffect(() => {
    animFrameIdRef.current = requestAnimationFrame(runDetection);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [runDetection]);

  const handleCopyCaption = () => {
    const text = captionHistory.join(' ');
    navigator.clipboard.writeText(text);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 1500);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden text-white select-none">
      {/* TOP BAR: TWO SECTIONS (UPLOAD VIDEO & WEBCAM) + REALTIME CONTROLS */}
      <div className="shrink-0 px-3 pt-2 pb-1.5 flex items-center justify-between border-b border-white/10 gap-2">
        {/* Source Toggle Pills: Only Two Options as requested */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-black/40 border border-white/15">
          {/* 1. Primary Option: Upload Video */}
          <button
            type="button"
            onClick={() => handleSelectSource('upload')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              source === 'upload'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Video</span>
          </button>

          {/* 2. Secondary Option: Webcam */}
          <button
            type="button"
            onClick={() => handleSelectSource('webcam')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              source === 'webcam'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Webcam</span>
          </button>
        </div>

        {/* Hidden File Input for Video Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Real-time Status Badges & Controls */}
        <div className="flex items-center gap-2">
          {/* If Webcam active: show flip/mirror perspective toggle and camera toggle */}
          {source === 'webcam' && (
            <>
              <button
                type="button"
                onClick={() => setIsFlipped(!isFlipped)}
                title={isFlipped ? 'Webcam Mirrored (User Perspective)' : 'Webcam Standard (Unflipped)'}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-medium transition ${
                  isFlipped
                    ? 'bg-purple-600/50 border-purple-400 text-white'
                    : 'bg-white/10 border-white/20 text-white/70 hover:text-white'
                }`}
              >
                <FlipHorizontal className="w-3 h-3" />
                <span className="hidden sm:inline">{isFlipped ? 'Mirrored' : 'Inverted'}</span>
              </button>

              <button
                type="button"
                onClick={toggleCamera}
                title={isCameraActive ? 'Turn Off Camera' : 'Turn On Camera'}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-medium transition ${
                  isCameraActive
                    ? 'bg-emerald-600/70 border-emerald-400 text-white'
                    : 'bg-rose-600/70 border-rose-400 text-white'
                }`}
              >
                {isCameraActive ? <Camera className="w-3 h-3" /> : <CameraOff className="w-3 h-3" />}
                <span>{isCameraActive ? 'Active' : 'Off'}</span>
              </button>
            </>
          )}

          {/* FPS Badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-mono text-purple-200">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span>{fps} FPS</span>
          </div>

          {/* Live Coordinates display toggle */}
          <button
            type="button"
            onClick={() => setShowCoordinates(!showCoordinates)}
            title="Toggle Live Bone Coordinates HUD"
            className={`p-1.5 rounded-lg border text-xs transition ${
              showCoordinates
                ? 'bg-purple-600/60 border-purple-400 text-white'
                : 'bg-white/10 border-white/20 text-white/70 hover:text-white'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* MAIN DETECTION STAGE & COORDINATES SPLIT */}
      <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden p-2.5 gap-2.5">
        {/* LEFT / TOP: VIDEO & SKELETON CANVAS CONTAINER */}
        <div className="relative flex-1 min-h-[170px] rounded-2xl bg-neutral-950 border border-white/20 overflow-hidden flex items-center justify-center shadow-inner">
          {/* 1. If in Upload mode and NO video uploaded yet: show friendly dropzone */}
          {source === 'upload' && !hasUploadedVideo ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full h-full p-4 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                isDragging
                  ? 'bg-purple-900/30 border-2 border-dashed border-purple-400'
                  : 'hover:bg-white/[0.04]'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-400/40 flex items-center justify-center mb-2 shadow-lg">
                <Upload className="w-6 h-6 text-purple-300" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-wide">
                Upload ASL Sign Video
              </h4>
              <p className="text-xs text-white/60 mt-1 max-w-xs">
                Drag & drop any video file or click to browse from device (MP4, WebM, MOV)
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow transition">
                  Choose Video File
                </span>
              </div>
            </div>
          ) : (
            /* 2. Active Video + MediaPipe Skeleton Canvas (Mirrored if Webcam is flipped) */
            <div
              className={`relative w-full h-full flex items-center justify-center overflow-hidden ${
                source === 'webcam' && isFlipped ? 'scale-x-[-1]' : ''
              }`}
            >
              <video
                ref={videoRef}
                playsInline={true}
                autoPlay={true}
                muted={true}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
              />
            </div>
          )}

          {/* Camera Permission / Off Overlay (Webcam Mode) */}
          {source === 'webcam' && (!isCameraActive || cameraError) && (
            <div className="absolute inset-0 z-20 bg-black/85 backdrop-blur-sm p-4 flex flex-col items-center justify-center text-center">
              <CameraOff className="w-8 h-8 text-rose-400 mb-2" />
              <p className="text-xs text-rose-200 font-medium max-w-xs leading-relaxed">
                {cameraError || 'Camera is currently paused or inactive.'}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition flex items-center gap-1.5 shadow"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Start Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSource('upload')}
                  className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold text-white transition flex items-center gap-1.5 shadow"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Use Video Upload</span>
                </button>
              </div>
            </div>
          )}

          {/* Video Playback Controls Overlay for Upload Mode */}
          {source === 'upload' && hasUploadedVideo && (
            <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-black/70 backdrop-blur-md px-2 py-1 rounded-xl border border-white/15">
              <button
                type="button"
                onClick={toggleVideoPlayback}
                className="p-1 rounded-md hover:bg-white/20 text-white transition"
                title={isVideoPaused ? 'Play' : 'Pause'}
              >
                {isVideoPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={restartVideo}
                className="p-1 rounded-md hover:bg-white/20 text-white transition"
                title="Restart Video"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-1.5 py-0.5 rounded-md hover:bg-white/20 text-[10px] text-purple-200 font-medium transition flex items-center gap-1"
                title="Change Video"
              >
                <FileVideo className="w-3 h-3" />
                <span className="truncate max-w-[90px]">{uploadedFileName || 'Change'}</span>
              </button>
            </div>
          )}

          {/* Floating Live Prediction HUD (Overlaid on Video) */}
          <div className="absolute top-2 right-2 z-20 flex items-center gap-2 pointer-events-none">
            {predictedSign ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-black/80 backdrop-blur-md border border-purple-400/50 shadow-lg animate-fadeIn">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold text-white tracking-wider">
                  {predictedSign}
                </span>
                <span className="text-[10px] font-mono text-emerald-300">
                  {confidence}%
                </span>
              </div>
            ) : (
              <div className="px-2.5 py-0.5 rounded-lg bg-black/60 backdrop-blur-xs border border-white/10 text-[10px] text-white/70">
                Position hands in view
              </div>
            )}

            {/* Mirror on 3D Avatar Quick Action */}
            {predictedSign && (
              <button
                type="button"
                onClick={() => onSelectWord(predictedSign)}
                className="pointer-events-auto px-2.5 py-1 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white text-[11px] font-semibold flex items-center gap-1 shadow-md active:scale-95 transition"
              >
                <Sparkles className="w-3 h-3 text-yellow-300" />
                <span>Mirror on Avatar</span>
              </button>
            )}
          </div>

          {/* Tracking Legend Overlay at Bottom */}
          <div className="absolute bottom-1.5 left-2 right-2 z-20 flex items-center justify-between pointer-events-none text-[9px] font-mono text-white/75 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22d3ee]" /> Left Hand
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" /> Right Hand
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ec4899]" /> Body
              </span>
            </div>
            <span>
              {source === 'webcam' && isFlipped ? 'Mirrored Perspective' : 'Standard View'}
            </span>
          </div>
        </div>

        {/* RIGHT / BOTTOM: EXACT COORDINATES & PREDICTION HUD */}
        <div className="w-full sm:w-[220px] shrink-0 flex flex-col gap-2 overflow-y-auto no-scrollbar">
          {/* Live Subtitle Caption Box */}
          <div className="p-2.5 rounded-xl bg-white/[0.08] border border-white/15 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Live Caption Subtitles</span>
              </span>
              {captionHistory.length > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleCopyCaption}
                    className="text-[10px] text-white/60 hover:text-white p-0.5"
                    title="Copy subtitles"
                  >
                    {copiedCaption ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaptionHistory([])}
                    className="text-[10px] text-white/60 hover:text-white p-0.5"
                    title="Clear"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="min-h-[38px] p-1.5 rounded-lg bg-black/40 border border-white/10 text-xs font-medium text-white flex flex-wrap gap-1 items-center">
              {captionHistory.length > 0 ? (
                captionHistory.map((word, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-purple-900/60 border border-purple-400/40 text-[11px] font-bold text-white tracking-wide animate-fadeIn"
                  >
                    {word}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-white/40 italic">
                  Captions appear here as you sign...
                </span>
              )}
            </div>
          </div>

          {/* EXACT COORDINATES TELEMETRY HUD */}
          {showCoordinates && (
            <div className="p-2.5 rounded-xl bg-black/50 border border-white/15 flex flex-col gap-2 font-mono text-[10px]">
              <div className="flex items-center justify-between border-b border-white/10 pb-1">
                <span className="font-bold text-purple-300 uppercase tracking-wide">
                  Live Bone Coordinates
                </span>
                <span className="text-[9px] text-emerald-400">XYZ Active</span>
              </div>

              {/* Right Hand Coords */}
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Right Hand {rightHandCoords ? 'Tracked' : 'Searching...'}
                </span>
                {rightHandCoords ? (
                  <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-white/80 text-[9px] pl-2 border-l border-emerald-500/30">
                    <div>
                      W: {rightHandCoords.wrist.x.toFixed(2)}, {rightHandCoords.wrist.y.toFixed(2)}
                    </div>
                    <div>
                      Idx: {rightHandCoords.indexTip.x.toFixed(2)}, {rightHandCoords.indexTip.y.toFixed(2)}
                    </div>
                    <div>
                      Thb: {rightHandCoords.thumbTip.x.toFixed(2)}, {rightHandCoords.thumbTip.y.toFixed(2)}
                    </div>
                    <div>
                      Pnk: {rightHandCoords.pinkyTip.x.toFixed(2)}, {rightHandCoords.pinkyTip.y.toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <span className="text-[9px] text-white/40 italic pl-2">Waiting for hand...</span>
                )}
              </div>

              {/* Left Hand Coords */}
              <div className="flex flex-col gap-0.5 pt-1 border-t border-white/10">
                <span className="font-semibold text-cyan-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Left Hand {leftHandCoords ? 'Tracked' : 'Searching...'}
                </span>
                {leftHandCoords ? (
                  <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-white/80 text-[9px] pl-2 border-l border-cyan-500/30">
                    <div>
                      W: {leftHandCoords.wrist.x.toFixed(2)}, {leftHandCoords.wrist.y.toFixed(2)}
                    </div>
                    <div>
                      Idx: {leftHandCoords.indexTip.x.toFixed(2)}, {leftHandCoords.indexTip.y.toFixed(2)}
                    </div>
                    <div>
                      Thb: {leftHandCoords.thumbTip.x.toFixed(2)}, {leftHandCoords.thumbTip.y.toFixed(2)}
                    </div>
                    <div>
                      Pnk: {leftHandCoords.pinkyTip.x.toFixed(2)}, {leftHandCoords.pinkyTip.y.toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <span className="text-[9px] text-white/40 italic pl-2">Waiting for hand...</span>
                )}
              </div>

              {/* Upper Body & Arms */}
              {bodyCoords && bodyCoords.leftShoulder && (
                <div className="flex flex-col gap-0.5 pt-1 border-t border-white/10">
                  <span className="font-semibold text-pink-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                    Shoulders & Arms
                  </span>
                  <div className="text-[9px] text-white/80 pl-2 border-l border-pink-500/30">
                    <div>
                      Shoulder L: {bodyCoords.leftShoulder.x.toFixed(2)}, R:{' '}
                      {bodyCoords.rightShoulder?.x.toFixed(2)}
                    </div>
                    <div>
                      Elbow L: {bodyCoords.leftElbow?.x.toFixed(2)}, R:{' '}
                      {bodyCoords.rightElbow?.x.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
