import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { HandPose, HeadPose, GestureKeyframe, StudioGaltBoneCoordinate } from '../types';
import { REST_POSE_LEFT, REST_POSE_RIGHT } from '../data/aslDictionary';
import { LiveMocapCoordinates } from './CharacterRig';
import { createSuitMaterial } from './galtisSuitMaterial';
import { STUDIO_GALT_DICTIONARY } from '../data/studioGaltDictionary';

export type GaltisModelSource = 'hello' | 'full_mesh' | 'charcoal_suit';

// Registry of authentic StudioGalt MoCap animations extracted from GitHub
export const KNOWN_MOCAP_WORDS: Record<string, string> = {
  HELLO: '/animations/hello.json',
  HI: '/animations/hello.json',
  HEY: '/animations/hello.json',
  YOU: '/animations/you.json',
  YOUR: '/animations/you.json',
  PLEASE: '/animations/please.json',
  MY: '/animations/my.json',
  MINE: '/animations/my.json',
  'MY NAME IS': '/animations/my_name_is.json',
  'MY NAME': '/animations/my_name_is.json',
  NAME: '/animations/my_name_is.json',
  WHERE: '/animations/where.json',
  WHICH: '/animations/which.json',
  THIS: '/animations/this.json',
  TAKE: '/animations/take.json',
  FUTURE: '/animations/future.json',
  EQUAL: '/animations/equal.json',
  EVERYONE: '/animations/everyone.json',
  'TURN OFF': '/animations/turn_off.json',
  OR: '/animations/or.json',
  ...Object.fromEntries(STUDIO_GALT_DICTIONARY.filter(entry => entry.animationFile).map(entry => [
    entry.word.toUpperCase(), `/animations/${entry.animationFile}`,
  ])),
};

const IMPORTED_MOCAP_WORDS = new Set(STUDIO_GALT_DICTIONARY.filter(e => e.source === 'StudioGalt FBX Dictionary').map(e => e.word.toUpperCase()));

export interface MocapPlayResult {
  started: boolean;
  durationMs: number;
  mocapName: string | null;
}

export class GaltisOriginalAvatar {
  public root: THREE.Group;
  public modelGroup: THREE.Group;
  public isLoaded: boolean = false;
  public loadProgress: number = 0; // 0 to 100
  public errorMessage: string | null = null;

  // Real FBX meshes and bones
  private mixer: THREE.AnimationMixer | null = null;
  private clipsCache: Map<string, THREE.AnimationClip> = new Map();
  private pendingClips = new Map<string, Promise<THREE.AnimationClip | null>>();
  private actionsCache: Map<string, THREE.AnimationAction> = new Map();
  private activeAction: THREE.AnimationAction | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private hasActiveProceduralPose: boolean = false;

  // Bone references for real Galtis rig
  private boneMap: Map<string, THREE.Bone> = new Map();
  private skinnedMesh: THREE.SkinnedMesh | null = null;

  // Primary arm & finger bones from actual deformed skeleton
  private rightUpperArm: THREE.Bone | null = null;
  private rightLowerArm: THREE.Bone | null = null;
  private rightHand: THREE.Bone | null = null;
  private leftUpperArm: THREE.Bone | null = null;
  private leftLowerArm: THREE.Bone | null = null;
  private leftHand: THREE.Bone | null = null;
  private headBone: THREE.Bone | null = null;
  private neckBone: THREE.Bone | null = null;
  private spineBone: THREE.Bone | null = null;

  // Finger bones arrays [proximal, intermediate, distal]
  private rightThumb: THREE.Bone[] = [];
  private rightIndex: THREE.Bone[] = [];
  private rightMiddle: THREE.Bone[] = [];
  private rightRing: THREE.Bone[] = [];
  private rightPinky: THREE.Bone[] = [];

  private leftThumb: THREE.Bone[] = [];
  private leftIndex: THREE.Bone[] = [];
  private leftMiddle: THREE.Bone[] = [];
  private leftRing: THREE.Bone[] = [];
  private leftPinky: THREE.Bone[] = [];

  // Default initial bone rotations & positions for clean rest blending
  private restRotations: Map<string, THREE.Quaternion> = new Map();
  private restPositions: Map<string, THREE.Vector3> = new Map();

