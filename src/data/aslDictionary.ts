import { SignDefinition, HandPose, GestureKeyframe, Companion } from '../types';
import { STUDIO_GALT_DICTIONARY, convertStudioGaltKeyposeToRigPose } from './studioGaltDictionary';

// Default relaxed resting/idle arm pose (hands hanging naturally at sides or resting lightly at waist)
export const REST_POSE_RIGHT: HandPose = {
  shoulderX: 0.1,
  shoulderY: 0,
  shoulderZ: -0.15,
  elbowX: 0.25,
  elbowY: 0,
  elbowZ: 0.1,
  wristX: 0,
  wristY: 0,
  wristZ: 0,
  thumb: 0.2,
  index: 0.2,
  middle: 0.25,
  ring: 0.25,
  pinky: 0.25,
  spread: 0,
};

export const REST_POSE_LEFT: HandPose = {
  shoulderX: 0.1,
  shoulderY: 0,
  shoulderZ: 0.15,
  elbowX: 0.25,
  elbowY: 0,
  elbowZ: -0.1,
  wristX: 0,
  wristY: 0,
  wristZ: 0,
  thumb: 0.2,
  index: 0.2,
  middle: 0.25,
  ring: 0.25,
  pinky: 0.25,
  spread: 0,
};

// Ready signing position: arms slightly raised in front of chest, alert and ready to sign
export const READY_POSE_RIGHT: HandPose = {
  shoulderX: -0.4,
  shoulderY: 0.2,
  shoulderZ: -0.4,
  elbowX: 1.1,
  elbowY: -0.3,
  elbowZ: 0.2,
  wristX: 0.1,
  wristY: 0.2,
  wristZ: -0.1,
  thumb: 0.1,
  index: 0.1,
  middle: 0.1,
  ring: 0.1,
  pinky: 0.1,
  spread: 0.2,
};

export const READY_POSE_LEFT: HandPose = {
  shoulderX: -0.4,
  shoulderY: -0.2,
  shoulderZ: 0.4,
  elbowX: 1.1,
  elbowY: 0.3,
  elbowZ: -0.2,
  wristX: 0.1,
  wristY: -0.2,
  wristZ: 0.1,
  thumb: 0.1,
  index: 0.1,
  middle: 0.1,
  ring: 0.1,
  pinky: 0.1,
  spread: 0.2,
};

