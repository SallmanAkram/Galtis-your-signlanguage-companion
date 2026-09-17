import * as THREE from 'three';
import { GestureKeyframe, HandPose, HeadPose } from '../types';
import { REST_POSE_LEFT, REST_POSE_RIGHT } from '../data/aslDictionary';

export interface LiveMocapPoseResult {
  keyframe: GestureKeyframe;
  hasHands: boolean;
  hasPose: boolean;
  isRightHandTracked: boolean;
  isLeftHandTracked: boolean;
}

interface Point3D {
  x: number;
  y: number;
  z?: number;
}

function dist3D(p1: Point3D, p2: Point3D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculates continuous finger curl from 0.05 (straight / open) to 1.0 (fully curled into fist)
 */
function getFingerCurl(
  landmarks: Point3D[],
  tipIdx: number,
  dipIdx: number,
  pipIdx: number,
  mcpIdx: number
): number {
  if (!landmarks || landmarks.length <= tipIdx) return 0.25;
  const mcp = landmarks[mcpIdx];
  const pip = landmarks[pipIdx];
  const dip = landmarks[dipIdx];
  const tip = landmarks[tipIdx];

  const totalLen = dist3D(mcp, pip) + dist3D(pip, dip) + dist3D(dip, tip);
  const tipToMcp = dist3D(mcp, tip);

  if (totalLen < 0.001) return 0.25;
  const ratio = tipToMcp / totalLen; // ~0.92 extended, ~0.35 curled
  return THREE.MathUtils.clamp((0.85 - ratio) / 0.5, 0.05, 1.0);
}

/**
 * Calculates thumb curl from 0.05 (open thumb) to 1.0 (tucked thumb)
 */
function getThumbCurl(landmarks: Point3D[]): number {
  if (!landmarks || landmarks.length <= 4) return 0.2;
  const thumbTip = landmarks[4];
  const thumbMcp = landmarks[2];
  const pinkyMcp = landmarks[17];
  const indexMcp = landmarks[5];

  const d = dist3D(thumbTip, pinkyMcp);
  const base = dist3D(thumbMcp, indexMcp) * 1.8;
  if (base < 0.001) return 0.2;
  const ratio = d / base;
  return THREE.MathUtils.clamp(1.0 - ratio, 0.05, 1.0);
}

/**
 * Computes arm joint rotations (shoulderX, Y, Z, elbowX, Y, Z, wristX, Y, Z) from 3D points
 */
function solveArmKinematics(
  shoulder: Point3D,
  elbow: Point3D,
  wrist: Point3D,
  handLandmarks: Point3D[] | null,
  isRight: boolean
): HandPose {
  const defaultRest = isRight ? REST_POSE_RIGHT : REST_POSE_LEFT;

  // 1. Vector: Shoulder -> Elbow (Upper Arm)
  const vUpper = {
    x: elbow.x - shoulder.x,
    y: elbow.y - shoulder.y,
    z: (elbow.z || 0) - (shoulder.z || 0),
  };

  // 2. Vector: Elbow -> Wrist (Forearm)
  const vFore = {
    x: wrist.x - elbow.x,
    y: wrist.y - elbow.y,
    z: (wrist.z || 0) - (elbow.z || 0),
  };

  // 3. Elbow Flexion Angle: angle between (shoulder - elbow) and (wrist - elbow)
  const v1 = { x: -vUpper.x, y: -vUpper.y, z: -vUpper.z };
  const v2 = { x: vFore.x, y: vFore.y, z: vFore.z };
  const l1 = Math.hypot(v1.x, v1.y, v1.z);
  const l2 = Math.hypot(v2.x, v2.y, v2.z);

  let elbowFlexion = 0.25;
  if (l1 > 0.02 && l2 > 0.02) {
    const dot = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (l1 * l2);
    const angleBetween = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));
    // When arm is straight: angleBetween is ~PI. When bent: angleBetween decreases.
    elbowFlexion = THREE.MathUtils.clamp(Math.PI - angleBetween, 0.15, 2.4);
  }
  const elbowX = elbowFlexion;

  // 4. Shoulder Elevation / Pitch (X rotation)
  // In screen space, y increases downwards.
  // When elbow is raised higher than shoulder, (shoulder.y - elbow.y) is positive.
  const dyElbow = shoulder.y - elbow.y;
  const dyWrist = shoulder.y - wrist.y;
  const dzElbow = (shoulder.z || 0) - (elbow.z || 0); // elbow moving towards camera is positive

  // Take the highest point between elbow and wrist to capture both raised arm and bent arm
  const effectiveElevation = Math.max(dyElbow, dyWrist * 0.7);

  // At rest (arm hanging down): dyElbow is ~ -0.25, shoulderX is +0.1
  // When arm is horizontal forward: dyElbow ~ 0, shoulderX ~ -1.4
  // When arm is raised straight up: dyElbow ~ +0.3, shoulderX ~ -2.7
  const elevationAngle = (effectiveElevation + 0.22) * 3.6 + dzElbow * 1.6;
  const shoulderX = THREE.MathUtils.clamp(0.1 - elevationAngle, -2.8, 0.45);

  // 5. Shoulder Abduction / Sideways Spread (Z rotation)
  // Distance from torso side:
  const sideSpread = isRight ? (elbow.x - shoulder.x) : (shoulder.x - elbow.x);
  const spreadFactor = THREE.MathUtils.clamp((sideSpread - 0.02) * 4.0, 0.0, 1.8);
  const shoulderZ = isRight ? -0.15 - spreadFactor : 0.15 + spreadFactor;

  // 6. Shoulder Rotation / Inward-Outward Angle (Y rotation)
  const inwardCross = isRight ? -(wrist.x - shoulder.x) : (wrist.x - shoulder.x);
  const shoulderY = THREE.MathUtils.clamp(inwardCross * 1.8, -0.8, 0.8);

  // 7. Forearm twist / Yaw
  const elbowY = THREE.MathUtils.clamp(vFore.x * (isRight ? -1.5 : 1.5), -0.7, 0.7);
  const elbowZ = THREE.MathUtils.clamp(vFore.y * 0.5, -0.4, 0.4);

  // 8. Wrist orientation & Finger Curls from HandLandmarks
  let wristX = 0;
  let wristY = 0;
  let wristZ = 0;
  let thumb = defaultRest.thumb || 0.2;
  let index = defaultRest.index || 0.2;
  let middle = defaultRest.middle || 0.25;
  let ring = defaultRest.ring || 0.25;
  let pinky = defaultRest.pinky || 0.25;

  if (handLandmarks && handLandmarks.length >= 21) {
    const wristPt = handLandmarks[0];
    const middleMcp = handLandmarks[9];
    const palmVec = {
      x: middleMcp.x - wristPt.x,
      y: middleMcp.y - wristPt.y,
      z: (middleMcp.z || 0) - (wristPt.z || 0),
    };

    // Wrist pitch: angle of palm compared to forearm
    wristX = THREE.MathUtils.clamp((palmVec.y - vFore.y) * 2.2, -0.85, 0.85);
    wristY = THREE.MathUtils.clamp((palmVec.x - vFore.x) * (isRight ? -2.2 : 2.2), -0.85, 0.85);

    // Continuous finger curls
    thumb = getThumbCurl(handLandmarks);
    index = getFingerCurl(handLandmarks, 8, 7, 6, 5);
    middle = getFingerCurl(handLandmarks, 12, 11, 10, 9);
    ring = getFingerCurl(handLandmarks, 16, 15, 14, 13);
    pinky = getFingerCurl(handLandmarks, 20, 19, 18, 17);
  }

  return {
    shoulderX,
    shoulderY,
    shoulderZ,
    elbowX,
    elbowY,
    elbowZ,
    wristX,
    wristY,
    wristZ,
    thumb,
    index,
    middle,
    ring,
    pinky,
    spread: 0,
  };
}

