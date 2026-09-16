import * as THREE from 'three';

/** Paint on the original bind-position surface; skeletal deformation stays untouched. */
export function createSuitMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    name: 'Galtis_Charcoal_Suit', color: 0xffffff, roughness: 0.86, metalness: 0.02,
  });
  material.customProgramCacheKey = () => 'galtis-charcoal-suit-v1';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 vSuitPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvSuitPosition = position;');
    shader.fragmentShader = 'varying vec3 vSuitPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      // The original full-body FBX uses metres, Z up, and -Y forward.
      vec3 p = vSuitPosition;
      float x = abs(p.x);
      float z = p.z;
      vec3 cloth = vec3(0.060, 0.067, 0.073);
      float weave = sin(p.x * 3100.0) * sin(z * 3100.0);
      cloth *= 1.0 + 0.035 * weave;
      float front = 1.0 - smoothstep(-0.025, 0.015, p.y);
      float opening = clamp((z - 1.10) * 0.23, 0.0, 0.108);
      float shirt = (1.0 - smoothstep(opening - 0.001, opening + 0.001, x))
        * step(1.10, z) * step(z, 1.56) * front;
      cloth = mix(cloth, vec3(0.82, 0.84, 0.83), shirt);
      // Teal tie blade and knot, with a pointed end.
      float tieWidth = z < 1.22 ? max(0.0, (z - 1.17) * 0.45) : 0.021 - (z - 1.22) * 0.027;
      float tie = (1.0 - smoothstep(tieWidth - 0.001, tieWidth + 0.001, x))
        * step(1.17, z) * step(z, 1.445) * shirt;
      float knot = step(x, 0.016 + (z - 1.445) * 0.12) * step(1.445, z) * step(z, 1.479) * shirt;
      cloth = mix(cloth, vec3(0.025, 0.105, 0.100), max(tie, knot));
      float collar = step(1.445 + (0.055 - x) * 1.4, z) * step(z, 1.53)
        * step(0.017, x) * step(x, 0.067) * shirt;
      cloth = mix(cloth, vec3(0.95, 0.96, 0.94), collar);
      float lapel = smoothstep(opening, opening + 0.002, x)
        * (1.0 - smoothstep(opening + 0.035, opening + 0.039, x))
        * step(1.10, z) * step(z, 1.53) * front;
      cloth = mix(cloth, vec3(0.085, 0.092, 0.100), lapel);
      float buttons = (1.0 - smoothstep(0.006, 0.008, length(vec2(p.x - 0.012, z - 1.085))))
        + (1.0 - smoothstep(0.006, 0.008, length(vec2(p.x - 0.012, z - 1.015))));
      cloth = mix(cloth, vec3(0.016), clamp(buttons * front, 0.0, 1.0));
      // Dark leather shoes retain their original silhouette.
      cloth = mix(vec3(0.012, 0.015, 0.019), cloth, smoothstep(0.115, 0.14, z));
      cloth = mix(cloth, vec3(0.009, 0.009, 0.011), step(1.60, z));
      diffuseColor.rgb *= cloth;
    `);
  };
  return material;
}
