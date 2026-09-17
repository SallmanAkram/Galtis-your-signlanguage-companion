import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Activity,
  Crosshair,
  Copy,
  Check,
  FlipHorizontal,
} from 'lucide-react';
import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';

interface AiSignTrainingViewProps {
  onSelectWord: (word: string) => void;
  currentSignName?: string | null;
  uploadedFile?: File | null;
  onClearUploadedFile?: () => void;
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
  uploadedFile,
  onClearUploadedFile,
}) => {
  // Primary mode is 'webcam' as requested
  const [source, setSource] = useState<InputSource>('webcam');
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

  // Auto-start camera when source is webcam on mount
  useEffect(() => {
    if (source === 'webcam') {
      startCamera();
    }
  }, []);

  // Watch for uploaded video file passed from parent
  useEffect(() => {
    if (uploadedFile) {
      loadVideoFile(uploadedFile);
    }
  }, [uploadedFile]);

  // Video File Processing & Returning to Live Camera
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
    setSource('upload');

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = url;
      videoRef.current.loop = true;
      videoRef.current.muted = true;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch((playErr) => console.warn('Video play error:', playErr));
      };
    }
  };

  const returnToLiveCamera = () => {
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    setHasUploadedVideo(false);
    setUploadedFileName(null);
    setSource('webcam');
    if (onClearUploadedFile) {
      onClearUploadedFile();
    }
    startCamera();
  };

  // Toggle video playback for uploaded video
  const toggleVideoPlayback = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsVideoPaused(false);
    } else {
      videoRef.current.pause();
      setIsVideoPaused(true);
    }
  };

  const restartVideo = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().catch(() => {});
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
    <div className="relative w-full h-full min-h-0 flex-1 overflow-hidden rounded-2xl bg-neutral-950 border border-white/20 select-none shadow-inner flex items-center justify-center">
      {/* 1. CAMERA / VIDEO FEED + MEDIAPIPE CANVAS */}
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

      {/* 2. CAMERA PERMISSION / OFF / ERROR OVERLAY (WEBCAM MODE) */}
      {source === 'webcam' && (!isCameraActive || cameraError) && (
        <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-md p-4 flex flex-col items-center justify-center text-center">
          <CameraOff className="w-9 h-9 text-rose-400 mb-2" />
          <h4 className="text-sm font-bold text-white mb-1">
            {cameraError ? 'Camera Access Notice' : 'Camera is Inactive'}
          </h4>
          <p className="text-xs text-rose-200/90 font-medium max-w-xs leading-relaxed mb-3">
            {cameraError || 'Turn on your camera to start real-time ASL sign detection with MediaPipe AI.'}
          </p>
          <button
            type="button"
            onClick={startCamera}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition flex items-center gap-2 shadow-lg active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span>Start Camera</span>
          </button>
        </div>
      )}

      {/* 3. TOP FLOATING HUD CONTROLS BAR */}
      <div className="absolute top-2.5 inset-x-2.5 z-20 flex items-center justify-between pointer-events-none gap-2">
        {/* TOP-LEFT CONTROLS: Camera on/off, Mirrored toggle, FPS, Video controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {source === 'webcam' ? (
            <>
              {/* Camera On/Off Toggle */}
              <button
                type="button"
                onClick={toggleCamera}
                title={isCameraActive ? 'Turn Off Camera' : 'Turn On Camera'}
                className={`pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold backdrop-blur-md transition-all shadow-md active:scale-95 ${
                  isCameraActive
                    ? 'bg-emerald-600/80 border-emerald-400/80 text-white'
                    : 'bg-rose-600/80 border-rose-400/80 text-white'
                }`}
              >
                {isCameraActive ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
                <span>{isCameraActive ? 'Active' : 'Off'}</span>
              </button>

              {/* Mirrored Perspective Toggle */}
              <button
                type="button"
                onClick={() => setIsFlipped(!isFlipped)}
                title={isFlipped ? 'Webcam Mirrored (User Perspective)' : 'Webcam Standard'}
                className={`pointer-events-auto flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-medium backdrop-blur-md transition-all shadow-md active:scale-95 ${
                  isFlipped
                    ? 'bg-purple-600/70 border-purple-400 text-white'
                    : 'bg-black/60 border-white/20 text-white/80 hover:text-white'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isFlipped ? 'Mirrored' : 'Standard'}</span>
              </button>
            </>
          ) : (
            /* Video Playback Controls when file is uploaded */
            <div className="pointer-events-auto flex items-center gap-1 bg-black/75 backdrop-blur-md px-2 py-1 rounded-xl border border-white/20 shadow-md">
              <button
                type="button"
                onClick={toggleVideoPlayback}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition"
                title={isVideoPaused ? 'Play Video' : 'Pause Video'}
              >
                {isVideoPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={restartVideo}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition"
                title="Restart Video"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={returnToLiveCamera}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white text-[11px] font-semibold transition"
                title="Return to Live Camera"
              >
                <Camera className="w-3 h-3" />
                <span>Live Cam</span>
              </button>
            </div>
          )}

          {/* FPS Badge */}
          <div className="pointer-events-auto flex items-center gap-1 px-2 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-[10px] font-mono text-purple-200 shadow-md">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span>{fps} FPS</span>
          </div>
        </div>

        {/* TOP-RIGHT CONTROLS: Prediction, Mirror on Avatar, Coordinates HUD toggle */}
        <div className="flex items-center gap-1.5">
          {/* Prediction Badge */}
          {predictedSign ? (
            <div className="pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/80 backdrop-blur-md border border-purple-400/70 shadow-lg animate-fadeIn">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold text-white tracking-wider">
                {predictedSign}
              </span>
              <span className="text-[10px] font-mono text-emerald-300">
                {confidence}%
              </span>
            </div>
          ) : (
            <div className="pointer-events-auto px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 text-[10px] text-white/70">
              Position hands in view
            </div>
          )}

          {/* Mirror on Avatar Button */}
          {predictedSign && (
            <button
              type="button"
              onClick={() => onSelectWord(predictedSign)}
              className="pointer-events-auto px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold flex items-center gap-1 shadow-lg active:scale-95 transition"
              title="Mirror detected sign on 3D Avatar"
            >
              <Sparkles className="w-3 h-3 text-yellow-300" />
              <span className="hidden sm:inline">Mirror on Avatar</span>
            </button>
          )}

          {/* Coordinates HUD Toggle */}
          <button
            type="button"
            onClick={() => setShowCoordinates(!showCoordinates)}
            title="Toggle Bone Coordinates HUD"
            className={`pointer-events-auto p-1.5 rounded-xl border text-xs backdrop-blur-md transition shadow-md active:scale-95 ${
              showCoordinates
                ? 'bg-purple-600/80 border-purple-400 text-white'
                : 'bg-black/60 border-white/20 text-white/70 hover:text-white'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4. FLOATING BONE COORDINATES HUD OVERLAY */}
      {showCoordinates && (
        <div className="absolute top-12 right-2.5 z-20 p-2.5 rounded-xl bg-black/85 backdrop-blur-md border border-white/20 flex flex-col gap-1.5 font-mono text-[9px] max-w-[200px] shadow-2xl pointer-events-auto animate-fadeIn">
          <div className="flex items-center justify-between border-b border-white/10 pb-1">
            <span className="font-bold text-purple-300 uppercase tracking-wide">
              Live Bone XYZ
            </span>
            <span className="text-[8px] text-emerald-400">Tracked</span>
          </div>

          {/* Right Hand Coords */}
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-emerald-400 flex items-center gap-1 text-[9px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Right Hand {rightHandCoords ? 'Tracked' : 'Searching...'}
            </span>
            {rightHandCoords ? (
              <div className="grid grid-cols-2 gap-x-1 text-white/80 text-[8px] pl-1.5 border-l border-emerald-500/40">
                <div>W: {rightHandCoords.wrist.x.toFixed(2)}, {rightHandCoords.wrist.y.toFixed(2)}</div>
                <div>Idx: {rightHandCoords.indexTip.x.toFixed(2)}, {rightHandCoords.indexTip.y.toFixed(2)}</div>
              </div>
            ) : (
              <span className="text-[8px] text-white/40 italic pl-1.5">Waiting for hand...</span>
            )}
          </div>

          {/* Left Hand Coords */}
          <div className="flex flex-col gap-0.5 pt-0.5 border-t border-white/10">
            <span className="font-semibold text-cyan-400 flex items-center gap-1 text-[9px]">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Left Hand {leftHandCoords ? 'Tracked' : 'Searching...'}
            </span>
            {leftHandCoords ? (
              <div className="grid grid-cols-2 gap-x-1 text-white/80 text-[8px] pl-1.5 border-l border-cyan-500/40">
                <div>W: {leftHandCoords.wrist.x.toFixed(2)}, {leftHandCoords.wrist.y.toFixed(2)}</div>
                <div>Idx: {leftHandCoords.indexTip.x.toFixed(2)}, {leftHandCoords.indexTip.y.toFixed(2)}</div>
              </div>
            ) : (
              <span className="text-[8px] text-white/40 italic pl-1.5">Waiting for hand...</span>
            )}
          </div>
        </div>
      )}

      {/* 5. FLOATING LIVE CAPTION SUBTITLES STRIP */}
      <div className="absolute bottom-2 inset-x-2 z-20 flex flex-col gap-1 pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-between px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 shadow-2xl gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-300" />
              <span className="hidden sm:inline">Subtitles:</span>
            </span>
            {captionHistory.length > 0 ? (
              captionHistory.map((word, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectWord(word)}
                  title={`Click to mirror "${word}" on avatar`}
                  className="shrink-0 px-2 py-0.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 border border-purple-400/40 text-[11px] font-bold text-white tracking-wide shadow transition active:scale-95"
                >
                  {word}
                </button>
              ))
            ) : (
              <span className="text-[11px] text-white/50 italic truncate">
                Live captions appear here as you sign...
              </span>
            )}
          </div>

          {captionHistory.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleCopyCaption}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
                title="Copy subtitles"
              >
                {copiedCaption ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => setCaptionHistory([])}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
                title="Clear subtitles"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Tracking Legend */}
        <div className="flex items-center justify-between px-2.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[8.5px] font-mono text-white/75">
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
          <span>{source === 'webcam' && isFlipped ? 'Mirrored View' : 'Standard View'}</span>
        </div>
      </div>
    </div>
  );
};