/**
 * Computes head nod, tilt, and turn from facial landmarks
 */
function solveHeadPose(poseLandmarks: Point3D[]): HeadPose {
  if (!poseLandmarks || poseLandmarks.length < 11) {
    return { nod: 0, tilt: 0, turn: 0 };
  }

  const nose = poseLandmarks[0];
  const leftEye = poseLandmarks[2] || poseLandmarks[0];
  const rightEye = poseLandmarks[5] || poseLandmarks[0];
  const leftEar = poseLandmarks[7];
  const rightEar = poseLandmarks[8];

  // Head Turn (Yaw): distance difference from nose to ears
  let turn = 0;
  if (leftEar && rightEar) {
    const dL = dist3D(nose, leftEar);
    const dR = dist3D(nose, rightEar);
    const denom = dL + dR + 1e-5;
    // Mirrored camera: turning to right moves nose closer to right ear
    turn = THREE.MathUtils.clamp(((dR - dL) / denom) * 1.35, -0.7, 0.7);
  }

  // Head Tilt (Roll): tilt angle of eye line
  let tilt = 0;
  if (leftEye && rightEye) {
    const dy = rightEye.y - leftEye.y;
    const dx = rightEye.x - leftEye.x;
    tilt = THREE.MathUtils.clamp(Math.atan2(dy, Math.max(0.04, Math.abs(dx))) * 0.9, -0.5, 0.5);
  }

  // Head Nod (Pitch): vertical difference between nose and eyes
  const eyeCenterY = (leftEye.y + rightEye.y) / 2;
  const nod = THREE.MathUtils.clamp((nose.y - eyeCenterY - 0.07) * 2.8, -0.5, 0.5);

  return { nod, tilt, turn };
}

