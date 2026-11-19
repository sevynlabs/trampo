import { useEffect, useMemo } from 'react';
import { View, Pressable, useWindowDimensions, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { Logo, LogoMark } from './Logo';
import { colors } from '../../theme/tokens';

/** Timeline (ms). Total ≈ 3.9s before onFinish. */
const T = {
  pinIn: 1100, // pin spins in from the depth (3D)
  hold: 350, // settles + glow pulse
  smoke: 900, // smoke burst; pin dissolves into it
  logoIn: 700, // full logo emerges from the smoke
  logoHold: 850,
};

const PUFFS = 22;

/**
 * Opening animation before the onboarding:
 * 1) the pin comes from the depth spinning in 3D,
 * 2) glows, 3) dissolves into a puff of smoke,
 * 4) the full "trampo" logo emerges as the smoke clears.
 * Tap anywhere to skip. Honors the OS "reduce motion" setting.
 */
export function AnimatedIntro({ onFinish }: { onFinish: () => void }) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const pin = useSharedValue(0); // 0 → 1 entrance
  const glow = useSharedValue(0);
  const smoke = useSharedValue(0); // 0 → 1 burst
  const logo = useSharedValue(0);

  // Random-but-stable puff layout around the center
  const puffs = useMemo(
    () =>
      Array.from({ length: PUFFS }, (_, i) => {
        const angle = (i / PUFFS) * Math.PI * 2 + (i % 3) * 0.35;
        const dist = 50 + ((i * 37) % 70);
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist * 0.75,
          size: 90 + ((i * 53) % 70),
          delay: (i % 5) * 45,
          tint: i % 4 === 0 ? 'orange' : 'navy',
        } as const;
      }),
    []
  );

  useEffect(() => {
    if (reduceMotion) {
      logo.value = withTiming(1, { duration: 400 });
      const t = setTimeout(onFinish, 1200);
      return () => clearTimeout(t);
    }
    const rm = ReduceMotion.Never;
    pin.value = withTiming(1, { duration: T.pinIn, easing: Easing.out(Easing.cubic), reduceMotion: rm });
    glow.value = withDelay(
      T.pinIn - 150,
      withSequence(withTiming(1, { duration: 260, reduceMotion: rm }), withTiming(0, { duration: 420, reduceMotion: rm }))
    );
    smoke.value = withDelay(T.pinIn + T.hold, withTiming(1, { duration: T.smoke, easing: Easing.out(Easing.quad), reduceMotion: rm }));
    logo.value = withDelay(
      T.pinIn + T.hold + T.smoke * 0.45,
      withSpring(1, { damping: 14, stiffness: 110, reduceMotion: rm }, (done) => {
        if (done) runOnJS(scheduleFinish)();
      })
    );
    function scheduleFinish() {
      setTimeout(onFinish, T.logoHold);
    }
    // Safety net in case a spring callback never fires
    const safety = setTimeout(onFinish, T.pinIn + T.hold + T.smoke + T.logoIn + T.logoHold + 1500);
    return () => clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const pinStyle = useAnimatedStyle(() => {
    const p = pin.value;
    const s = smoke.value;
    return {
      opacity: interpolate(p, [0, 0.25], [0, 1], 'clamp') * interpolate(s, [0, 0.35], [1, 0], 'clamp'),
      transform: [
        { perspective: 700 },
        { translateY: interpolate(p, [0, 0.7, 0.85, 1], [-60, 8, -4, 0]) },
        { scale: interpolate(p, [0, 1], [0.15, 1]) * interpolate(s, [0, 0.35], [1, 1.5], 'clamp') },
        { rotateY: `${interpolate(p, [0, 1], [720, 0])}deg` },
        { rotateX: `${interpolate(p, [0, 0.6, 1], [35, -10, 0])}deg` },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.55,
    transform: [{ scale: 0.8 + glow.value * 0.7 }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(logo.value, [0, 0.4, 1], [0, 0.6, 1], 'clamp'),
    transform: [
      { perspective: 900 },
      { scale: interpolate(logo.value, [0, 1], [0.82, 1]) },
      { rotateX: `${interpolate(logo.value, [0, 1], [25, 0])}deg` },
      { translateY: interpolate(logo.value, [0, 1], [18, 0]) },
    ],
  }));

  return (
    <Pressable
      style={styles.root}
      onPress={onFinish}
      accessibilityRole="button"
      accessibilityLabel="Trampo. Toque para pular a abertura"
    >
      <View style={styles.center} pointerEvents="none">
        {/* Glow behind the pin */}
        <Animated.View style={[styles.glow, glowStyle]}>
          <Svg width={260} height={260}>
            <Defs>
              <RadialGradient id="g" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={colors.orange} stopOpacity={0.55} />
                <Stop offset="100%" stopColor={colors.orange} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={130} cy={130} r={130} fill="url(#g)" />
          </Svg>
        </Animated.View>

        {/* Smoke */}
        {puffs.map((p, i) => (
          <Puff key={i} progress={smoke} {...p} />
        ))}

        {/* 3D pin */}
        <Animated.View style={pinStyle}>
          <LogoMark size={110} />
        </Animated.View>

        {/* Full logo */}
        <Animated.View style={[styles.logo, logoStyle]}>
          <Logo size={62} maxWidth={width - 64} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

function Puff({
  progress,
  dx,
  dy,
  size,
  delay,
  tint,
}: {
  progress: SharedValue<number>;
  dx: number;
  dy: number;
  size: number;
  delay: number;
  tint: 'orange' | 'navy';
}) {
  const color = tint === 'orange' ? colors.orange : '#8A9BB5';
  const style = useAnimatedStyle(() => {
    // each puff starts slightly later (delay as a fraction of the burst)
    const t = Math.max(0, Math.min(1, (progress.value * 900 - delay) / (900 - delay)));
    return {
      opacity: interpolate(t, [0, 0.12, 0.55, 1], [0, 1, 0.75, 0]),
      transform: [
        { translateX: dx * t },
        { translateY: dy * t - 30 * t },
        { scale: 0.3 + t * 1.3 },
      ],
    };
  });
  return (
    <Animated.View style={[styles.puff, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`p${tint}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={tint === 'orange' ? 0.55 : 0.8} />
            <Stop offset="55%" stopColor={color} stopOpacity={tint === 'orange' ? 0.25 : 0.35} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#p${tint})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  puff: { position: 'absolute', left: '50%', top: '50%' },
  logo: { position: 'absolute' },
});
