// React Three Fiber registers its JSX tags (<mesh>, <group>…) on the copy of
// @types/react hoisted at the repo root (the admin's). The app uses its own
// copy, so register them here too.
import type { ThreeElements } from '@react-three/fiber';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