// Helper to create A-Z fingerspelling hand pose
export function getFingerspellPose(letter: string): HandPose {
  const l = letter.toUpperCase();
  const base: HandPose = {
    shoulderX: -0.75,
    shoulderY: 0.15,
    shoulderZ: -0.35,
    elbowX: 1.45,
    elbowY: -0.2,
    elbowZ: 0.25,
    wristX: 0.15,
    wristY: 0.1,
    wristZ: -0.1,
    spread: 0,
  };

  switch (l) {
    case 'A':
      return { ...base, thumb: 0.05, index: 1, middle: 1, ring: 1, pinky: 1, spread: -0.3 };
    case 'B':
      return { ...base, thumb: 0.9, index: 0, middle: 0, ring: 0, pinky: 0, spread: -0.4 };
    case 'C':
      return { ...base, thumb: 0.35, index: 0.4, middle: 0.45, ring: 0.45, pinky: 0.45, spread: 0.1, wristZ: 0.2 };
    case 'D':
      return { ...base, thumb: 0.7, index: 0, middle: 0.85, ring: 0.9, pinky: 0.9, spread: 0 };
    case 'E':
      return { ...base, thumb: 0.85, index: 0.85, middle: 0.85, ring: 0.85, pinky: 0.85, spread: -0.4 };
    case 'F':
      return { ...base, thumb: 0.7, index: 0.7, middle: 0, ring: 0, pinky: 0, spread: 0.4 };
    case 'G':
      return { ...base, thumb: 0.1, index: 0, middle: 1, ring: 1, pinky: 1, wristY: -0.6, wristZ: -0.3 };
    case 'H':
      return { ...base, thumb: 0.1, index: 0, middle: 0, ring: 1, pinky: 1, spread: -0.4, wristY: -0.6 };
    case 'I':
      return { ...base, thumb: 0.9, index: 1, middle: 1, ring: 1, pinky: 0, spread: 0 };
    case 'J':
      return { ...base, thumb: 0.9, index: 1, middle: 1, ring: 1, pinky: 0, wristZ: 0.4, wristX: 0.3 };
    case 'K':
      return { ...base, thumb: 0.4, index: 0, middle: 0.25, ring: 1, pinky: 1, spread: 0.2 };
    case 'L':
      return { ...base, thumb: 0, index: 0, middle: 1, ring: 1, pinky: 1, spread: 0.8 };
    case 'M':
      return { ...base, thumb: 0.9, index: 0.95, middle: 0.95, ring: 0.95, pinky: 1, spread: -0.5 };
    case 'N':
      return { ...base, thumb: 0.9, index: 0.95, middle: 0.95, ring: 1, pinky: 1, spread: -0.5 };
    case 'O':
      return { ...base, thumb: 0.6, index: 0.65, middle: 0.65, ring: 0.65, pinky: 0.65, spread: -0.2 };
    case 'P':
      return { ...base, thumb: 0.4, index: 0, middle: 0.3, ring: 1, pinky: 1, wristX: 0.6, wristZ: -0.4 };
    case 'Q':
      return { ...base, thumb: 0.1, index: 0, middle: 1, ring: 1, pinky: 1, wristX: 0.8, wristY: -0.5 };
    case 'R':
      return { ...base, thumb: 0.8, index: 0, middle: 0, ring: 1, pinky: 1, spread: -0.8 };
    case 'S':
      return { ...base, thumb: 0.8, index: 1, middle: 1, ring: 1, pinky: 1, spread: -0.5 };
    case 'T':
      return { ...base, thumb: 0.7, index: 0.9, middle: 1, ring: 1, pinky: 1, spread: -0.4 };
    case 'U':
      return { ...base, thumb: 0.85, index: 0, middle: 0, ring: 1, pinky: 1, spread: -0.5 };
    case 'V':
      return { ...base, thumb: 0.85, index: 0, middle: 0, ring: 1, pinky: 1, spread: 0.5 };
    case 'W':
      return { ...base, thumb: 0.85, index: 0, middle: 0, ring: 0, pinky: 1, spread: 0.4 };
    case 'X':
      return { ...base, thumb: 0.8, index: 0.5, middle: 1, ring: 1, pinky: 1, spread: 0 };
    case 'Y':
      return { ...base, thumb: 0, index: 1, middle: 1, ring: 1, pinky: 0, spread: 0.8 };
    case 'Z':
      return { ...base, thumb: 0.8, index: 0, middle: 1, ring: 1, pinky: 1, wristY: 0.3, wristZ: -0.2 };
    default:
      return base;
  }
}

// Built-in artificial dictionary cleared per user request: only keeping StudioGalt authentic mocap words
export const ASL_SIGN_DICTIONARY: SignDefinition[] = [];

// Map StudioGalt dictionary items to SignDefinitions with authentic mocap keyframes
// Map StudioGalt dictionary items to SignDefinitions with authentic mocap keyframes
export const STUDIO_GALT_SIGNS: SignDefinition[] = STUDIO_GALT_DICTIONARY.map((entry) => {
  const words = [
    entry.word.toLowerCase(),
    entry.gloss.toLowerCase(),
  ].filter(Boolean);

  const w = entry.word.toUpperCase();
  if (w === "HELLO") {
    words.push("hello", "hi", "hey", "greetings", "welcome", "howdy");
  } else if (w === "PLEASE") {
    words.push("please", "pls");
  } else if (w === "MY") {
    words.push("my", "mine");
  } else if (w === "MY NAME IS") {
    words.push("my name is", "my name", "name is", "name");
  } else if (w === "YOU") {
    words.push("you", "your", "yours");
  } else if (w === "WHERE") {
    words.push("where");
  } else if (w === "WHICH") {
    words.push("which");
  } else if (w === "THIS") {
    words.push("this");
  } else if (w === "TAKE") {
    words.push("take", "adopt");
  } else if (w === "EQUAL") {
    words.push("equal", "fair", "same");
  } else if (w === "EVERYONE") {
    words.push("everyone", "everybody", "all");
  } else if (w === "FUTURE") {
    words.push("future", "later", "ahead");
  } else if (w === "OR") {
    words.push("or", "either");
  } else if (w === "TURN OFF") {
    words.push("turn off", "stop", "deactivate", "off");
  }

  // Keyframes from StudioGalt mocap keyposes
  const keyframes: GestureKeyframe[] = entry.keyposes.length > 0 ? entry.keyposes.map((kp, idx) => {
    const { rightHand, leftHand, head } = convertStudioGaltKeyposeToRigPose(kp, entry.facs);
    const durationMs = idx === 0 ? 320 : Math.max(280, Math.round((kp.frame / (entry.fps || 60)) * 650));
    return {
      durationMs,
      rightHand,
      leftHand,
      head,
    };
  }) : [
    {
      durationMs: 1200,
      rightHand: REST_POSE_RIGHT,
      leftHand: REST_POSE_LEFT,
      head: { nod: 0, tilt: 0, turn: 0, expression: "focused", eyebrows: "neutral" },
    },
  ];

  return {
    gloss: entry.word,
    matchedWords: Array.from(new Set(words)),
    category: entry.category,
    description: `[StudioGalt MoCap] ${entry.description}`,
    keyframes,
    studioGaltData: entry,
  };
});

