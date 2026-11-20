import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GLView } from 'expo-gl';

/**
 * The Trampo pin as a real 3D object (extruded + beveled, glossy clear coat,
 * reflections, raised "t"), rendered with three.js on expo-gl.
 * Plays its own entrance (spin-in from above) over `entranceMs`.
 *
 * three.js is loaded lazily inside a try: if it or the GPU fails, `fallback`
 * is shown instead and the rest of the app is never affected.
 */
export function Pin3D({
  size = 240,
  entranceMs = 1100,
  fallback,
}: {
  size?: number;
  entranceMs?: number;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => () => stop.current?.(), []);

  if (failed) return <>{fallback}</>;

  return (
    <GLView
      style={{ width: size, height: size * 1.1 }}
      onContextCreate={(gl) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { startPinScene } = require('./pin3dScene') as typeof import('./pin3dScene');
          stop.current = startPinScene(gl, entranceMs);
        } catch (err) {
          if (__DEV__) console.warn('[Pin3D] 3D indisponível, usando o pin 2D:', err);
          setFailed(true);
        }
      }}
    />
  );
}