/**
 * Main Solver: MediaPipe Pose + Hand Landmarks -> Complete Rig Keyframe
 */
export function solveMediaPipeToRigPose(
  poseLandmarks: Point3D[] | null,
  handResults: any,
  isMirrored: boolean = true
): LiveMocapPoseResult | null {
  if (!poseLandmarks && (!handResults || !handResults.landmarks || handResults.landmarks.length === 0)) {
    return null;
  }

  // Separate detected hands by handedness
  let rightHandLandmarks: Point3D[] | null = null;
  let leftHandLandmarks: Point3D[] | null = null;

  if (handResults && handResults.landmarks && handResults.landmarks.length > 0) {
    if (poseLandmarks && poseLandmarks.length >= 17) {
      const leftWrist = poseLandmarks[15];
      const rightWrist = poseLandmarks[16];
      handResults.landmarks.forEach((lms: Point3D[]) => {
        const wristPt = lms[0];
        const dR = dist3D(wristPt, rightWrist);
        const dL = dist3D(wristPt, leftWrist);
        if (dR < dL) {
          rightHandLandmarks = lms;
        } else {
          leftHandLandmarks = lms;
        }
      });
    } else {
      handResults.landmarks.forEach((lms: Point3D[], idx: number) => {
        const label =
          handResults.handednesses?.[idx]?.[0]?.categoryName ||
          handResults.handednesses?.[idx]?.[0]?.displayName ||
          'Right';
        if (isMirrored) {
          // In raw webcam video with selfie orientation, right hand is on left half (x <= 0.5)
          if (lms[0].x <= 0.5) rightHandLandmarks = lms;
          else leftHandLandmarks = lms;
        } else {
          if (label.toLowerCase().includes('right')) rightHandLandmarks = lms;
          else leftHandLandmarks = lms;
        }
      });
    }
  }

  let rightArmPose: HandPose = { ...REST_POSE_RIGHT };
  let leftArmPose: HandPose = { ...REST_POSE_LEFT };
  let headPose: HeadPose = { nod: 0, tilt: 0, turn: 0 };
  let hasPose = false;

  if (poseLandmarks && poseLandmarks.length >= 17) {
    hasPose = true;
    headPose = solveHeadPose(poseLandmarks);

    // Landmarks:
    // 11: left_shoulder, 12: right_shoulder
    // 13: left_elbow,    14: right_elbow
    // 15: left_wrist,    16: right_wrist
    const leftShoulder = poseLandmarks[11];
    const rightShoulder = poseLandmarks[12];
    const leftElbow = poseLandmarks[13];
    const rightElbow = poseLandmarks[14];
    const leftWrist = poseLandmarks[15];
    const rightWrist = poseLandmarks[16];

    // Right arm
    rightArmPose = solveArmKinematics(
      rightShoulder,
      rightElbow,
      rightWrist,
      rightHandLandmarks,
      true
    );

    // Left arm
    leftArmPose = solveArmKinematics(
      leftShoulder,
      leftElbow,
      leftWrist,
      leftHandLandmarks,
      false
    );
  } else {
    // If only hands are detected without body pose, still compute finger curls and raise hands
    if (rightHandLandmarks) {
      rightArmPose = {
        ...REST_POSE_RIGHT,
        shoulderX: -0.4,
        elbowX: 1.2,
        thumb: getThumbCurl(rightHandLandmarks),
        index: getFingerCurl(rightHandLandmarks, 8, 7, 6, 5),
        middle: getFingerCurl(rightHandLandmarks, 12, 11, 10, 9),
        ring: getFingerCurl(rightHandLandmarks, 16, 15, 14, 13),
        pinky: getFingerCurl(rightHandLandmarks, 20, 19, 18, 17),
      };
    }
    if (leftHandLandmarks) {
      leftArmPose = {
        ...REST_POSE_LEFT,
        shoulderX: -0.4,
        elbowX: 1.2,
        thumb: getThumbCurl(leftHandLandmarks),
        index: getFingerCurl(leftHandLandmarks, 8, 7, 6, 5),
        middle: getFingerCurl(leftHandLandmarks, 12, 11, 10, 9),
        ring: getFingerCurl(leftHandLandmarks, 16, 15, 14, 13),
        pinky: getFingerCurl(leftHandLandmarks, 20, 19, 18, 17),
      };
    }
  }

  return {
    keyframe: {
      rightHand: rightArmPose,
      leftHand: leftArmPose,
      head: headPose,
      durationMs: 60,
    },
    hasHands: !!(rightHandLandmarks || leftHandLandmarks),
    hasPose,
    isRightHandTracked: !!rightHandLandmarks,
    isLeftHandTracked: !!leftHandLandmarks,
  };
}
