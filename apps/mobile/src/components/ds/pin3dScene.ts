import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { colors } from '../../theme/tokens';

/** Same paths as Logo / the admin logo (viewBox 100×130). */
const PIN_PATH =
  'M50 0C22.4 0 0 21.6 0 48.5C0 68 16 86 48.6 128.5C49.3 129.4 50.7 129.4 51.4 128.5C84 86 100 68 100 48.5C100 21.6 77.6 0 50 0Z';
const T_PATH =
  'M53.3 22.5C53.3 19.5 51 17 47.5 17C42 17 37.5 19.5 35 24C31.5 30 27.5 35 24.5 39C21.5 43.5 23.5 51.3 28.5 51.3L33.7 51.3L33.7 72C33.7 85 43.5 93 56.5 93C67 93 75 87 75 79C75 73 70 68.5 65 70.3C62 71.3 60 71.8 58 71.6C55 71.3 53.3 68.8 53.3 65.2L53.3 51.3L68.3 51.3C72.5 51.3 75.3 47.5 75.3 42.8C75.3 38 72.5 34.4 68.3 34.4L53.3 34.4Z';

const DEPTH = 22;
const BEVEL = 7;

/** Minimal parser for absolute M/L/C/Z paths (SVGLoader needs DOMParser, absent in RN). Y is flipped. */
function toShape(d: string) {
  const shape = new THREE.Shape();
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? [];
  let i = 0;
  let cmd = '';
  const n = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    if (/[MLCZ]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'M') shape.moveTo(n(), -n());
    else if (cmd === 'L') shape.lineTo(n(), -n());
    else if (cmd === 'C') {
      const x1 = n(), y1 = -n(), x2 = n(), y2 = -n(), x = n(), y = -n();
      shape.bezierCurveTo(x1, y1, x2, y2, x, y);
    } else if (cmd === 'Z') shape.closePath();
    else i++;
  }
  return shape;
}

/** Soft radial "contact shadow" texture built in memory (no <canvas> in RN). */
function shadowTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - size / 2) / (size / 2);
      const dy = (y - size / 2) / (size / 2);
      const a = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      const o = (y * size + x) * 4;
      data[o] = 4;
      data[o + 1] = 30;
      data[o + 2] = 66;
      data[o + 3] = Math.round(a * a * 0.4 * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

/**
 * Builds the 3D pin scene on an expo-gl context and starts the render loop.
 * Returns a function that stops the loop and frees GPU memory.
 */
export function startPinScene(gl: ExpoWebGLRenderingContext, entranceMs: number): () => void {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;

  // three.js expects a canvas; expo-gl only gives the context
  const canvas = {
    width,
    height,
    style: {},
    clientWidth: width,
    clientHeight: height,
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
  } as unknown as HTMLCanvasElement;

  // expo-gl's context is WebGL2 but also passes `instanceof WebGLRenderingContext`,
  // which makes three.js (r163+) reject it as WebGL1. Hide that global only
  // while the renderer is created.
  const g = globalThis as { WebGLRenderingContext?: unknown };
  const webgl1 = g.WebGLRenderingContext;
  let renderer: THREE.WebGLRenderer;
  try {
    g.WebGLRenderingContext = undefined;
    renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true, alpha: true });
  } finally {
    g.WebGLRenderingContext = webgl1;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0xffffff, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();
  } catch {
    // No float render targets on this GPU: lights alone still look good
  }

  const camera = new THREE.PerspectiveCamera(30, width / height, 1, 2000);
  camera.position.set(0, 0, 420);

  const pinGeo = new THREE.ExtrudeGeometry(toShape(PIN_PATH), {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: 6,
    bevelSegments: 10,
    curveSegments: 64,
  });
  pinGeo.translate(-50, 65, -DEPTH / 2);
  const tGeo = new THREE.ExtrudeGeometry(toShape(T_PATH), {
    depth: 4,
    bevelEnabled: true,
    bevelThickness: 2.2,
    bevelSize: 1.6,
    bevelSegments: 6,
    curveSegments: 48,
  });
  tGeo.translate(-50, 65, 0);

  const orange = new THREE.MeshPhysicalMaterial({
    color: colors.orange,
    roughness: 0.32,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const white = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });

  const pin = new THREE.Group();
  pin.add(new THREE.Mesh(pinGeo, orange));
  const face = DEPTH / 2 + BEVEL - 1.2;
  const front = new THREE.Mesh(tGeo, white);
  front.position.z = face;
  const back = new THREE.Mesh(tGeo, white);
  back.position.z = -face;
  back.rotation.y = Math.PI;
  pin.add(front, back);
  scene.add(pin);

  const shadowGeo = new THREE.PlaneGeometry(120, 30);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.set(0, -78, 0);
  shadow.rotation.x = -Math.PI / 2.4;
  scene.add(shadow);

  const key = new THREE.DirectionalLight('#fff5ea', 2);
  key.position.set(-160, 220, 260);
  const rim = new THREE.DirectionalLight('#7fd0ff', 1.4);
  rim.position.set(220, 80, -200);
  scene.add(key, rim, new THREE.HemisphereLight('#ffffff', '#0b2e5c', 0.6));

  const t0 = Date.now();
  let frame = 0;
  let running = true;
  const loop = () => {
    if (!running) return;
    const t = (Date.now() - t0) / 1000;
    const e = easeOutCubic(Math.min(1, t / (entranceMs / 1000)));
    // Comes from above spinning twice, then floats gently
    pin.rotation.y = (1 - e) * Math.PI * 4 + Math.sin(t * 1.4) * 0.35 * e;
    pin.rotation.x = (1 - e) * 0.6 + Math.sin(t * 1.1) * 0.06 * e;
    pin.position.y = (1 - e) * 120 + Math.sin(t * 2) * 3 * e;
    pin.scale.setScalar(0.15 + 0.85 * e);
    shadow.scale.setScalar(0.4 + 0.6 * e);
    shadowMat.opacity = e;
    renderer.render(scene, camera);
    gl.endFrameEXP();
    frame = requestAnimationFrame(loop);
  };
  loop();

  return () => {
    running = false;
    cancelAnimationFrame(frame);
    pinGeo.dispose();
    tGeo.dispose();
    shadowGeo.dispose();
    orange.dispose();
    white.dispose();
    shadowMat.map?.dispose();
    shadowMat.dispose();
    scene.environment?.dispose();
    renderer.dispose();
  };
}