  // Poses for procedural fallback
  public currentLeftPose: HandPose = { ...REST_POSE_LEFT };
  public targetLeftPose: HandPose = { ...REST_POSE_LEFT };
  public currentRightPose: HandPose = { ...REST_POSE_RIGHT };
  public targetRightPose: HandPose = { ...REST_POSE_RIGHT };
  public currentHeadPose: HeadPose = { nod: 0, tilt: 0, turn: 0 };
  public targetHeadPose: HeadPose = { nod: 0, tilt: 0, turn: 0 };

  public isMocapActionPlaying: boolean = false;
  public activeMocapName: string | null = null;
  private loadVersion = 0;
  private modelRoot: THREE.Group | null = null;
  private modelVariant: GaltisModelSource = 'hello';

  constructor(variant: GaltisModelSource = 'hello', onLoadCallback?: () => void) {
    this.root = new THREE.Group();
    this.root.name = 'GaltisOriginalAvatarRoot';
    this.modelGroup = new THREE.Group();
    this.root.add(this.modelGroup);
    this.modelVariant = variant;

    this.loadModel(variant, onLoadCallback);
  }

  public loadModel(variant: GaltisModelSource = 'hello', onLoadCallback?: () => void) {
    const version = ++this.loadVersion;
    this.isLoaded = false;
    this.loadProgress = 0;
    this.skinnedMesh = null;
    this.activeAction = null;
    this.idleAction = null;
    this.isMocapActionPlaying = false;
    this.hasActiveProceduralPose = false;
    this.clipsCache.clear();
    this.pendingClips.clear();
    this.modelVariant = variant;

    // Clear previous model if any
    while (this.modelGroup.children.length > 0) {
      const child = this.modelGroup.children[0];
      this.modelGroup.remove(child);
    }
    this.boneMap.clear();
    this.restRotations.clear();
    this.restPositions.clear();
    this.actionsCache.clear();
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    const modelPath =
      variant !== 'hello' ? '/models/galtis_mesh.fbx' : '/models/galtis_hello.fbx';

    const loader = new FBXLoader();

    loader.load(
      modelPath,
      async (fbx) => {
        if (version !== this.loadVersion) return;
        this.modelRoot = fbx;
        // Center and scale Galtis to natural stage height (~1.74 units)
        const box = new THREE.Box3().setFromObject(fbx);
        const size = new THREE.Vector3();
        box.getSize(size);

        const targetHeight = 1.74;
        const scaleFactor = targetHeight / (size.y || 190);
        fbx.scale.set(scaleFactor, scaleFactor, scaleFactor);

        // Position on ground podium
        fbx.position.set(0, 0, 0);

        // Setup enhanced materials & shadows
        fbx.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            if ((child as THREE.SkinnedMesh).isSkinnedMesh && !this.skinnedMesh) {
              this.skinnedMesh = child as THREE.SkinnedMesh;
            }

            if (Array.isArray(mesh.material)) {
              mesh.material = mesh.material.map((mat) => this.enhanceMaterial(mat, mesh.name));
            } else if (mesh.material) {
              mesh.material = this.enhanceMaterial(mesh.material, mesh.name);
            }
          }

          if ((child as THREE.Bone).isBone) {
            const bone = child as THREE.Bone;
            this.boneMap.set(bone.name, bone);
          }
        });

        // Initialize AnimationMixer on the base Galtis model
        this.mixer = new THREE.AnimationMixer(fbx);

        // Map bones to the actual 391 deforming skeleton bones
        this.cacheRigBones();

        // Load rest pose clip
        await this.initRestPoseAndAnimations();
        if (version !== this.loadVersion) return;
        this.mixer?.update(0);
        fbx.updateMatrixWorld(true);
        const grounded = new THREE.Box3().setFromObject(fbx);
        const center = grounded.getCenter(new THREE.Vector3());
        fbx.position.set(-center.x, 0.06 - grounded.min.y, -center.z);

        this.modelGroup.add(fbx);
        this.isLoaded = true;
        this.loadProgress = 100;
        this.errorMessage = null;

