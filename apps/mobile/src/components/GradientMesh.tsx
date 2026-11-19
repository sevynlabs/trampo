import { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Circle, Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface GradientMeshProps {
  height?: number;
  intensity?: 'subtle' | 'normal' | 'vibrant';
  animated?: boolean;
}

const INTENSITY_CONFIG = {
  subtle: {
    circle1: 0.25,
    circle2: 0.2,
    circle3: 0.22,
    circle4: 0.15,
  },
  normal: {
    circle1: 0.4,
    circle2: 0.3,
    circle3: 0.35,
    circle4: 0.25,
  },
  vibrant: {
    circle1: 0.55,
    circle2: 0.4,
    circle3: 0.45,
    circle4: 0.35,
  },
};

function AnimatedMeshCircle({
  cx,
  cy,
  r,
  fill,
  delay = 0,
  amplitude = 8,
  duration = 8000,
  animated = true,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  delay?: number;
  amplitude?: number;
  duration?: number;
  animated?: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      progress.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        false
      );
    }
  }, [animated, duration]);

  const animatedProps = useAnimatedProps(() => {
    const offsetX = interpolate(progress.value, [0, 1], [-amplitude, amplitude]);
    const offsetY = interpolate(progress.value, [0, 1], [amplitude * 0.6, -amplitude * 0.6]);

    return {
      cx: cx + offsetX,
      cy: cy + offsetY,
    };
  });

  if (!animated) {
    return <Circle cx={cx} cy={cy} r={r} fill={fill} />;
  }

  return <AnimatedCircle animatedProps={animatedProps} r={r} fill={fill} />;
}

export function GradientMesh({
  height = 280,
  intensity = 'normal',
  animated = true,
}: GradientMeshProps) {
  const config = INTENSITY_CONFIG[intensity];

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={SCREEN_WIDTH} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="mesh1" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#0B2E5C" stopOpacity={config.circle1} />
            <Stop offset="100%" stopColor="#0B2E5C" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="mesh2" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FF6A00" stopOpacity={config.circle2} />
            <Stop offset="100%" stopColor="#FF6A00" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="mesh3" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFC59E" stopOpacity={config.circle3} />
            <Stop offset="100%" stopColor="#FFC59E" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="mesh4" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFF1E6" stopOpacity={config.circle4} />
            <Stop offset="100%" stopColor="#FFF1E6" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Background */}
        <Rect x="0" y="0" width="100%" height="100%" fill="#F5F8FC" />

        {/* Animated gradient circles */}
        <AnimatedMeshCircle
          cx={SCREEN_WIDTH * 0.2}
          cy={height * 0.3}
          r={180}
          fill="url(#mesh1)"
          delay={0}
          amplitude={10}
          duration={9000}
          animated={animated}
        />
        <AnimatedMeshCircle
          cx={SCREEN_WIDTH * 0.75}
          cy={height * 0.2}
          r={160}
          fill="url(#mesh2)"
          delay={1500}
          amplitude={8}
          duration={7500}
          animated={animated}
        />
        <AnimatedMeshCircle
          cx={SCREEN_WIDTH * 0.5}
          cy={height * 0.65}
          r={200}
          fill="url(#mesh3)"
          delay={3000}
          amplitude={12}
          duration={10000}
          animated={animated}
        />
        <AnimatedMeshCircle
          cx={SCREEN_WIDTH * 0.85}
          cy={height * 0.75}
          r={140}
          fill="url(#mesh4)"
          delay={4500}
          amplitude={6}
          duration={8500}
          animated={animated}
        />
      </Svg>
    </View>
  );
}

export function GradientMeshCompact({
  height = 160,
  animated = true,
}: {
  height?: number;
  animated?: boolean;
}) {
  return (
    <View style={[styles.container, { height }]}>
      <Svg width={SCREEN_WIDTH} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="meshCompact1" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#0B2E5C" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#0B2E5C" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="meshCompact2" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FF6A00" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#FF6A00" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill="#F5F8FC" />

        <AnimatedMeshCircle
          cx={SCREEN_WIDTH * 0.15}
          cy={height * 0.4}
          r={120}
          fill="url(#meshCompact1)"
          amplitude={6}
          duration={8000}
          animated={animated}
        />
        <AnimatedMeshCircle
          cx={SCREEN_WIDTH * 0.8}
          cy={height * 0.3}
          r={100}
          fill="url(#meshCompact2)"
          amplitude={5}
          duration={7000}
          animated={animated}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
});
