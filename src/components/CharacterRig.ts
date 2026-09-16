import * as THREE from 'three';
import { HandPose, HeadPose, GestureKeyframe, Companion, StudioGaltBoneCoordinate } from '../types';
import { REST_POSE_LEFT, REST_POSE_RIGHT, READY_POSE_LEFT, READY_POSE_RIGHT } from '../data/aslDictionary';

// Finger structure
export interface ArticulatedFinger {
  base: THREE.Group;
  mid: THREE.Group;
  tip: THREE.Mesh;
}

export interface ArticulatedHand {
  root: THREE.Group;
  palmMesh: THREE.Mesh;
  wrist: THREE.Group;
  thumb: ArticulatedFinger;
  index: ArticulatedFinger;
  middle: ArticulatedFinger;
  ring: ArticulatedFinger;
  pinky: ArticulatedFinger;
}

export interface ArticulatedArm {
  shoulder: THREE.Group;
  upperArm: THREE.Mesh;
  elbow: THREE.Group;
  forearm: THREE.Mesh;
  hand: ArticulatedHand;
  mocapMarkers: THREE.Mesh[];
}

export interface LiveMocapCoordinates {
  signName: string;
  poseProgress: number; // 0 to 1
  frame: number;
  bones: Record<string, StudioGaltBoneCoordinate>;
  facs: {
    browRaise: number;
    browFurrow: number;
    mouthSmile: number;
    mouthOpen: number;
    eyeBlink: number;
  };
}

export class Character3D {
  public root: THREE.Group;
  public headGroup: THREE.Group;
  public headMesh: THREE.Mesh;
  public faceGroup: THREE.Group;
  public leftEye: THREE.Mesh;
  public rightEye: THREE.Mesh;
  public leftEyelid: THREE.Mesh;
  public rightEyelid: THREE.Mesh;
  public leftBrow: THREE.Mesh;
  public rightBrow: THREE.Mesh;
  public mouthMesh: THREE.Mesh;
  public hairGroup: THREE.Group;
  public visorMesh: THREE.Mesh;
  public chestMesh: THREE.Mesh;
  public coreMesh: THREE.Mesh;
  public skeletonOverlayGroup: THREE.Group;
  public leftArm: ArticulatedArm;
  public rightArm: ArticulatedArm;

  // Materials for skinning / companion switching
  public suitMaterial: THREE.MeshStandardMaterial;
  public skinMaterial: THREE.MeshStandardMaterial;
  public visorMaterial: THREE.MeshStandardMaterial;
  public jointMaterial: THREE.MeshStandardMaterial;
  public markerMaterial: THREE.MeshBasicMaterial;
  public coreMaterial: THREE.MeshBasicMaterial;
  public hairMaterial: THREE.MeshStandardMaterial;
  public skeletonLineMaterial: THREE.LineBasicMaterial;
  public skeletonJointMaterial: THREE.MeshBasicMaterial;

  // Current animated target states
  public currentLeftPose: HandPose = { ...REST_POSE_LEFT };
  public targetLeftPose: HandPose = { ...REST_POSE_LEFT };
  public currentRightPose: HandPose = { ...REST_POSE_RIGHT };
  public targetRightPose: HandPose = { ...REST_POSE_RIGHT };

  public currentHeadPose: HeadPose = { nod: 0, tilt: 0, turn: 0 };
  public targetHeadPose: HeadPose = { nod: 0, tilt: 0, turn: 0 };

  // Live coordinate stream cache
  public currentSignName: string = 'IDLE';
  public currentFrame: number = 1;
  public activeFacs = {
    browRaise: 0,
    browFurrow: 0,
    mouthSmile: 0,
    mouthOpen: 0,
    eyeBlink: 0,
  };

  // Idle timers
  private idleTime = 0;
  public isSigning = false;
  private blinkTimer = 0;
  private nextBlinkInterval = 3.2;