        if (onLoadCallback) {
          onLoadCallback();
        }
      },
      (xhr) => {
        if (version !== this.loadVersion) return;
        if (xhr.lengthComputable && xhr.total > 0) {
          this.loadProgress = Math.round((xhr.loaded / xhr.total) * 100);
        } else {
          this.loadProgress = Math.min(95, Math.round((xhr.loaded / (6 * 1024 * 1024)) * 100));
        }
      },
      (error) => {
        if (version !== this.loadVersion) return;
        console.error('Failed to load Galtis FBX:', error);
        this.errorMessage = 'Could not load Galtis model';
        this.isLoaded = false;
      }
    );
  }

  /**
   * Load base rest pose and pre-cache common StudioGalt mocap animation clips
   */
  private async initRestPoseAndAnimations() {
    if (!this.mixer) return;

    const version = this.loadVersion;
    const byPath = new Map<string, Promise<THREE.AnimationClip | null>>();
    const initialWords = ['HELLO', 'HI', 'HEY', 'YOU', 'YOUR', 'PLEASE', 'MY', 'MINE', 'MY NAME IS', 'MY NAME', 'NAME', 'WHERE', 'WHICH', 'THIS', 'TAKE', 'FUTURE', 'EQUAL', 'EVERYONE', 'TURN OFF', 'OR'];
    await Promise.all(initialWords.map(async key => {
      const path = KNOWN_MOCAP_WORDS[key];
      if (!byPath.has(path)) byPath.set(path, this.fetchAndCacheClip(key, path));
      const clip = await byPath.get(path);
      if (clip && version === this.loadVersion) this.clipsCache.set(key, clip);
    }));
    if (version !== this.loadVersion || !this.mixer) return;
    // The supplied rest_pose is a T-pose. Use the recording's relaxed final
    // pose so the avatar returns its hands to its sides between signs.
    const hello = this.clipsCache.get('HELLO');
    if (hello) {
      const restClip = new THREE.AnimationClip('READY', 1, hello.tracks.map(track => {
        const idle = track.clone();
        const value = Array.from(track.values.slice(-track.getValueSize()));
        idle.times = new Float32Array([0, 1]);
        idle.values = new Float32Array([...value, ...value]);
        return idle;
      }));
      this.idleAction = this.mixer.clipAction(restClip);
      this.idleAction.setLoop(THREE.LoopRepeat, Infinity).play();
    }
  }

  /**
   * Fetch and parse an animation clip JSON
   */
  private async fetchAndCacheClip(key: string, url: string): Promise<THREE.AnimationClip | null> {
    if (this.clipsCache.has(key)) {
      return this.clipsCache.get(key)!;
    }

    const version = this.loadVersion;
    const path = this.modelVariant !== 'hello' ? url.replace('/animations/', '/animations/full_mesh/') : url;
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      const json = await res.json();
      const rawClip = THREE.AnimationClip.parse(json);
      // Three.js parse assigns json.uuid even when missing. Never let unrelated
      // clips share the undefined mixer-cache key (older exports omitted UUIDs).
      rawClip.uuid ||= THREE.MathUtils.generateUUID();
      if (version !== this.loadVersion) return null;
      rawClip.tracks = rawClip.tracks.filter(track => this.modelRoot?.getObjectByName(track.name.split('.')[0]));
      if (!rawClip.tracks.length || !rawClip.validate()) throw new Error('Animation has no valid tracks for this rig');
      rawClip.name = key;

      // Studio recording FBX exports start at frame 0 with the initial T-pose bind rest pose (arms lifted horizontally).
      // Trimming the initial 2 frames (~0.067s at 30fps) strips the T-pose bind recording artifact,
      // so the avatar starts the sign directly and naturally from the resting pose without any quick hand flick/lift.
      const fps = 30;
      const startFrame = 2;
      const endFrame = Math.max(startFrame + 1, Math.floor(rawClip.duration * fps));
      const clip = IMPORTED_MOCAP_WORDS.has(key) ? rawClip : THREE.AnimationUtils.subclip(rawClip, key, startFrame, endFrame, fps);

      this.clipsCache.set(key, clip);
      // Bound memory across long dictionary browsing sessions. Keep the idle source
      // and current action; release mixer bindings for other least-recent entries.
      for (const [oldKey, oldClip] of this.clipsCache) {
        if (this.clipsCache.size <= 40) break;
        if (oldKey === 'HELLO' || oldKey === key || oldClip === this.activeAction?.getClip()) continue;
        const oldAction = this.actionsCache.get(oldKey);
        oldAction?.stop();
        this.actionsCache.delete(oldKey);
        this.clipsCache.delete(oldKey);
        if (![...this.clipsCache.values()].includes(oldClip)) this.mixer?.uncacheClip(oldClip);
      }
      return clip;
    } catch (e) {
      console.warn(`Failed to fetch animation for ${key}:`, e);
      return null;
    }
  }

  /** Await network loading before starting the queue's playback timer. */
  public async prepareMocapClip(signName: string): Promise<boolean> {
    const key = this.findMocapKey(signName);
    if (!key) return false;
    if (this.clipsCache.has(key)) {
      const clip = this.clipsCache.get(key)!;
      this.clipsCache.delete(key); this.clipsCache.set(key, clip);
      return true;
    }
    const version = this.loadVersion;
    let pending = this.pendingClips.get(key);
    if (!pending) {
      pending = this.fetchAndCacheClip(key, KNOWN_MOCAP_WORDS[key]);
      this.pendingClips.set(key, pending);
    }
    try { return !!(await pending) && version === this.loadVersion; }
    finally { if (this.pendingClips.get(key) === pending) this.pendingClips.delete(key); }
  }

  /**
   * Enhance FBX materials preserving authentic StudioGalt design:
   * Original JetBlack studio clothes/hoodie, natural skin tone, and iconic orange hair
   */
  private enhanceMaterial(mat: THREE.Material, meshName: string): THREE.Material {
    const result = this.buildMaterial(mat, meshName);
    result.userData.galtisSourceName = mat.userData.galtisSourceName ?? mat.name;
    return result;
  }

  /** Switch clothing on the same rig without resetting the running animation. */
  public setAppearance(variant: GaltisModelSource): boolean {
    if (!this.isLoaded || !this.modelRoot || variant === 'hello' || this.modelVariant === 'hello') return false;
    this.modelVariant = variant;
    this.modelRoot.traverse(child => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const replace = (mat: THREE.Material) => {
        const next = this.enhanceMaterial(mat, mesh.name);
        mat.dispose();
        return next;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(replace) : replace(mesh.material);
    });
    return true;
  }

  private buildMaterial(mat: THREE.Material, meshName: string): THREE.Material {
    const matName: string = mat.userData.galtisSourceName ?? mat.name ?? '';
    const isHair = meshName.toLowerCase().includes('strand') || matName.toLowerCase().includes('hair') || matName.includes('Blender_Orange');
    if (this.modelVariant === 'charcoal_suit') {
      if (isHair) return new THREE.MeshStandardMaterial({ name: 'Galtis_Espresso_Hair', color: 0x35251f, roughness: 0.72 });
      if (matName === 'JetBlack') return createSuitMaterial();
    }

    // 1. Natural human skin tone
    if (matName.includes('Galtis_Skin') || matName.toLowerCase().includes('skin')) {
      return new THREE.MeshStandardMaterial({
        name: 'Galtis_Skin_PBR',
        color: new THREE.Color(0xf6bfad), // Soft natural skin tone
        roughness: 0.55,
        metalness: 0.04,
      });
    }

    // 2. StudioGalt signature orange hair
    if (isHair) {
      return new THREE.MeshStandardMaterial({
        name: 'Galtis_Blender_Orange_PBR',
        color: new THREE.Color(0xee5a24), // Vibrant StudioGalt iconic orange hair
        roughness: 0.65,
        metalness: 0.1,
      });
    }

    // 3. Teeth
    if (matName.toLowerCase().includes('teeth')) {
      return new THREE.MeshStandardMaterial({
        name: 'Galtis_Teeth_PBR',
        color: new THREE.Color(0xffffff),
        roughness: 0.25,
        metalness: 0.05,
      });
    }

    // 4. Tongue
    if (matName.toLowerCase().includes('tongue')) {
      return new THREE.MeshStandardMaterial({
        name: 'Galtis_Tongue_PBR',
        color: new THREE.Color(0xf54d73),
        roughness: 0.4,
        metalness: 0.05,
      });
    }

    // 5. Eyes
    if (matName.toLowerCase().includes('eye')) {
      return new THREE.MeshStandardMaterial({
        name: 'Galtis_Eye_PBR',
        color: new THREE.Color(0x18181b),
        roughness: 0.15,
        metalness: 0.1,
      });
    }

    // 6. Shoes / White accents
    if (matName.toLowerCase().includes('shoe') || matName.toLowerCase().includes('white')) {
      return new THREE.MeshStandardMaterial({
        name: 'Galtis_White_PBR',
        color: new THREE.Color(0xf1f5f9),
        roughness: 0.4,
        metalness: 0.1,
      });
    }

    // 7. Body outfit / Clothes / Pants / JetBlack:
    // The authentic StudioGalt design is sleek deep studio black / dark charcoal!
    return new THREE.MeshStandardMaterial({
      name: `Galtis_${meshName}_Original_PBR`,
      color: new THREE.Color(0x18181b), // Authentic original deep studio black
      roughness: 0.75,
      metalness: 0.05,
    });
  }

  /**
   * Cache references to key bones across Galtis's active deformed skeleton
   */
  private cacheRigBones() {
    const skelBones = this.skinnedMesh?.skeleton?.bones || Array.from(this.boneMap.values());

    const findBone = (...names: string[]): THREE.Bone | null => {
      for (const name of names) {
        // 1. Exact match in skeleton
        const found = skelBones.find((b) => b.name === name);
        if (found) return found;

        // 2. Case-insensitive match in skeleton
        const foundCi = skelBones.find((b) => b.name.toLowerCase() === name.toLowerCase());
        if (foundCi) return foundCi;

        // 3. Fallback to boneMap
        if (this.boneMap.has(name)) return this.boneMap.get(name)!;
        for (const [k, b] of this.boneMap.entries()) {
          if (k.toLowerCase() === name.toLowerCase()) return b;
        }
      }
      return null;
    };

    // Right Arm (Real deforming skeleton bones)
    this.rightUpperArm = findBone('upperarm_r', 'upperarminte_R', 'Bicep_R', 'bicepfk_R');
    this.rightLowerArm = findBone('lowerarm_r', 'lowerarminte_R', 'Forearm_R', 'forearmfk_R');
    this.rightHand = findBone('hand_r', 'handinte_R', 'Hand_R');

    // Left Arm (Real deforming skeleton bones)
    this.leftUpperArm = findBone('upperarm_l', 'upperarminte_L', 'Bicep_L', 'bicepfk_L');
    this.leftLowerArm = findBone('lowerarm_l', 'lowerarminte_L', 'Forearm_L', 'forearmfk_L');
    this.leftHand = findBone('hand_l', 'handinte_L', 'Hand_L');

    // Head & Spine
    this.headBone = findBone('head', 'headinte');
    this.neckBone = findBone('neck_01', 'neckinte_01', 'Neck');
    this.spineBone = findBone('spine_01', 'spine_02', 'spineinte_04', 'Chest_1');

    // Fingers
    const collectFingers = (prefix: string, isRight: boolean) => {
      const side = isRight ? 'r' : 'l';
      const sideUpper = isRight ? 'R' : 'L';
      const list: THREE.Bone[] = [];
      for (let i = 1; i <= 3; i++) {
        const numPad = `0${i}`;
        const b = findBone(
          `${prefix}_${numPad}_${side}`,
          `${prefix}_0${i}_${side}`,
          `${prefix}${i}_${side}`,
          `${prefix}${i}_${sideUpper}`,
          `${prefix}fk_0${i}_${sideUpper}`
        );
        if (b) list.push(b);
      }
      return list;
    };

    this.rightThumb = collectFingers('thumb', true);
    this.rightIndex = collectFingers('index', true);
    this.rightMiddle = collectFingers('middle', true);
    this.rightRing = collectFingers('ring', true);
    this.rightPinky = collectFingers('pinky', true);

    this.leftThumb = collectFingers('thumb', false);
    this.leftIndex = collectFingers('index', false);
    this.leftMiddle = collectFingers('middle', false);
    this.leftRing = collectFingers('ring', false);
    this.leftPinky = collectFingers('pinky', false);

    // Record rest rotations
    skelBones.forEach((bone) => {
      this.restRotations.set(bone.name, bone.quaternion.clone());
      this.restPositions.set(bone.name, bone.position.clone());
    });
  }

  /**
   * Match a sign name to a known StudioGalt mocap animation clip
   */
  public findMocapKey(signName: string): string | null {
    const exact = signName.trim().toUpperCase();
    if (KNOWN_MOCAP_WORDS[exact]) return exact;
    const clean = signName.trim().toUpperCase().replace(/[?!.,;:]/g, '').trim();
    if (KNOWN_MOCAP_WORDS[clean]) return clean;

    // Direct slash/paren alternative (e.g. "HELLO / HI" -> "HELLO" or "HI")
    const parts = clean.split(/[\/()]+/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (KNOWN_MOCAP_WORDS[part]) return part;
    }

    return null;
  }

  /**
   * Play an authentic StudioGalt MoCap animation clip if available for this word
   */
  public playMocapClip(signName: string, speedMultiplier: number = 1.0): MocapPlayResult {
    if (!this.mixer) {
      return { started: false, durationMs: 0, mocapName: null };
    }

    const matchedKey = this.findMocapKey(signName);
    if (!matchedKey) {
      // Not a mocap word, return false so procedural kinematic takes over
      if (this.activeAction && this.isMocapActionPlaying) {
        this.activeAction.fadeOut(0.2);
        this.activeAction = null;
      }
      this.isMocapActionPlaying = false;
      this.activeMocapName = null;
      return { started: false, durationMs: 0, mocapName: null };
    }

    const clip = this.clipsCache.get(matchedKey);

    if (!clip) {
      // Call prepareMocapClip first. Never schedule a stale, unawaited playback.
      return { started: false, durationMs: 0, mocapName: null };
    }

    return this.executeAction(matchedKey, clip, speedMultiplier);
  }

  private executeAction(key: string, clip: THREE.AnimationClip, speedMultiplier: number): MocapPlayResult {
    if (!this.mixer) return { started: false, durationMs: 0, mocapName: null };

    this.hasActiveProceduralPose = false;

    // Smoothly fade out idle action rather than abrupt stopping to prevent any single-frame pop
    if (this.idleAction) {
      this.idleAction.fadeOut(0.1);
    }

    let action = this.actionsCache.get(key);
    if (!action) {
      action = this.mixer.clipAction(clip);
      this.actionsCache.set(key, action);
    }

    if (this.activeAction && this.activeAction !== action) {
      this.activeAction.fadeOut(0.1);
    }

    action.reset();
    action.setEffectiveWeight(1.0);
    action.setEffectiveTimeScale(Math.max(0.3, speedMultiplier));
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.fadeIn(0.08).play();

    this.activeAction = action;
    this.isMocapActionPlaying = true;
    this.activeMocapName = key;

    // Active duration table for raw studio recordings:
    // This allows complete gesture execution and natural return to rest without idling in silence for 6 seconds
    const MOCAP_ACTIVE_DURATIONS: Record<string, number> = {
      YOU: 3.2,
      WHERE: 3.5,
      WHICH: 3.8,
      THIS: 3.5,
      FUTURE: 4.2,
      EQUAL: 4.0,
      EVERYONE: 4.5,
      OR: 3.8,
    };

    const activeSec = IMPORTED_MOCAP_WORDS.has(key) ? clip.duration : MOCAP_ACTIVE_DURATIONS[key] || clip.duration;
    const durationMs = (activeSec / Math.max(0.3, speedMultiplier)) * 1000;
    return { started: true, durationMs, mocapName: key };
  }

  /**
   * Apply procedural keyframe target to Galtis skeleton bones
   */
  public applyPose(keyframe: GestureKeyframe) {
    this.hasActiveProceduralPose = true;
    if (this.activeAction && this.isMocapActionPlaying) {
      this.activeAction.fadeOut(0.2);
      this.activeAction = null;
      this.isMocapActionPlaying = false;
      this.activeMocapName = null;
    }
    if (this.idleAction) {
      this.idleAction.fadeOut(0.2);
    }

    if (keyframe.rightHand) {
      this.targetRightPose = { ...keyframe.rightHand };
    }
    if (keyframe.leftHand) {
      this.targetLeftPose = { ...keyframe.leftHand };
    }
    if (keyframe.head) {
      this.targetHeadPose = { ...keyframe.head };
    }
  }

  public resetToReady() {
    this.hasActiveProceduralPose = false;
    this.targetRightPose = { ...REST_POSE_RIGHT };
    this.targetLeftPose = { ...REST_POSE_LEFT };
    this.targetHeadPose = { nod: 0, tilt: 0, turn: 0 };
    if (this.activeAction) {
      this.activeAction.fadeOut(0.25);
      this.activeAction = null;
      this.isMocapActionPlaying = false;
      this.activeMocapName = null;
    }
    if (this.idleAction) {
      this.idleAction.reset().fadeIn(0.25).play();
    }
  }

  /**
   * Frame update loop: blends animations and procedural bone rotations
   */
  public update(delta: number, elapsedTime: number, speedMultiplier: number = 1.0) {
    if (!this.isLoaded) return;

    // 1. Update Three.js AnimationMixer if mocap animation is active
    if (this.mixer) {
      this.mixer.update(delta);
      if (this.activeAction && !this.activeAction.isRunning() && this.isMocapActionPlaying) {
        this.isMocapActionPlaying = false;
        this.activeMocapName = null;
        if (!this.hasActiveProceduralPose && this.idleAction) {
          this.idleAction.reset().fadeIn(0.3).play();
        }
      }
    }

    // 2. Only run procedural FK blending when a procedural pose is actively requested and no mocap clip is controlling the rig
    if (this.hasActiveProceduralPose && !this.isMocapActionPlaying) {
      const lerpFactor = Math.min(1.0, delta * 9.5 * speedMultiplier);

      // Lerp pose values
      const lerpVal = (cur: number | undefined, tgt: number | undefined, def: number = 0) => {
        const c = cur ?? def;
        const t = tgt ?? def;
        return c + (t - c) * lerpFactor;
      };

      this.currentRightPose.shoulderX = lerpVal(this.currentRightPose.shoulderX, this.targetRightPose.shoulderX);
      this.currentRightPose.shoulderY = lerpVal(this.currentRightPose.shoulderY, this.targetRightPose.shoulderY);
      this.currentRightPose.shoulderZ = lerpVal(this.currentRightPose.shoulderZ, this.targetRightPose.shoulderZ);
      this.currentRightPose.elbowX = lerpVal(this.currentRightPose.elbowX, this.targetRightPose.elbowX);
      this.currentRightPose.elbowY = lerpVal(this.currentRightPose.elbowY, this.targetRightPose.elbowY);
      this.currentRightPose.elbowZ = lerpVal(this.currentRightPose.elbowZ, this.targetRightPose.elbowZ);
      this.currentRightPose.wristX = lerpVal(this.currentRightPose.wristX, this.targetRightPose.wristX);
      this.currentRightPose.wristY = lerpVal(this.currentRightPose.wristY, this.targetRightPose.wristY);
      this.currentRightPose.wristZ = lerpVal(this.currentRightPose.wristZ, this.targetRightPose.wristZ);

      // Idle breathing wave
      const breathing = Math.sin(elapsedTime * 2.2) * 0.02;

      // Apply to Right Arm Bones
      if (this.rightUpperArm) {
        this.rightUpperArm.rotation.x = (this.currentRightPose.shoulderX || 0) + breathing;
        this.rightUpperArm.rotation.y = this.currentRightPose.shoulderY || 0;
        this.rightUpperArm.rotation.z = -(this.currentRightPose.shoulderZ || 0);
      }
      if (this.rightLowerArm) {
        this.rightLowerArm.rotation.x = this.currentRightPose.elbowX || 0;
        this.rightLowerArm.rotation.y = this.currentRightPose.elbowY || 0;
        this.rightLowerArm.rotation.z = -(this.currentRightPose.elbowZ || 0);
      }
      if (this.rightHand) {
        this.rightHand.rotation.x = this.currentRightPose.wristX || 0;
        this.rightHand.rotation.y = this.currentRightPose.wristY || 0;
        this.rightHand.rotation.z = -(this.currentRightPose.wristZ || 0);
      }

      // Apply to Left Arm Bones
      if (this.leftUpperArm) {
        this.leftUpperArm.rotation.x = (this.targetLeftPose.shoulderX || 0) + breathing;
        this.leftUpperArm.rotation.y = -(this.targetLeftPose.shoulderY || 0);
        this.leftUpperArm.rotation.z = this.targetLeftPose.shoulderZ || 0;
      }
      if (this.leftLowerArm) {
        this.leftLowerArm.rotation.x = this.targetLeftPose.elbowX || 0;
        this.leftLowerArm.rotation.y = -(this.targetLeftPose.elbowY || 0);
        this.leftLowerArm.rotation.z = this.targetLeftPose.elbowZ || 0;
      }
      if (this.leftHand) {
        this.leftHand.rotation.x = this.targetLeftPose.wristX || 0;
        this.leftHand.rotation.y = -(this.targetLeftPose.wristY || 0);
        this.leftHand.rotation.z = this.targetLeftPose.wristZ || 0;
      }

      // Apply finger curling to real finger bones
      this.applyFingerBends(this.rightThumb, this.targetRightPose.thumb ?? 0.2);
      this.applyFingerBends(this.rightIndex, this.targetRightPose.index ?? 0.2);
      this.applyFingerBends(this.rightMiddle, this.targetRightPose.middle ?? 0.25);
      this.applyFingerBends(this.rightRing, this.targetRightPose.ring ?? 0.25);
      this.applyFingerBends(this.rightPinky, this.targetRightPose.pinky ?? 0.25);

      this.applyFingerBends(this.leftThumb, this.targetLeftPose.thumb ?? 0.2);
      this.applyFingerBends(this.leftIndex, this.targetLeftPose.index ?? 0.2);
      this.applyFingerBends(this.leftMiddle, this.targetLeftPose.middle ?? 0.25);
      this.applyFingerBends(this.leftRing, this.targetLeftPose.ring ?? 0.25);
      this.applyFingerBends(this.leftPinky, this.targetLeftPose.pinky ?? 0.25);

      // Spine & Head breathing
      if (this.spineBone) {
        this.spineBone.rotation.x = breathing * 0.5;
      }
      if (this.headBone) {
        const nod = this.targetHeadPose.nod || 0;
        const tilt = this.targetHeadPose.tilt || 0;
        const turn = this.targetHeadPose.turn || 0;
        this.headBone.rotation.x = nod + Math.sin(elapsedTime * 1.5) * 0.015;
        this.headBone.rotation.z = tilt;
        this.headBone.rotation.y = turn;
      }
    }
  }

  public dispose() {
    ++this.loadVersion;
    this.mixer?.stopAllAction();
  }

  private applyFingerBends(bones: THREE.Bone[], curlAmount: number) {
    if (bones.length === 0) return;
    const bendPerBone = curlAmount * 0.65;
    bones.forEach((bone) => {
      bone.rotation.x = bendPerBone;
    });
  }

  /**
   * Return live telemetry from Galtis's actual FBX bones
   */
  public getLiveCoordinates(signName: string, poseProgress: number): LiveMocapCoordinates {
    const bonesData: Record<string, StudioGaltBoneCoordinate> = {};

    this.boneMap.forEach((bone, name) => {
      const q = bone.quaternion;
      const p = bone.position;
      const e = new THREE.Euler().setFromQuaternion(q);

      bonesData[name] = {
        quaternion: [
          parseFloat(q.w.toFixed(4)),
          parseFloat(q.x.toFixed(4)),
          parseFloat(q.y.toFixed(4)),
          parseFloat(q.z.toFixed(4)),
        ],
        position: [
          parseFloat(p.x.toFixed(3)),
          parseFloat(p.y.toFixed(3)),
          parseFloat(p.z.toFixed(3)),
        ],
        eulerDegrees: [
          parseFloat(THREE.MathUtils.radToDeg(e.x).toFixed(1)),
          parseFloat(THREE.MathUtils.radToDeg(e.y).toFixed(1)),
          parseFloat(THREE.MathUtils.radToDeg(e.z).toFixed(1)),
        ],
      };
    });

    return {
      signName: signName || 'STANDBY',
      poseProgress,
      frame: Math.floor(poseProgress * 30),
      bones: bonesData,
      facs: {
        browRaise: 0.1,
        browFurrow: 0.0,
        mouthSmile: 0.4,
        mouthOpen: 0.0,
        eyeBlink: 0.0,
      },
    };
  }
}
