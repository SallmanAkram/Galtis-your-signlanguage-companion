import { StudioGaltWordEntry, StudioGaltKeypose, GestureKeyframe, HandPose, HeadPose } from '../types';
import rawData from './studioGaltDictionaryData.json';

export const STUDIO_GALT_DICTIONARY: StudioGaltWordEntry[] = [
  ...((rawData as unknown) as StudioGaltWordEntry[]),
  {
    id: 'sg-turn-off',
    word: 'TURN OFF',
    gloss: 'TURN OFF / STOP',
    category: 'Commands & Actions',
    source: 'StudioGalt MoCap Archive',
    parentMotion: 'Galtis 8 (turn_off.json)',
    animationFile: 'turn_off.json',
    description: 'Studio motion capture sign for Turn Off / Deactivate / Stop.',
    facs: { browRaise: 0, browFurrow: 0, mouthSmile: 0 },
    fps: 30,
    keyposes: [],
    durationSec: 1.65,
  },
];

/**
 * Convert StudioGalt Euler/Quat bone coordinates from a Keypose into CharacterRig compatible HandPose & HeadPose
 */
export function convertStudioGaltKeyposeToRigPose(
  keypose: StudioGaltKeypose,
  facs?: StudioGaltWordEntry['facs']
): { rightHand: HandPose; leftHand: HandPose; head: HeadPose } {
  const bones = keypose.bones || {};

  // Extract right arm bones
  const bicepR = bones['bicepfk_R'] || bones['upperarm_r'];
  const forearmR = bones['forearmfk_R'] || bones['lowerarm_r'];
  const handR = bones['handfk_R'] || bones['hand_r'];

  // Extract left arm bones
  const bicepL = bones['bicepfk_L'] || bones['upperarm_l'];
  const forearmL = bones['forearmfk_L'] || bones['lowerarm_l'];
  const handL = bones['handfk_L'] || bones['hand_l'];

  // Extract neck/head
  const neck = bones['neckfk'] || bones['neck_01'];
  const head = bones['headfk'] || bones['head'];

  // Helper to convert deg to rad
  const deg2rad = (deg: number) => (deg * Math.PI) / 180;

  // Finger curl estimation from 3-segment fk bones
  const getFingerCurl = (prefix: string, isLeft = false): number => {
    const side = isLeft ? 'L' : 'R';
    // Check joints 01, 02, 03
    let totalRot = 0;
    for (let i = 1; i <= 3; i++) {
      const b = bones[`${prefix}fk_0${i}_${side}`] || bones[`${prefix}_0${i}_${side.toLowerCase()}`];
      if (b && b.eulerDegrees) {
        // Look at primary bend axis (often pitch/x or roll)
        totalRot += Math.abs(b.eulerDegrees[0]) + Math.abs(b.eulerDegrees[1]);
      }
    }
    // Normalize ~ 0-90 degrees to 0-1
    return Math.min(1.0, Math.max(0.0, totalRot / 85));
  };

  const rightHand: HandPose = {
    // Shoulder rotation
    shoulderX: bicepR?.eulerDegrees ? deg2rad(bicepR.eulerDegrees[0]) : 0,
    shoulderY: bicepR?.eulerDegrees ? deg2rad(bicepR.eulerDegrees[1]) : 0,
    shoulderZ: bicepR?.eulerDegrees ? deg2rad(bicepR.eulerDegrees[2]) : 0,
    // Elbow rotation
    elbowX: forearmR?.eulerDegrees ? deg2rad(forearmR.eulerDegrees[0]) : 0,
    elbowY: forearmR?.eulerDegrees ? deg2rad(forearmR.eulerDegrees[1]) : 0,
    elbowZ: forearmR?.eulerDegrees ? deg2rad(forearmR.eulerDegrees[2]) : 0,
    // Wrist rotation
    wristX: handR?.eulerDegrees ? deg2rad(handR.eulerDegrees[0]) : 0,
    wristY: handR?.eulerDegrees ? deg2rad(handR.eulerDegrees[1]) : 0,
    wristZ: handR?.eulerDegrees ? deg2rad(handR.eulerDegrees[2]) : 0,
    // Articulated fingers
    thumb: getFingerCurl('thumb', false),
    index: getFingerCurl('index', false),
    middle: getFingerCurl('middle', false),
    ring: getFingerCurl('ring', false),
    pinky: getFingerCurl('pinky', false),
    spread: 0.15,
  };

  const leftHand: HandPose = {
    shoulderX: bicepL?.eulerDegrees ? deg2rad(bicepL.eulerDegrees[0]) : 0,
    shoulderY: bicepL?.eulerDegrees ? deg2rad(bicepL.eulerDegrees[1]) : 0,
    shoulderZ: bicepL?.eulerDegrees ? deg2rad(bicepL.eulerDegrees[2]) : 0,
    elbowX: forearmL?.eulerDegrees ? deg2rad(forearmL.eulerDegrees[0]) : 0,
    elbowY: forearmL?.eulerDegrees ? deg2rad(forearmL.eulerDegrees[1]) : 0,
    elbowZ: forearmL?.eulerDegrees ? deg2rad(forearmL.eulerDegrees[2]) : 0,
    wristX: handL?.eulerDegrees ? deg2rad(handL.eulerDegrees[0]) : 0,
    wristY: handL?.eulerDegrees ? deg2rad(handL.eulerDegrees[1]) : 0,
    wristZ: handL?.eulerDegrees ? deg2rad(handL.eulerDegrees[2]) : 0,
    thumb: getFingerCurl('thumb', true),
    index: getFingerCurl('index', true),
    middle: getFingerCurl('middle', true),
    ring: getFingerCurl('ring', true),
    pinky: getFingerCurl('pinky', true),
    spread: 0.15,
  };

  const headPose: HeadPose = {
    nod: head?.eulerDegrees ? deg2rad(head.eulerDegrees[0]) : 0,
    tilt: head?.eulerDegrees ? deg2rad(head.eulerDegrees[2]) : (facs?.headTilt || 0),
    turn: head?.eulerDegrees ? deg2rad(head.eulerDegrees[1]) : 0,
    eyebrows: (facs?.browFurrow && facs.browFurrow > 0.4) ? 'furrowed' : (facs?.browRaise && facs.browRaise > 0.15) ? 'raised' : 'neutral',
    expression: (facs?.mouthSmile && facs.mouthSmile > 0.2) ? 'smile' : 'focused',
  };

  return { rightHand, leftHand, head: headPose };
}