// Companions like in Grok companion mode - Flagship is the real original GALTIS 3D character
export const COMPANIONS: Companion[] = [
  {
    id: 'galtis_real',
    name: 'GALTIS (ORIGINAL 3D)',
    tagline: 'StudioGalt Official 3D Avatar',
    accentColor: '#ee5a24', // StudioGalt Iconic Blender Orange
    glowHex: 0xee5a24,
    suitColor: 0x16181f,
    visorColor: 0xee5a24,
    mistColor: 0x241208,
    voicePitch: 1.15,
    avatarIcon: '🧡',
    lore: "The authentic, original Galtis 3D character directly from StudioGalt's GitHub repository. Features her signature orange studio outfit, dual-sided hair mesh (Strand008), 391 articulated bones, and recorded motion capture animation clips.",
    isGaltis: true,
    avatarVariant: 'galtis_original',
  },
  {
    id: 'galtis',
    name: 'GALTIS MOCAP RIG',
    tagline: 'Telemetry Sensor Suit',
    accentColor: '#2dd4bf', // StudioGalt Mint Teal
    glowHex: 0x2dd4bf,
    suitColor: 0x0c131f,
    visorColor: 0x2dd4bf,
    mistColor: 0x052026,
    voicePitch: 1.15,
    avatarIcon: '🤟',
    lore: "StudioGalt's open-source sign language rig, modeled for high-precision ASL motion capture with optical joint nodes and real-time bone coordinate tracking.",
    isGaltis: true,
    avatarVariant: 'galtis_mocap',
  },
  {
    id: 'galtis-cyber',
    name: 'GALTIS PRO',
    tagline: 'Cyber MoCap Suit',
    accentColor: '#38bdf8', // Neon Cyan
    glowHex: 0x38bdf8,
    suitColor: 0x0e1726,
    visorColor: 0x38bdf8,
    mistColor: 0x0f2b48,
    voicePitch: 1.2,
    avatarIcon: '⚡',
    lore: 'High-tech StudioGalt edition equipped with a neural heads-up visor, fiber-optic joint sensors, and real-time gesture telemetry.',
    isGaltis: true,
    avatarVariant: 'galtis_cyber',
  },
  {
    id: 'galtis-casual',
    name: 'GALTIS CASUAL',
    tagline: 'Studio Natural Shading',
    accentColor: '#a78bfa', // Studio Lavender
    glowHex: 0xa78bfa,
    suitColor: 0x1d182b,
    visorColor: 0xc4b5fd,
    mistColor: 0x1b1328,
    voicePitch: 1.05,
    avatarIcon: '✨',
    lore: 'Studio casual edition of Galtis with warm natural skin tones and organic conversational facial expressions.',
    isGaltis: true,
    avatarVariant: 'galtis_casual',
  },
  {
    id: 'galtis-skeleton',
    name: 'GALTIS SKELETON',
    tagline: 'MoCap Joint Visualizer',
    accentColor: '#4ade80', // Emerald Laser
    glowHex: 0x4ade80,
    suitColor: 0x081c12,
    visorColor: 0x4ade80,
    mistColor: 0x052115,
    voicePitch: 1.0,
    avatarIcon: '📐',
    lore: 'Raw 3D skeletal mocap visualizer highlighting the 391 coordinate bone axes, locator nodes, and rotation pivots.',
    isGaltis: true,
    avatarVariant: 'galtis_skeleton',
  },
  {
    id: 'kai',
    name: 'KAI',
    tagline: 'Cyber ASL Specialist',
    accentColor: '#38bdf8',
    glowHex: 0x38bdf8,
    suitColor: 0x0e1726,
    visorColor: 0x38bdf8,
    mistColor: 0x0f2b48,
    voicePitch: 1.1,
    avatarIcon: '⚡',
    lore: 'High-speed synthetic interpreter with real-time neural gesture tracking and ASL fingerspelling.',
  },
  {
    id: 'nova',
    name: 'NOVA',
    tagline: 'Solar Radiant Companion',
    accentColor: '#fbbf24',
    glowHex: 0xfbbf24,
    suitColor: 0x1c150b,
    visorColor: 0xfbbf24,
    mistColor: 0x2e1e0a,
    voicePitch: 1.3,
    avatarIcon: '✨',
    lore: 'Warm acoustic specialist trained on conversational expressions, emotional signs, and welcoming gestures.',
  },
  {
    id: 'orion',
    name: 'ORION',
    tagline: 'Deep Space Minimalist',
    accentColor: '#a855f7',
    glowHex: 0xa855f7,
    suitColor: 0x160f24,
    visorColor: 0xc084fc,
    mistColor: 0x1f0f35,
    voicePitch: 0.9,
    avatarIcon: '🌌',
    lore: 'Cosmic deep-space model optimized for clear anatomical precision and articulated hand poses.',
  },
  {
    id: 'echo',
    name: 'ECHO',
    tagline: 'Bioluminescent Android',
    accentColor: '#34d399',
    glowHex: 0x34d399,
    suitColor: 0x071e16,
    visorColor: 0x34d399,
    mistColor: 0x0a2b1e,
    voicePitch: 1.2,
    avatarIcon: '🍃',
    lore: 'Organic fluid motion specialist mimicking natural human signer velocity and subtle head tilt cues.',
  },
];