  constructor(scene: THREE.Scene, suitColor: number = 0x0c131f, visorColor: number = 0x2dd4bf) {
    this.root = new THREE.Group();
    this.root.position.set(0, 0, 0);

    // 1. Materials
    this.suitMaterial = new THREE.MeshStandardMaterial({
      color: suitColor,
      roughness: 0.35,
      metalness: 0.65,
    });

    this.skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8c1a0, // Warm realistic skin
      roughness: 0.55,
      metalness: 0.05,
    });

    this.jointMaterial = new THREE.MeshStandardMaterial({
      color: 0x181e2b,
      roughness: 0.45,
      metalness: 0.7,
    });

    this.visorMaterial = new THREE.MeshStandardMaterial({
      color: visorColor,
      emissive: visorColor,
      emissiveIntensity: 0.85,
      roughness: 0.1,
      metalness: 0.9,
    });

    this.markerMaterial = new THREE.MeshBasicMaterial({
      color: visorColor,
    });

    this.coreMaterial = new THREE.MeshBasicMaterial({
      color: visorColor,
    });

    this.hairMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1520, // Dark brown / black sleek hair
      roughness: 0.4,
      metalness: 0.2,
    });

    this.skeletonLineMaterial = new THREE.LineBasicMaterial({
      color: visorColor,
      transparent: true,
      opacity: 0.75,
      linewidth: 2,
    });

    this.skeletonJointMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    // 2. Torso / Upper Body (Sculpted Galtis 8 silhouette)
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 1.35, 0);

    // Main chest mesh (ergonomic feminine athletic cut)
    const chestGeo = new THREE.CylinderGeometry(0.30, 0.21, 0.68, 20);
    this.chestMesh = new THREE.Mesh(chestGeo, this.suitMaterial);
    this.chestMesh.scale.set(1.15, 1.0, 0.68);
    this.chestMesh.castShadow = true;
    this.chestMesh.receiveShadow = true;
    torsoGroup.add(this.chestMesh);

    // StudioGalt chest emblem / optical mocap sternum marker
    const coreGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16);
    this.coreMesh = new THREE.Mesh(coreGeo, this.coreMaterial);
    this.coreMesh.rotation.x = Math.PI / 2;
    this.coreMesh.position.set(0, 0.12, 0.23);
    torsoGroup.add(this.coreMesh);

    // Collar / Neck with mocap cervical marker
    const neckGeo = new THREE.CylinderGeometry(0.105, 0.125, 0.17, 16);
    const neckMesh = new THREE.Mesh(neckGeo, this.skinMaterial);
    neckMesh.position.set(0, 0.41, 0);
    torsoGroup.add(neckMesh);

    // Neck ring sensor
    const neckRingGeo = new THREE.TorusGeometry(0.12, 0.012, 8, 24);
    const neckRing = new THREE.Mesh(neckRingGeo, this.jointMaterial);
    neckRing.rotation.x = Math.PI / 2;
    neckRing.position.set(0, 0.35, 0);
    torsoGroup.add(neckRing);

    // 3. Head & Face (FACS Blendshapes & Expressive Features)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.58, 0);

    // Sculpted cranial base
    const headGeo = new THREE.SphereGeometry(0.23, 24, 24);
    this.headMesh = new THREE.Mesh(headGeo, this.skinMaterial);
    this.headMesh.scale.set(0.92, 1.08, 0.98);
    this.headMesh.castShadow = true;
    this.headGroup.add(this.headMesh);

    // Face group for facial blendshapes
    this.faceGroup = new THREE.Group();
    this.faceGroup.position.set(0, 0, 0.18);
    this.headGroup.add(this.faceGroup);

    // Eyes (left & right)
    const eyeGeo = new THREE.SphereGeometry(0.035, 12, 12);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.1 });
    
    this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.leftEye.position.set(-0.065, 0.04, 0.05);
    this.faceGroup.add(this.leftEye);

    this.rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.rightEye.position.set(0.065, 0.04, 0.05);
    this.faceGroup.add(this.rightEye);

    // Eyelids for blinking
    const eyelidGeo = new THREE.BoxGeometry(0.055, 0.02, 0.04);
    this.leftEyelid = new THREE.Mesh(eyelidGeo, this.skinMaterial);
    this.leftEyelid.position.set(-0.065, 0.058, 0.055);
    this.faceGroup.add(this.leftEyelid);

    this.rightEyelid = new THREE.Mesh(eyelidGeo, this.skinMaterial);
    this.rightEyelid.position.set(0.065, 0.058, 0.055);
    this.faceGroup.add(this.rightEyelid);

    // Eyebrows for grammatical facial expressions in ASL
    const browGeo = new THREE.BoxGeometry(0.065, 0.012, 0.02);
    const browMat = new THREE.MeshStandardMaterial({ color: 0x15101a, roughness: 0.6 });

    this.leftBrow = new THREE.Mesh(browGeo, browMat);
    this.leftBrow.position.set(-0.065, 0.09, 0.055);
    this.leftBrow.rotation.z = -0.05;
    this.faceGroup.add(this.leftBrow);

    this.rightBrow = new THREE.Mesh(browGeo, browMat);
    this.rightBrow.position.set(0.065, 0.09, 0.055);
    this.rightBrow.rotation.z = 0.05;
    this.faceGroup.add(this.rightBrow);

    // Mouth / Lips
    const mouthGeo = new THREE.CylinderGeometry(0.035, 0.038, 0.016, 12);
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x9e434e, roughness: 0.4 });
    this.mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    this.mouthMesh.rotation.x = Math.PI / 2;
    this.mouthMesh.scale.set(1.5, 0.6, 1.0);
    this.mouthMesh.position.set(0, -0.07, 0.05);
    this.faceGroup.add(this.mouthMesh);

    // Galtis Hair (sleek high ponytail)
    this.hairGroup = new THREE.Group();
    // Hair cap
    const hairCapGeo = new THREE.SphereGeometry(0.24, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const hairCap = new THREE.Mesh(hairCapGeo, this.hairMaterial);
    hairCap.rotation.x = -0.2;
    hairCap.position.set(0, 0.03, -0.01);
    this.hairGroup.add(hairCap);

    // Ponytail tie
    const tieGeo = new THREE.TorusGeometry(0.045, 0.014, 8, 16);
    const tieMesh = new THREE.Mesh(tieGeo, this.markerMaterial);
    tieMesh.position.set(0, 0.12, -0.21);
    this.hairGroup.add(tieMesh);

    // Ponytail strand
    const strandGeo = new THREE.ConeGeometry(0.08, 0.42, 12);
    const strandMesh = new THREE.Mesh(strandGeo, this.hairMaterial);
    strandMesh.position.set(0, -0.08, -0.25);
    strandMesh.rotation.x = 0.4;
    this.hairGroup.add(strandMesh);

    this.headGroup.add(this.hairGroup);

    // Cyber Visor (hidden by default on Galtis, active in Cyber Companion skin)
    const visorGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.12, 16, 1, false, 0, Math.PI);
    this.visorMesh = new THREE.Mesh(visorGeo, this.visorMaterial);
    this.visorMesh.rotation.set(0, -Math.PI / 2, 0);
    this.visorMesh.position.set(0, 0.03, 0.07);
    this.visorMesh.visible = false; // default Galtis has sculpted face
    this.headGroup.add(this.visorMesh);

    torsoGroup.add(this.headGroup);

    // 4. Articulated Arms with MoCap Joint Nodes
    this.leftArm = this.buildArm(true);
    this.leftArm.shoulder.position.set(-0.43, 0.26, 0);
    torsoGroup.add(this.leftArm.shoulder);

    this.rightArm = this.buildArm(false);
    this.rightArm.shoulder.position.set(0.43, 0.26, 0);
    torsoGroup.add(this.rightArm.shoulder);

    // 5. Lower Pedestal / Floating Waist
    const waistGeo = new THREE.CylinderGeometry(0.20, 0.14, 0.38, 16);
    const waistMesh = new THREE.Mesh(waistGeo, this.jointMaterial);
    waistMesh.position.set(0, -0.48, 0);
    torsoGroup.add(waistMesh);

    // StudioGalt Teal Base Propulsion Halo
    const thrusterRingGeo = new THREE.TorusGeometry(0.22, 0.02, 12, 32);
    const thrusterRing = new THREE.Mesh(thrusterRingGeo, this.coreMaterial);
    thrusterRing.rotation.x = Math.PI / 2;
    thrusterRing.position.set(0, -0.68, 0);
    torsoGroup.add(thrusterRing);

    // 6. Skeletal Joint Visualizer Overlay Group
    this.skeletonOverlayGroup = new THREE.Group();
    this.skeletonOverlayGroup.visible = false;
    torsoGroup.add(this.skeletonOverlayGroup);

    this.root.add(torsoGroup);
    scene.add(this.root);
  }

  // Build an articulated robotic / mocap arm with 5 dexterous fingers
  private buildArm(isLeft: boolean): ArticulatedArm {
    const sign = isLeft ? -1 : 1;
    const mocapMarkers: THREE.Mesh[] = [];

    // Shoulder Pivot
    const shoulder = new THREE.Group();

    // Shoulder sphere cap
    const shoulderCapGeo = new THREE.SphereGeometry(0.11, 16, 16);
    const shoulderCap = new THREE.Mesh(shoulderCapGeo, this.jointMaterial);
    shoulder.add(shoulderCap);

    // Optical Mocap Acromion Node
    const shoulderMarkerGeo = new THREE.SphereGeometry(0.022, 8, 8);
    const shoulderMarker = new THREE.Mesh(shoulderMarkerGeo, this.markerMaterial);
    shoulderMarker.position.set(sign * 0.09, 0.05, 0.04);
    shoulder.add(shoulderMarker);
    mocapMarkers.push(shoulderMarker);

    // Upper Arm Bone Mesh (bicepfk_L / bicepfk_R)
    const upperArmGeo = new THREE.CylinderGeometry(0.075, 0.062, 0.42, 12);
    const upperArm = new THREE.Mesh(upperArmGeo, this.suitMaterial);
    upperArm.position.set(0, -0.21, 0);
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    // Elbow Pivot (forearmfk_L / forearmfk_R)
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.42, 0);

    const elbowCapGeo = new THREE.SphereGeometry(0.078, 14, 14);
    const elbowCap = new THREE.Mesh(elbowCapGeo, this.jointMaterial);
    elbow.add(elbowCap);

    // Optical Mocap Olecranon Node
    const elbowMarkerGeo = new THREE.SphereGeometry(0.02, 8, 8);
    const elbowMarker = new THREE.Mesh(elbowMarkerGeo, this.markerMaterial);
    elbowMarker.position.set(0, 0, -0.075);
    elbow.add(elbowMarker);
    mocapMarkers.push(elbowMarker);

    // Forearm Mesh
    const forearmGeo = new THREE.CylinderGeometry(0.062, 0.052, 0.40, 12);
    const forearm = new THREE.Mesh(forearmGeo, this.suitMaterial);
    forearm.position.set(0, -0.20, 0);
    forearm.castShadow = true;
    elbow.add(forearm);

    // Wrist Pivot (handfk_L / handfk_R)
    const wrist = new THREE.Group();
    wrist.position.set(0, -0.40, 0);

    const wristCapGeo = new THREE.SphereGeometry(0.058, 12, 12);
    const wristCap = new THREE.Mesh(wristCapGeo, this.jointMaterial);
    wrist.add(wristCap);

    // Optical Mocap Radial/Ulnar Nodes
    const wristMarkerGeo = new THREE.SphereGeometry(0.018, 8, 8);
    const wristMarker = new THREE.Mesh(wristMarkerGeo, this.markerMaterial);
    wristMarker.position.set(sign * 0.05, 0, 0);
    wrist.add(wristMarker);
    mocapMarkers.push(wristMarker);

    // Hand & Articulated 5-finger skeleton
    const hand = this.buildHand(isLeft, mocapMarkers);
    wrist.add(hand.root);

    elbow.add(wrist);
    shoulder.add(elbow);

    return {
      shoulder,
      upperArm,
      elbow,
      forearm,
      hand,
      mocapMarkers,
    };
  }

  // Build articulated hand with 5 independent curling fingers matching StudioGalt mocap hierarchy
  private buildHand(isLeft: boolean, mocapMarkers: THREE.Mesh[]): ArticulatedHand {
    const root = new THREE.Group();
    const sign = isLeft ? -1 : 1;

    // Palm mesh
    const palmGeo = new THREE.BoxGeometry(0.115, 0.125, 0.034);
    const palmMesh = new THREE.Mesh(palmGeo, this.skinMaterial);
    palmMesh.position.set(0, -0.062, 0);
    palmMesh.castShadow = true;
    root.add(palmMesh);

    // Optical mocap back-of-hand tracker
    const dorsalMarkerGeo = new THREE.SphereGeometry(0.016, 8, 8);
    const dorsalMarker = new THREE.Mesh(dorsalMarkerGeo, this.markerMaterial);
    dorsalMarker.position.set(0, -0.05, 0.022);
    root.add(dorsalMarker);
    mocapMarkers.push(dorsalMarker);

    // Build the 5 fingers (3 articulated joints each)
    // Thumb
    const thumb = this.buildFinger(0.028, 0.048, 0.042, true);
    thumb.base.position.set(sign * 0.058, -0.032, 0.014);
    thumb.base.rotation.set(0.3, sign * 0.4, sign * 0.5);
    root.add(thumb.base);

    // Index
    const index = this.buildFinger(0.021, 0.062, 0.052);
    index.base.position.set(sign * 0.042, -0.125, 0);
    root.add(index.base);

    // Middle
    const middle = this.buildFinger(0.022, 0.072, 0.058);
    middle.base.position.set(sign * 0.014, -0.128, 0);
    root.add(middle.base);

    // Ring
    const ring = this.buildFinger(0.021, 0.065, 0.052);
    ring.base.position.set(sign * -0.014, -0.125, 0);
    root.add(ring.base);

    // Pinky
    const pinky = this.buildFinger(0.019, 0.050, 0.042);
    pinky.base.position.set(sign * -0.042, -0.120, 0);
    root.add(pinky.base);

    return {
      root,
      palmMesh,
      wrist: root,
      thumb,
      index,
      middle,
      ring,
      pinky,
    };
  }

  private buildFinger(radius: number, seg1Len: number, seg2Len: number, isThumb = false): ArticulatedFinger {
    const base = new THREE.Group();

    // Proximal segment (01)
    const seg1Geo = new THREE.CylinderGeometry(radius * 0.9, radius, seg1Len, 8);
    const seg1Mesh = new THREE.Mesh(seg1Geo, this.skinMaterial);
    seg1Mesh.position.set(0, -seg1Len / 2, 0);
    seg1Mesh.castShadow = true;
    base.add(seg1Mesh);

    // Mid joint (02)
    const mid = new THREE.Group();
    mid.position.set(0, -seg1Len, 0);

    const midJointGeo = new THREE.SphereGeometry(radius * 0.92, 8, 8);
    const midJointMesh = new THREE.Mesh(midJointGeo, this.skinMaterial);
    mid.add(midJointMesh);

    // Distal segment (03)
    const seg2Geo = new THREE.CylinderGeometry(radius * 0.72, radius * 0.9, seg2Len, 8);
    const tip = new THREE.Mesh(seg2Geo, this.skinMaterial);
    tip.position.set(0, -seg2Len / 2, 0);
    tip.castShadow = true;
    mid.add(tip);

    base.add(mid);

    return { base, mid, tip };
  }

  // Update companion theme & skin styling
  public updateTheme(companion: Companion) {
    const { suitColor, visorColor, avatarVariant, isGaltis } = companion;

    this.suitMaterial.color.setHex(suitColor);
    this.visorMaterial.color.setHex(visorColor);
    this.visorMaterial.emissive.setHex(visorColor);
    this.coreMaterial.color.setHex(visorColor);
    this.markerMaterial.color.setHex(visorColor);

    if (avatarVariant === 'galtis_cyber' || !isGaltis) {
      // Show Cyber holographic visor
      this.visorMesh.visible = true;
      this.faceGroup.visible = false;
      this.hairGroup.visible = false;
      this.suitMaterial.wireframe = false;
    } else if (avatarVariant === 'galtis_skeleton') {
      // Raw Skeleton Visualizer mode
      this.visorMesh.visible = false;
      this.faceGroup.visible = true;
      this.hairGroup.visible = false;
      this.suitMaterial.wireframe = true;
      this.suitMaterial.opacity = 0.35;
      this.suitMaterial.transparent = true;
      this.skeletonOverlayGroup.visible = true;
    } else if (avatarVariant === 'galtis_casual') {
      // Casual Studio natural style
      this.visorMesh.visible = false;
      this.faceGroup.visible = true;
      this.hairGroup.visible = true;
      this.suitMaterial.wireframe = false;
      this.suitMaterial.transparent = false;
      this.skinMaterial.color.setHex(0xeac7ab);
    } else {
      // Default Galtis 8 MoCap Suit
      this.visorMesh.visible = false;
      this.faceGroup.visible = true;
      this.hairGroup.visible = true;
      this.suitMaterial.wireframe = false;
      this.suitMaterial.transparent = false;
      this.skinMaterial.color.setHex(0xe8c1a0);
    }
  }

  public setSkeletalOverlayVisible(visible: boolean) {
    this.skeletonOverlayGroup.visible = visible;
  }

  // Apply target gesture keyframe
  public applyPose(keyframe: GestureKeyframe, signName?: string) {
    if (keyframe.rightHand) {
      this.targetRightPose = { ...keyframe.rightHand };
    }
    if (keyframe.leftHand) {
      this.targetLeftPose = { ...keyframe.leftHand };
    }
    if (keyframe.head) {
      this.targetHeadPose = { ...keyframe.head };
      // Update FACS expression targets
      if (keyframe.head.eyebrows === 'raised') {
        this.activeFacs.browRaise = 0.6;
        this.activeFacs.browFurrow = 0;
      } else if (keyframe.head.eyebrows === 'furrowed') {
        this.activeFacs.browRaise = 0;
        this.activeFacs.browFurrow = 0.75;
      } else {
        this.activeFacs.browRaise = 0;
        this.activeFacs.browFurrow = 0;
      }

      if (keyframe.head.expression === 'smile') {
        this.activeFacs.mouthSmile = 0.5;
        this.activeFacs.mouthOpen = 0.1;
      } else if (keyframe.head.expression === 'question') {
        this.activeFacs.browRaise = 0.7;
        this.activeFacs.mouthOpen = 0.2;
      } else {
        this.activeFacs.mouthSmile = 0.05;
        this.activeFacs.mouthOpen = 0;
      }
    }
    if (signName) {
      this.currentSignName = signName;
    }
    this.isSigning = true;
  }

  public resetToReady() {
    this.targetRightPose = { ...READY_POSE_RIGHT };
    this.targetLeftPose = { ...READY_POSE_LEFT };
    this.targetHeadPose = { nod: 0, tilt: 0, turn: 0, expression: 'neutral' };
    this.activeFacs.browRaise = 0;
    this.activeFacs.browFurrow = 0;
    this.activeFacs.mouthSmile = 0.1;
    this.activeFacs.mouthOpen = 0;
  }

  public resetToRest() {
    this.targetRightPose = { ...REST_POSE_RIGHT };
    this.targetLeftPose = { ...REST_POSE_LEFT };
    this.targetHeadPose = { nod: 0, tilt: 0, turn: 0, expression: 'neutral' };
    this.activeFacs.browRaise = 0;
    this.activeFacs.browFurrow = 0;
    this.activeFacs.mouthSmile = 0.05;
    this.activeFacs.mouthOpen = 0;
    this.isSigning = false;
    this.currentSignName = 'IDLE';
  }

  // Animation frame tick: continuous interpolation & 60fps mocap updates
  public update(delta: number, speedMultiplier: number = 1.0) {
    this.idleTime += delta;
    this.blinkTimer += delta;
    this.currentFrame = Math.floor(this.idleTime * 60) % 1800;

    // 1. Natural Blinking Loop
    if (this.blinkTimer > this.nextBlinkInterval) {
      this.activeFacs.eyeBlink = 1.0;
      if (this.blinkTimer > this.nextBlinkInterval + 0.14) {
        this.activeFacs.eyeBlink = 0.0;
        this.blinkTimer = 0;
        this.nextBlinkInterval = 2.5 + Math.random() * 3.5;
      }
    }

    // Apply Eyelid blinking scale
    const blinkScale = 1.0 - this.activeFacs.eyeBlink * 0.95;
    this.leftEye.scale.y = blinkScale;
    this.rightEye.scale.y = blinkScale;

    // 2. FACS Eyebrow animation
    const browOffset = this.activeFacs.browRaise * 0.035 - this.activeFacs.browFurrow * 0.02;
    this.leftBrow.position.y = THREE.MathUtils.lerp(this.leftBrow.position.y, 0.09 + browOffset, delta * 10);
    this.rightBrow.position.y = THREE.MathUtils.lerp(this.rightBrow.position.y, 0.09 + browOffset, delta * 10);
    this.leftBrow.rotation.z = -0.05 - this.activeFacs.browFurrow * 0.15;
    this.rightBrow.rotation.z = 0.05 + this.activeFacs.browFurrow * 0.15;

    // 3. Mouth blendshapes
    const smileScale = 1.0 + this.activeFacs.mouthSmile * 0.4;
    this.mouthMesh.scale.x = THREE.MathUtils.lerp(this.mouthMesh.scale.x, 1.5 * smileScale, delta * 10);
    this.mouthMesh.scale.y = THREE.MathUtils.lerp(this.mouthMesh.scale.y, 0.6 + this.activeFacs.mouthOpen * 0.6, delta * 10);

    // 4. Subtle Organic Idle Motion
    const breath = Math.sin(this.idleTime * 2.2) * 0.018;
    const hoverY = Math.sin(this.idleTime * 1.5) * 0.035;
    const hoverTilt = Math.sin(this.idleTime * 1.1) * 0.012;

    this.root.position.y = hoverY;
    this.root.rotation.z = hoverTilt;
    this.chestMesh.scale.y = 1.0 + breath * 0.7;

    // Optical sensor glow pulse
    const pulse = (Math.sin(this.idleTime * 3.2) + 1.0) * 0.5;
    this.visorMaterial.emissiveIntensity = 0.75 + pulse * 0.35;

    // Interpolation rate
    const lerpRate = Math.min(1.0, delta * 13.0 * speedMultiplier);

    // Right arm
    this.lerpPose(this.currentRightPose, this.targetRightPose, lerpRate);
    this.updateArmJoints(this.rightArm, this.currentRightPose, false);

    // Left arm
    this.lerpPose(this.currentLeftPose, this.targetLeftPose, lerpRate);
    this.updateArmJoints(this.leftArm, this.currentLeftPose, true);

    // Head
    const headRate = Math.min(1.0, delta * 8.5 * speedMultiplier);
    this.currentHeadPose.nod = THREE.MathUtils.lerp(
      this.currentHeadPose.nod || 0,
      (this.targetHeadPose.nod || 0) + Math.sin(this.idleTime * 1.2) * 0.025,
      headRate
    );
    this.currentHeadPose.tilt = THREE.MathUtils.lerp(
      this.currentHeadPose.tilt || 0,
      (this.targetHeadPose.tilt || 0) + Math.cos(this.idleTime * 0.8) * 0.015,
      headRate
    );
    this.currentHeadPose.turn = THREE.MathUtils.lerp(
      this.currentHeadPose.turn || 0,
      this.targetHeadPose.turn || 0,
      headRate
    );

    this.headGroup.rotation.x = this.currentHeadPose.nod;
    this.headGroup.rotation.z = this.currentHeadPose.tilt;
    this.headGroup.rotation.y = this.currentHeadPose.turn;
  }

  private lerpPose(current: HandPose, target: HandPose, alpha: number) {
    const keys: (keyof HandPose)[] = [
      'shoulderX', 'shoulderY', 'shoulderZ',
      'elbowX', 'elbowY', 'elbowZ',
      'wristX', 'wristY', 'wristZ',
      'thumb', 'index', 'middle', 'ring', 'pinky', 'spread'
    ];

    for (const k of keys) {
      const curVal = current[k] ?? 0;
      const targetVal = target[k] ?? 0;
      (current as any)[k] = THREE.MathUtils.lerp(curVal, targetVal, alpha);
    }
  }

  private updateArmJoints(arm: ArticulatedArm, pose: HandPose, isLeft: boolean) {
    const sign = isLeft ? -1 : 1;

    // Shoulder rotations
    arm.shoulder.rotation.x = pose.shoulderX ?? 0;
    arm.shoulder.rotation.y = pose.shoulderY ?? 0;
    arm.shoulder.rotation.z = pose.shoulderZ ?? 0;

    // Elbow rotations
    arm.elbow.rotation.x = pose.elbowX ?? 0;
    arm.elbow.rotation.y = pose.elbowY ?? 0;
    arm.elbow.rotation.z = pose.elbowZ ?? 0;

    // Wrist rotations
    arm.hand.root.rotation.x = pose.wristX ?? 0;
    arm.hand.root.rotation.y = pose.wristY ?? 0;
    arm.hand.root.rotation.z = pose.wristZ ?? 0;

    // Finger curl values
    const spread = pose.spread ?? 0;

    // Thumb
    const tCur = pose.thumb ?? 0;
    arm.hand.thumb.base.rotation.x = 0.2 + tCur * 0.7;
    arm.hand.thumb.mid.rotation.x = tCur * 0.8;

    // Index
    const iCur = pose.index ?? 0;
    arm.hand.index.base.rotation.x = iCur * 1.5;
    arm.hand.index.base.rotation.z = sign * (0.05 + spread * 0.25);
    arm.hand.index.mid.rotation.x = iCur * 1.4;

    // Middle
    const mCur = pose.middle ?? 0;
    arm.hand.middle.base.rotation.x = mCur * 1.5;
    arm.hand.middle.base.rotation.z = sign * (spread * 0.08);
    arm.hand.middle.mid.rotation.x = mCur * 1.4;

    // Ring
    const rCur = pose.ring ?? 0;
    arm.hand.ring.base.rotation.x = rCur * 1.5;
    arm.hand.ring.base.rotation.z = sign * (-0.05 - spread * 0.12);
    arm.hand.ring.mid.rotation.x = rCur * 1.4;

    // Pinky
    const pCur = pose.pinky ?? 0;
    arm.hand.pinky.base.rotation.x = pCur * 1.5;
    arm.hand.pinky.base.rotation.z = sign * (-0.1 - spread * 0.3);
    arm.hand.pinky.mid.rotation.x = pCur * 1.4;
  }

  // Extract live .anim StudioGalt skeletal coordinates for the UI inspector
  public getLiveCoordinates(): LiveMocapCoordinates {
    const rad2deg = (rad: number) => Math.round((rad * 180) / Math.PI * 10) / 10;
    const qFromEuler = (rx: number, ry: number, rz: number): [number, number, number, number] => {
      const euler = new THREE.Euler(rx, ry, rz, 'XYZ');
      const q = new THREE.Quaternion().setFromEuler(euler);
      return [
        Math.round(q.w * 1000) / 1000,
        Math.round(q.x * 1000) / 1000,
        Math.round(q.y * 1000) / 1000,
        Math.round(q.z * 1000) / 1000,
      ];
    };

    const rSh = this.rightArm.shoulder.rotation;
    const rEl = this.rightArm.elbow.rotation;
    const rWr = this.rightArm.hand.root.rotation;

    const lSh = this.leftArm.shoulder.rotation;
    const lEl = this.leftArm.elbow.rotation;
    const lWr = this.leftArm.hand.root.rotation;

    const hd = this.headGroup.rotation;

    const bones: Record<string, StudioGaltBoneCoordinate> = {
      bicepfk_R: {
        quaternion: qFromEuler(rSh.x, rSh.y, rSh.z),
        position: [0.43, 1.61, 0.0],
        eulerDegrees: [rad2deg(rSh.x), rad2deg(rSh.y), rad2deg(rSh.z)],
      },
      forearmfk_R: {
        quaternion: qFromEuler(rEl.x, rEl.y, rEl.z),
        position: [0.43, 1.19, 0.0],
        eulerDegrees: [rad2deg(rEl.x), rad2deg(rEl.y), rad2deg(rEl.z)],
      },
      handfk_R: {
        quaternion: qFromEuler(rWr.x, rWr.y, rWr.z),
        position: [0.43, 0.79, 0.0],
        eulerDegrees: [rad2deg(rWr.x), rad2deg(rWr.y), rad2deg(rWr.z)],
      },
      bicepfk_L: {
        quaternion: qFromEuler(lSh.x, lSh.y, lSh.z),
        position: [-0.43, 1.61, 0.0],
        eulerDegrees: [rad2deg(lSh.x), rad2deg(lSh.y), rad2deg(lSh.z)],
      },
      forearmfk_L: {
        quaternion: qFromEuler(lEl.x, lEl.y, lEl.z),
        position: [-0.43, 1.19, 0.0],
        eulerDegrees: [rad2deg(lEl.x), rad2deg(lEl.y), rad2deg(lEl.z)],
      },
      handfk_L: {
        quaternion: qFromEuler(lWr.x, lWr.y, lWr.z),
        position: [-0.43, 0.79, 0.0],
        eulerDegrees: [rad2deg(lWr.x), rad2deg(lWr.y), rad2deg(lWr.z)],
      },
      headfk: {
        quaternion: qFromEuler(hd.x, hd.y, hd.z),
        position: [0.0, 1.93, 0.0],
        eulerDegrees: [rad2deg(hd.x), rad2deg(hd.y), rad2deg(hd.z)],
      },
      neckfk: {
        quaternion: [1.0, 0.0, 0.0, 0.0],
        position: [0.0, 1.76, 0.0],
        eulerDegrees: [0, 0, 0],
      },
    };

    return {
      signName: this.currentSignName,
      poseProgress: this.isSigning ? 0.8 : 0.0,
      frame: this.currentFrame,
      bones,
      facs: { ...this.activeFacs },
    };
  }
}