/**
 * Generate standard .anim coordinate file text for 3D engine import (Unity / Blender / Unreal)
 */
export function generateAnimFileContent(word: StudioGaltWordEntry): string {
  const lines: string[] = [];
  lines.push(`%YAML 1.1`);
  lines.push(`%TAG !u! tag:unity3d.com,2011:`);
  lines.push(`--- !u!74 &7400000`);
  lines.push(`AnimationClip:`);
  lines.push(`  m_ObjectHideFlags: 0`);
  lines.push(`  m_CorrespondingSourceObject: {fileID: 0}`);
  lines.push(`  m_PrefabInstance: {fileID: 0}`);
  lines.push(`  m_PrefabAsset: {fileID: 0}`);
  lines.push(`  m_Name: StudioGalt_${word.word.replace(/\s+/g, '_')}_60fps`);
  lines.push(`  serializedVersion: 7`);
  lines.push(`  m_Legacy: 0`);
  lines.push(`  m_Compressed: 0`);
  lines.push(`  m_UseHighQualityCurve: 1`);
  lines.push(`  m_RotationCurves:`);

  // Output rotation curves for primary bones across keyposes
  const sampleBones = ['bicepfk_R', 'forearmfk_R', 'handfk_R', 'bicepfk_L', 'forearmfk_L', 'handfk_L', 'headfk'];
  sampleBones.forEach((bName) => {
    lines.push(`  - curve:`);
    lines.push(`      serializedVersion: 2`);
    lines.push(`      m_Curve:`);
    word.keyposes.forEach((kp) => {
      const time = (kp.frame / word.fps).toFixed(4);
      const b = kp.bones[bName];
      const q = b ? b.quaternion : [1, 0, 0, 0];
      lines.push(`      - serializedVersion: 3`);
      lines.push(`        time: ${time}`);
      lines.push(`        value: {x: ${q[1]}, y: ${q[2]}, z: ${q[3]}, w: ${q[0]}}`);
      lines.push(`        inSlope: {x: 0, y: 0, z: 0, w: 0}`);
      lines.push(`        outSlope: {x: 0, y: 0, z: 0, w: 0}`);
      lines.push(`        tangentMode: 0`);
      lines.push(`        weightedMode: 0`);
      lines.push(`        inWeight: {x: 0.33333334, y: 0.33333334, z: 0.33333334, w: 0.33333334}`);
      lines.push(`        outWeight: {x: 0.33333334, y: 0.33333334, z: 0.33333334, w: 0.33333334}`);
    });
    lines.push(`      path: Rig/Galtis_Skeleton/${bName}`);
  });

  lines.push(`  m_PositionCurves: []`);
  lines.push(`  m_ScaleCurves: []`);
  lines.push(`  m_FloatCurves: []`);
  lines.push(`  m_SampleRate: ${word.fps}`);
  lines.push(`  # Metadata`);
  lines.push(`  # StudioGalt Motion: ${word.parentMotion}`);
  lines.push(`  # Upload Folder: ${word.source}`);
  lines.push(`  # ASL Gloss: ${word.gloss}`);
  lines.push(`  # Total Bones Recorded: ${word.keyposes[0]?.boneCount || 391}`);

  return lines.join('\n');
}

/**
 * Trigger browser file download of the .anim file or .json coordinates
 */
export function downloadAnimCoordinateFile(word: StudioGaltWordEntry, format: 'anim' | 'json' = 'anim') {
  if (format === 'json' && word.animationFile) {
    const link = document.createElement('a');
    link.href = `/animations/full_mesh/${word.animationFile}`;
    link.download = word.animationFile;
    document.body.appendChild(link); link.click(); link.remove();
    return;
  }
  if (format === 'anim' && !word.keyposes.length) return;
  let content = '';
  let filename = '';
  let mimeType = '';

  if (format === 'anim') {
    content = generateAnimFileContent(word);
    filename = `StudioGalt_Galtis8_${word.word.replace(/\s+/g, '_')}.anim`;
    mimeType = 'text/plain';
  } else {
    content = JSON.stringify(word, null, 2);
    filename = `StudioGalt_${word.word.replace(/\s+/g, '_')}_Poses.json`;
    mimeType = 'application/json';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