// Unified ASL and StudioGalt dictionary
// Unified dictionary containing exclusively StudioGalt mocap words
export const ALL_SIGNS: SignDefinition[] = [
  ...STUDIO_GALT_SIGNS,
];

const normalizePhrase = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const SIGN_BY_PHRASE = new Map<string, SignDefinition>();
// Exact dictionary labels take precedence over aliases. Never turn every word
// inside a phrase into an alias ("a bit" must not hijack the letter "a").
for (const sign of ALL_SIGNS) SIGN_BY_PHRASE.set(normalizePhrase(sign.gloss), sign);
for (const sign of ALL_SIGNS) for (const alias of sign.matchedWords) {
  const key = normalizePhrase(alias);
  if (key && !SIGN_BY_PHRASE.has(key)) SIGN_BY_PHRASE.set(key, sign);
}
// StudioGalt labels the first recording of many signs with a trailing "1".
// Retain that display label while allowing the unnumbered spoken word.
for (const sign of ALL_SIGNS) {
  const match = sign.gloss.match(/^([A-Z][A-Z '-]*) 1$/i);
  if (match && !SIGN_BY_PHRASE.has(normalizePhrase(match[1]))) SIGN_BY_PHRASE.set(normalizePhrase(match[1]), sign);
}
const MAX_PHRASE_WORDS = Math.max(1, ...[...SIGN_BY_PHRASE.keys()].map(key => key.split(' ').length));

// Look up sign definition or fallback to fingerspelling
export function parseSpeechToSigns(text: string, autoFingerspell: boolean = true): {
  tokens: string[];
  signQueue: { type: 'gloss' | 'letter'; id: string; name: string; def?: SignDefinition; char?: string }[];
} {
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  if (!clean) return { tokens: [], signQueue: [] };

  const words = clean.split(/\s+/).filter(Boolean);
  const queue: { type: 'gloss' | 'letter'; id: string; name: string; def?: SignDefinition; char?: string }[] = [];

  let i = 0;
  while (i < words.length) {
    const word = words[i];

    let foundSingle: SignDefinition | undefined;
    let matchedLength = 1;
    for (let length = Math.min(MAX_PHRASE_WORDS, words.length - i); length > 0; length--) {
      const match = SIGN_BY_PHRASE.get(words.slice(i, i + length).join(' '));
      if (match) { foundSingle = match; matchedLength = length; break; }
    }
    if (foundSingle) {
      queue.push({
        type: 'gloss',
        id: `${foundSingle.gloss}-${Date.now()}-${queue.length}`,
        name: foundSingle.gloss,
        def: foundSingle,
      });
      i += matchedLength;
    } else if (autoFingerspell) {
      // Fingerspell each character of unknown word
      const letters = word.toUpperCase().split('');
      for (const char of letters) {
        if (/[A-Z]/.test(char)) {
          queue.push({
            type: 'letter',
            id: `letter-${char}-${Date.now()}-${queue.length}`,
            name: char,
            char,
          });
        }
      }
      i++;
    } else {
      i++;
    }
  }

  return { tokens: words, signQueue: queue };
}
