/** @jsxImportSource react */
import { Component, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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
    } else if (cmd === 'Z') {
      shape.closePath();
    } else i++; // unknown token: skip
  }
  return shape;
}

/** Soft radial "contact shadow" texture built in memory (no canvas in RN). */
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

function PinModel({ entranceMs }: { entranceMs: number }) {
  const group = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const start = useRef<number | null>(null);

  const { pinGeo, tGeo, orange, white, shadowMat } = useMemo(() => {
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
    return {
      pinGeo,
      tGeo,
      orange: new THREE.MeshPhysicalMaterial({
        color: colors.orange,
        roughness: 0.32,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      }),
      white: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      shadowMat: new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    };
  }, []);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    if (start.current === null) start.current = clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const e = easeOutCubic(Math.min(1, t / (entranceMs / 1000)));
    // Comes from above/behind spinning twice, then floats gently
    g.rotation.y = (1 - e) * Math.PI * 4 + Math.sin(t * 1.4) * 0.35 * e;
    g.rotation.x = (1 - e) * 0.6 + Math.sin(t * 1.1) * 0.06 * e;
    g.position.y = (1 - e) * 120 + Math.sin(t * 2) * 3 * e;
    g.scale.setScalar(0.15 + 0.85 * e);
    if (shadow.current) {
      shadow.current.scale.setScalar(0.4 + 0.6 * e);
      shadowMat.opacity = e;
    }
  });

  const face = DEPTH / 2 + BEVEL - 1.2;
  return (
    <>
      <group ref={group}>
        <mesh geometry={pinGeo} material={orange} />
        <mesh geometry={tGeo} material={white} position={[0, 0, face]} />
        <mesh geometry={tGeo} material={white} position={[0, 0, -face]} rotation={[0, Math.PI, 0]} />
      </group>
      <mesh ref={shadow} position={[0, -78, 0]} rotation={[-Math.PI / 2.4, 0, 0]} material={shadowMat}>
        <planeGeometry args={[120, 30]} />
      </mesh>
    </>
  );
}

/**
 * The Trampo pin as a real 3D object (extruded + beveled, glossy clear coat,
 * reflections, raised "t"), rendered with three.js on expo-gl.
 * Plays its own entrance (spin-in from above) over `entranceMs`.
 */
export function Pin3D({ size = 240, entranceMs = 1100 }: { size?: number; entranceMs?: number }) {
  return (
    <Canvas
      style={{ width: size, height: size * 1.1 }}
      camera={{ fov: 30, position: [0, 0, 420], near: 1, far: 2000 }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.setClearColor(0xffffff, 0);
        try {
          const pmrem = new THREE.PMREMGenerator(gl);
          scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
          scene.environmentIntensity = 0.55;
          pmrem.dispose();
        } catch {
          // No float render targets on this GPU: lights alone still look good
        }
      }}
    >
      <directionalLight color="#fff5ea" intensity={2} position={[-160, 220, 260]} />
      <directionalLight color="#7fd0ff" intensity={1.4} position={[220, 80, -200]} />
      <hemisphereLight args={['#ffffff', '#0b2e5c', 0.6]} />
      <PinModel entranceMs={entranceMs} />
    </Canvas>
  );
}

/** Renders `fallback` instead of the 3D pin if GL fails to start. */
export class Pin3DBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
