import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Character3D, LiveMocapCoordinates } from './CharacterRig';
import { GaltisOriginalAvatar, GaltisModelSource } from './GaltisOriginalAvatar';
import { Companion, CameraViewMode, GestureKeyframe, StageBackground } from '../types';
import { getFingerspellPose, REST_POSE_LEFT } from '../data/aslDictionary';
import { getEnvironment, EnvironmentInstance } from '../environments/registry';

interface Stage3DProps {
  companion: Companion;
  currentSignQueueItem: {
    type: 'gloss' | 'letter';
    id: string;
    name: string;
    def?: any;
    char?: string;
  } | null;
  onSignComplete?: (id: string) => void;
  onSignStart?: (name: string) => void;
  speed: number; // 0.5 to 2.0
  viewMode: CameraViewMode;
  showMist: boolean;
  showSkeletalJoints?: boolean;
  onCoordinatesUpdate?: (coords: LiveMocapCoordinates) => void;
  manualKeyposeKeyframe?: GestureKeyframe | null;
  avatarSkin?: GaltisModelSource;
  stageBackground?: StageBackground;
  isDictionaryOpen?: boolean;
  liveTrackingKeyframeRef?: React.MutableRefObject<GestureKeyframe | null>;
}

export const Stage3D: React.FC<Stage3DProps> = ({
  companion,
  currentSignQueueItem,
  onSignComplete,
  onSignStart,
  speed,
  viewMode,
  showMist,
  showSkeletalJoints = false,
  onCoordinatesUpdate,
  manualKeyposeKeyframe,
  avatarSkin = 'full_mesh',
  stageBackground = 'mist',
  isDictionaryOpen = false,
  liveTrackingKeyframeRef,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const characterRef = useRef<Character3D | null>(null);
  const galtisAvatarRef = useRef<GaltisOriginalAvatar | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const accentLightRef = useRef<THREE.PointLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
  const activeEnvInstanceRef = useRef<EnvironmentInstance | null>(null);

  // Model loading state for Real StudioGalt Galtis 3D (Defaulting to 'full_mesh' Full Body Rig as requested)
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [galtisVariant, setGaltisVariant] = useState<GaltisModelSource>(avatarSkin);
  const [activeMocapSign, setActiveMocapSign] = useState<string | null>(null);
  const [clipStatus, setClipStatus] = useState<string | null>(null);

  // Sign execution tracking
  const currentKeyframeIdxRef = useRef<number>(0);
  const activeSignItemRef = useRef<typeof currentSignQueueItem>(null);
  const isExecutingRef = useRef<boolean>(false);

  // Mouse drag orbit controls
  const isDraggingRef = useRef<boolean>(false);
  const previousMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const orbitAngleRef = useRef<{ theta: number; phi: number }>({ theta: 0, phi: 0 });
  const wasLiveImitatingRef = useRef<boolean>(false);
  const lastLivePoseTimeRef = useRef<number>(0);

  const liveProps = useRef({
    companion,
    speed,
    viewMode,
    showMist,
    onCoordinatesUpdate,
    isDictionaryOpen,
  });
  liveProps.current = {
    companion,
    speed,
    viewMode,
    showMist,
    onCoordinatesUpdate,
    isDictionaryOpen,
  };

  // When viewMode changes, smoothly reset manual orbit drag offset to allow clean preset framing
  useEffect(() => {
    orbitAngleRef.current = { theta: 0, phi: 0 };
  }, [viewMode]);

  // 1. Initialize Scene, Camera, Mist, Stage, Lights
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Scene with authentic Studio deep purple matching design screenshots
    const scene = new THREE.Scene();
    if (!stageBackground || stageBackground === 'mist') {
      scene.background = new THREE.Color(0x26004d);
      scene.fog = new THREE.FogExp2(0x26004d, 0.025);
    } else {
      scene.background = null;
      scene.fog = null;
    }
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 1.45, 2.6);
    cameraRef.current = camera;

    // WebGL Renderer with alpha transparency support for animated custom backgrounds
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Studio Portrait Lighting Rig for Galtis 3D Avatar (Consistent across all environments/shaders)
    // 1. Ambient Light: Natural warm studio ambient to preserve hand, finger, and face visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    // 2. Front Key Light: High-clarity directional light angled downward for clear facial features and gesture readability
    const keyLight = new THREE.DirectionalLight(0xfffbf5, 2.2);
    keyLight.position.set(1.4, 3.2, 2.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);
    keyLightRef.current = keyLight;

    // 3. Fill Light: Soft front-left fill light eliminating dark harsh shadows on the avatar's body, hands, and fingers
    const fillLight = new THREE.DirectionalLight(0xf1f5f9, 1.3);
    fillLight.position.set(-1.8, 2.2, 2.2);
    scene.add(fillLight);
    fillLightRef.current = fillLight;

    // 4. Rim / Edge Light: Crisp backlight separating avatar silhouette from any dark or bright background
    const rimLight = new THREE.DirectionalLight(0xdbeafe, 1.5);
    rimLight.position.set(-1.5, 3.0, -2.6);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    // 5. Companion dynamic neon accent light
    const accentLight = new THREE.PointLight(companion.glowHex, 3.5, 7);
    accentLight.position.set(0, 0.4, 0.8);
    scene.add(accentLight);
    accentLightRef.current = accentLight;

    // 1. Build Real StudioGalt Galtis Avatar (Flagship)
    const galtisAvatar = new GaltisOriginalAvatar(galtisVariant, () => {
      setIsModelLoading(false);
      setLoadProgress(100);
    });
    scene.add(galtisAvatar.root);
    galtisAvatarRef.current = galtisAvatar;

    // Track loading progress
    const progressInterval = setInterval(() => {
      if (galtisAvatarRef.current) {
        setLoadProgress(galtisAvatarRef.current.loadProgress);
        if (galtisAvatarRef.current.isLoaded) {
          setIsModelLoading(false);
          clearInterval(progressInterval);
        }
      }
    }, 150);

    // 2. Build Auxiliary Synthetic Rig (For telemetry comparison / other companions)
    const character = new Character3D(scene, companion.suitColor, companion.visorColor);
    characterRef.current = character;
    character.resetToReady();

    // Default visibility based on companion
    const isOriginalGaltis = companion.avatarVariant === 'galtis_original';
    galtisAvatar.root.visible = isOriginalGaltis;
    character.root.visible = !isOriginalGaltis;

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsedTime = clock.getElapsedTime();

      // Animate active 3D environment if mounted
      if (activeEnvInstanceRef.current) {
        activeEnvInstanceRef.current.onAnimate(delta, elapsedTime);
      }

      const {
        companion: activeCompanion,
        speed: activeSpeed,
        viewMode: activeViewMode,
        onCoordinatesUpdate: activeOnCoords,
        isDictionaryOpen: activeIsDictOpen,
      } = liveProps.current;

      // Update Active Character / Avatar
      const isOriginal = activeCompanion.avatarVariant === 'galtis_original';

      // Real-time live motion capture imitation (MediaPipe Vision -> Avatar Rig)
      const liveTrackingPose = liveTrackingKeyframeRef?.current;
      const nowMs = performance.now();
      if (liveTrackingPose && !activeSignItemRef.current) {
        lastLivePoseTimeRef.current = nowMs;
        wasLiveImitatingRef.current = true;
        if (isOriginal && galtisAvatarRef.current) {
          galtisAvatarRef.current.applyPose(liveTrackingPose);
        } else if (characterRef.current) {
          characterRef.current.applyPose(liveTrackingPose);
        }
      } else if (wasLiveImitatingRef.current) {
        // Hold last tracking pose for 350ms to gracefully bridge any single-frame detection drops
        if (nowMs - lastLivePoseTimeRef.current > 350) {
          wasLiveImitatingRef.current = false;
          if (isOriginal && galtisAvatarRef.current) {
            galtisAvatarRef.current.resetToReady();
          } else if (characterRef.current) {
            characterRef.current.resetToReady();
          }
        }
      }

      if (isOriginal && galtisAvatarRef.current) {
        galtisAvatarRef.current.update(delta, elapsedTime, activeSpeed || 1.0);
        // Feed live telemetry coordinates
        if (activeOnCoords && Math.random() < 0.35) {
          const signName = activeSignItemRef.current?.name || (liveTrackingPose ? 'LIVE MOCAP' : 'GALTIS');
          const progress = (currentKeyframeIdxRef.current + 1) / 3;
          activeOnCoords(galtisAvatarRef.current.getLiveCoordinates(signName, progress));
        }
      } else if (characterRef.current) {
        characterRef.current.update(delta, activeSpeed || 1.0);
        if (activeOnCoords && Math.random() < 0.35) {
          activeOnCoords(characterRef.current.getLiveCoordinates());
        }
      }

      // Camera position interpolation based on view mode and user drag
      const targetCamPos = getCameraTarget(activeViewMode, orbitAngleRef.current, camera.aspect, activeIsDictOpen);
      camera.position.lerp(targetCamPos.position, delta * 5.0);
      camera.lookAt(targetCamPos.lookAt);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      clearInterval(progressInterval);
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (activeEnvInstanceRef.current) {
        scene.remove(activeEnvInstanceRef.current.group);
        activeEnvInstanceRef.current.dispose();
        activeEnvInstanceRef.current = null;
      }
      galtisAvatar.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update companion visual theme and toggle between Real Galtis & Synthetic Rig
  useEffect(() => {
    const isOriginal = companion.avatarVariant === 'galtis_original';

    if (galtisAvatarRef.current) {
      galtisAvatarRef.current.root.visible = isOriginal;
    }
    if (characterRef.current) {
      characterRef.current.root.visible = !isOriginal;
      characterRef.current.updateTheme(companion);
      characterRef.current.setSkeletalOverlayVisible(showSkeletalJoints);
    }
    if (accentLightRef.current) {
      accentLightRef.current.color.setHex(companion.glowHex);
    }
  }, [companion, showSkeletalJoints]);

  // Dynamic 3D Environment & 2D Shader Manager
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clean up existing 3D environment
    if (activeEnvInstanceRef.current) {
      scene.remove(activeEnvInstanceRef.current.group);
      activeEnvInstanceRef.current.dispose();
      activeEnvInstanceRef.current = null;
    }

    const currentBg = stageBackground || 'studio_mist';
    const isShaderBg = ['lightrays', 'lightfall', 'gradientwaves', 'aurora'].includes(currentBg);

    if (isShaderBg) {
      // 2D WebGL Shaders: completely transparent 3D scene, mist environment turned off
      scene.background = null;
      scene.fog = null;
    } else {
      // 3D Environments (studio_mist, cyberpunk_grid, cosmic_space, zen_garden, sunset_horizon, deep_ocean)
      const envId = currentBg === 'mist' ? 'studio_mist' : currentBg;
      const envDef = getEnvironment(envId);

      scene.background = new THREE.Color(envDef.bgColor);
      if (envDef.fogDensity > 0) {
        scene.fog = new THREE.FogExp2(envDef.fogColor, envDef.fogDensity);
      } else {
        scene.fog = null;
      }

      const envInst = envDef.build(companion.glowHex);
      scene.add(envInst.group);
      activeEnvInstanceRef.current = envInst;
    }

    // Avatar illumination is kept constant and optimal across ALL environments & shaders:
    // Ensures crisp visibility, correct skin/suit colors, and shadow-free sign language gestures
    if (ambientLightRef.current) {
      ambientLightRef.current.color.setHex(0xffffff);
      ambientLightRef.current.intensity = 1.4;
    }
    if (keyLightRef.current) {
      keyLightRef.current.color.setHex(0xfffbf5);
      keyLightRef.current.intensity = 2.2;
    }
    if (fillLightRef.current) {
      fillLightRef.current.color.setHex(0xf1f5f9);
      fillLightRef.current.intensity = 1.3;
    }
    if (rimLightRef.current) {
      rimLightRef.current.color.setHex(0xdbeafe);
      rimLightRef.current.intensity = 1.5;
    }
  }, [stageBackground, companion.glowHex]);

  // Handle switching Galtis FBX mesh variant (2023 full body primary vs 2024 mesh + hair)
  const handleSwitchVariant = (newVariant: GaltisModelSource) => {
    if (newVariant === galtisVariant) return;
    setGaltisVariant(newVariant);
    if (galtisAvatarRef.current?.setAppearance(newVariant)) return;
    setIsModelLoading(true);
    setLoadProgress(10);
    if (galtisAvatarRef.current) {
      galtisAvatarRef.current.loadModel(newVariant, () => {
        setIsModelLoading(false);
        setLoadProgress(100);
      });
    }
  };

  // Sync avatarSkin prop from parent
  useEffect(() => {
    if (avatarSkin && avatarSkin !== galtisVariant) {
      handleSwitchVariant(avatarSkin as GaltisModelSource);
    }
  }, [avatarSkin]);

  // Handle manual keypose inspection
  useEffect(() => {
    if (manualKeyposeKeyframe) {
      if (companion.avatarVariant === 'galtis_original' && galtisAvatarRef.current) {
        galtisAvatarRef.current.applyPose(manualKeyposeKeyframe);
      } else if (characterRef.current) {
        characterRef.current.applyPose(manualKeyposeKeyframe);
      }
    }
  }, [manualKeyposeKeyframe, companion]);

  // Sign Queue Execution Engine
  useEffect(() => {
    if (!currentSignQueueItem) {
      setClipStatus(status => status?.startsWith('Loading ') ? null : status);
      isExecutingRef.current = false;
      activeSignItemRef.current = null;
      setActiveMocapSign(null);
      galtisAvatarRef.current?.resetToReady();
      characterRef.current?.resetToReady();
      return;
    }

    if (companion.avatarVariant === 'galtis_original' && (isModelLoading || !galtisAvatarRef.current?.isLoaded)) return;

    const item = currentSignQueueItem;
    activeSignItemRef.current = item;
    currentKeyframeIdxRef.current = 0;
    isExecutingRef.current = true;

    if (onSignStart) {
      onSignStart(item.name);
    }

    let timeoutId: NodeJS.Timeout;
    let cancelled = false;
    const isOriginalGaltis = companion.avatarVariant === 'galtis_original';

    // Check if the authentic Galtis FBX has a recorded mocap animation clip for this sign
    const avatar = galtisAvatarRef.current;
    if (isOriginalGaltis && avatar?.isLoaded && avatar.findMocapKey(item.name)) {
      setClipStatus(`Loading ${item.name}…`);
      void avatar.prepareMocapClip(item.name).then(ready => {
        if (cancelled || activeSignItemRef.current?.id !== item.id) return;
        const result = ready ? avatar.playMocapClip(item.name, speed) : null;
        if (!result?.started) {
          setClipStatus(`Could not load ${item.name}. Please try again.`);
          isExecutingRef.current = false;
          onSignComplete?.(item.id);
          return;
        }
        setClipStatus(null);
        setActiveMocapSign(result.mocapName || item.name);
        timeoutId = setTimeout(() => {
          if (!cancelled && activeSignItemRef.current?.id === item.id) {
            isExecutingRef.current = false;
            setActiveMocapSign(null);
            onSignComplete?.(item.id);
          }
        }, result.durationMs);
      });
      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
        avatar.resetToReady();
        setActiveMocapSign(null);
      };
    }
    setClipStatus(null);

    // Procedural keyframe execution fallback
    if (item.type === 'gloss' && item.def && item.def.keyframes.length > 0) {
      const keyframes = item.def.keyframes;
      let step = 0;

      const runNextStep = () => {
        if (!activeSignItemRef.current || activeSignItemRef.current.id !== item.id) return;
        if (step >= keyframes.length) {
          isExecutingRef.current = false;
          if (onSignComplete) onSignComplete(item.id);
          return;
        }

        const kf = keyframes[step];
        currentKeyframeIdxRef.current = step;

        if (isOriginalGaltis && galtisAvatarRef.current) {
          galtisAvatarRef.current.applyPose(kf);
        } else if (characterRef.current) {
          characterRef.current.applyPose(kf);
        }

        const duration = (kf.durationMs || 350) / Math.max(0.4, speed);
        step++;
        timeoutId = setTimeout(runNextStep, duration);
      };

      runNextStep();
    } else if (item.type === 'letter' && item.char) {
      // Single letter fingerspelling pose
      const pose = getFingerspellPose(item.char);
      const kf: GestureKeyframe = {
        rightHand: pose,
        leftHand: REST_POSE_LEFT,
        durationMs: 400,
        head: { nod: 0.05, expression: 'focused' },
      };

      if (isOriginalGaltis && galtisAvatarRef.current) {
        galtisAvatarRef.current.applyPose(kf);
      } else if (characterRef.current) {
        characterRef.current.applyPose(kf);
      }

      const duration = 400 / Math.max(0.4, speed);
      timeoutId = setTimeout(() => {
        if (activeSignItemRef.current?.id === item.id) {
          if (onSignComplete) onSignComplete(item.id);
        }
      }, duration);
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentSignQueueItem, speed, companion, isModelLoading]);

  // Mouse & Touch Drag Interaction for 3D stage orbit
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;

    // Inverted touch/mouse hold & move orbit movement as requested
    orbitAngleRef.current.theta -= deltaX * 0.005;
    orbitAngleRef.current.phi = Math.max(-0.25, Math.min(0.35, orbitAngleRef.current.phi + deltaY * 0.004));

    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const isOriginalGaltis = companion.avatarVariant === 'galtis_original';

  return (
    <div
      ref={mountRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="relative w-full h-full cursor-grab active:cursor-grabbing overflow-hidden touch-none select-none"
      title="Drag to orbit 3D companion stage"
    >
      {/* Real Galtis Model Loading Overlay */}
      {clipStatus && !isModelLoading && (
        <div role="status" className="absolute top-20 left-1/2 -translate-x-1/2 z-20 rounded-xl bg-black/75 px-4 py-2 text-sm text-white pointer-events-none">
          {clipStatus}
        </div>
      )}
      {isOriginalGaltis && isModelLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none bg-black/50 backdrop-blur-xs transition-opacity duration-300">
          <div className="bg-neutral-900/90 border border-orange-500/30 px-5 py-4 rounded-2xl flex items-center gap-3.5 shadow-2xl backdrop-blur-md">
            <div className="relative flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
              <span className="absolute text-[9px] font-bold text-orange-400">G</span>
            </div>
            <div>
              <div className="text-xs font-semibold text-white tracking-wide flex items-center gap-1.5">
                <span>Loading StudioGalt 3D Mesh</span>
                <span className="px-1.5 py-0.5 rounded-full bg-orange-500/20 text-[9px] text-orange-400 font-mono">FBX</span>
              </div>
              <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                {loadProgress > 0 ? `${loadProgress}%` : 'Parsing geometry & skeleton...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Sign Status Indicator */}
      {isOriginalGaltis && !isModelLoading && (activeMocapSign || currentSignQueueItem) && (
        <div className="absolute top-16 left-4 z-10 pointer-events-none flex flex-col sm:flex-row items-start sm:items-center gap-2">
          {activeMocapSign && (
            <div className="flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-500/40 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-lg animate-fadeIn">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-semibold text-emerald-300 tracking-tight">
                StudioGalt MoCap Clip
              </span>
              <span className="text-emerald-600 text-[10px]">•</span>
              <span className="text-[10px] font-bold text-white px-1.5 py-0.2 bg-emerald-500/30 rounded">
                {activeMocapSign}
              </span>
            </div>
          )}

          {!activeMocapSign && currentSignQueueItem && (
            <div className="flex items-center gap-1.5 bg-sky-950/80 border border-sky-500/40 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-lg animate-fadeIn">
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-[10px] font-semibold text-sky-300 tracking-tight">
                Kinematic ASL
              </span>
              <span className="text-sky-600 text-[10px]">•</span>
              <span className="text-[10px] font-bold text-white px-1.5 py-0.2 bg-sky-500/30 rounded">
                {currentSignQueueItem.name}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Calculate camera framing target based on mode, responsive screen aspect, user drag orbit, and dictionary mode.
function getCameraTarget(
  mode: CameraViewMode,
  userOrbit: { theta: number; phi: number },
  aspect: number,
  isDictionaryMode: boolean = false
) {
  const isPortrait = aspect < 1.0;
  const isMobile = isPortrait || aspect < 0.88;

  let targetY = 0.90;
  let targetLookAtY = 0.88;
  let targetDistance = 2.60;

  // When dictionary is open and user is in default front mode, automatically switch to close-up upper body
  const effectiveMode = isDictionaryMode && mode === 'front' ? 'upper_body' : mode;

  switch (effectiveMode) {
    case 'front':
      if (isMobile) {
        // Mobile Normal Mode: Closer angle / closer look as requested
        // Instead of pulling way back in portrait, frame closer from knees/hips up to head with hands prominent
        targetY = 1.08;
        targetLookAtY = 1.02;
        targetDistance = 2.40;
      } else {
        // Desktop Normal Mode: Full body view head-to-toe with stage podium
        targetY = 0.90;
        targetLookAtY = 0.88;
        targetDistance = 2.60;
      }
      break;

    case 'upper_body':
      if (isMobile) {
        // Mobile Close-up: Upper body & hands framed nicely in the visible upper half of mobile screen
        targetY = 1.28;
        targetLookAtY = 1.20;
        targetDistance = isDictionaryMode ? 1.85 : 1.95;
      } else {
        // Desktop Close-up: Very close-up view of upper body, chest, head and signing hands
        targetY = 1.26;
        targetLookAtY = 1.24;
        targetDistance = isDictionaryMode ? 1.65 : 1.75;
      }
      break;

    case 'hands_closeup':
      if (isMobile) {
        targetY = 1.24;
        targetLookAtY = 1.20;
        targetDistance = 1.55;
      } else {
        targetY = 1.22;
        targetLookAtY = 1.20;
        targetDistance = 1.40;
      }
      break;

    case 'stage_orbit':
      if (isMobile) {
        targetY = 0.95;
        targetLookAtY = 0.90;
        targetDistance = 3.8;
      } else {
        targetY = 0.88;
        targetLookAtY = 0.85;
        targetDistance = 3.4;
      }
      break;
  }

  // Calculate orbital position with user drag offsets
  const posX = Math.sin(userOrbit.theta) * targetDistance;
  const posY = targetY + 0.12 + userOrbit.phi;
  const posZ = Math.cos(userOrbit.theta) * targetDistance;

  return {
    position: new THREE.Vector3(posX, posY, posZ),
    lookAt: new THREE.Vector3(0, targetLookAtY, 0),
  };
}
