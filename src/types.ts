export interface HandPose {
  // Position offsets relative to shoulder
  posX?: number;
  posY?: number;
  posZ?: number;
  // Rotations in radians
  shoulderX?: number;
  shoulderY?: number;
  shoulderZ?: number;
  elbowX?: number;
  elbowY?: number;
  elbowZ?: number;
  wristX?: number;
  wristY?: number;
  wristZ?: number;
  // Finger bends (0 = fully extended, 1 = fully curled/closed)
  thumb?: number;
  index?: number;
  middle?: number;
  ring?: number;
  pinky?: number;
  // Spread (-1 tight together, 1 wide spread)
  spread?: number;
}

export interface HeadPose {
  nod?: number;
  tilt?: number;
  turn?: number;
  eyebrows?: 'neutral' | 'raised' | 'furrowed';
  expression?: 'neutral' | 'smile' | 'focused' | 'nodding' | 'question';
}

export interface GestureKeyframe {
  leftHand?: HandPose;
  rightHand?: HandPose;
  head?: HeadPose;
  durationMs: number;
}

export interface StudioGaltBoneCoordinate {
  quaternion: [number, number, number, number] | number[]; // [w, x, y, z]
  position: [number, number, number] | number[]; // [x, y, z]
  eulerDegrees: [number, number, number] | number[]; // [pitch, yaw, roll]
}

export interface StudioGaltKeypose {
  poseId: string;
  frame: number;
  boneCount: number;
  bones: Record<string, StudioGaltBoneCoordinate>;
}

export interface StudioGaltWordEntry {
  id: string;
  word: string;
  gloss: string;
  category: string;
  source: string;
  parentMotion: string;
  animationFile?: string;
  animationVariants?: { animationFile: string; rig: string; date: string }[];
  description: string;
  facs: {
    browRaise?: number;
    browFurrow?: number;
    mouthSmile?: number;
    mouthOpen?: number;
    mouthPucker?: number;
    eyeBlink?: number;
    headTilt?: number;
  };
  fps: number;
  keyposes: StudioGaltKeypose[];
  durationSec?: number;
}

export interface SignDefinition {
  gloss: string;
  matchedWords: string[];
  category: 'greeting' | 'polite' | 'question' | 'emotion' | 'common' | 'letter' | 'custom' | string;
  description: string;
  isFingerspelling?: boolean;
  keyframes: GestureKeyframe[];
  studioGaltData?: StudioGaltWordEntry;
}

export interface Companion {
  id: string;
  name: string;
  tagline: string;
  accentColor: string; // e.g. '#2dd4bf'
  glowHex: number;
  suitColor: number;
  visorColor: number;
  mistColor: number;
  voicePitch: number;
  avatarIcon: string;
  lore: string;
  isGaltis?: boolean;
  avatarVariant?: 'galtis_original' | 'galtis_mocap' | 'galtis_cyber' | 'galtis_casual' | 'galtis_skeleton';
}

export interface TranscriptItem {
  id: string;
  text: string;
  timestamp: string;
  signs: string[];
  activeSignIndex?: number;
  isCompleted?: boolean;
  source: 'mic' | 'quick_prompt' | 'keyboard';
}

export type CameraViewMode = 'front' | 'upper_body' | 'hands_closeup' | 'stage_orbit';

export type StageBackground =
  | 'mist'
  | 'studio_mist'
  | 'cyberpunk_grid'
  | 'cosmic_space'
  | 'zen_garden'
  | 'sunset_horizon'
  | 'deep_ocean'
  | 'lightrays'
  | 'lightfall'
  | 'gradientwaves'
  | 'aurora';

export interface AppSettings {
  signingSpeed: number; // 0.5x, 1x, 1.5x, 2x
  autoFingerspellUnknown: boolean;
  continuousListening: boolean;
  showMist: boolean;
  showCaptions: boolean;
  showBoneCoordinatesHud: boolean;
  showSkeletalJoints: boolean;
  soundFeedback: boolean;
  viewMode: CameraViewMode;
}
