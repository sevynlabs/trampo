import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  Extrapolation,
  SharedValue,
  ZoomIn,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, shadow } from '../../theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

export type FloatingItem =
  | { kind: 'icon'; icon: IconName; tone?: 'orange' | 'navy' | 'sky' | 'white' }
  | { kind: 'chip'; icon: IconName; label: string };

const TONES = {
  orange: { bg: colors.orange, fg: '#FFFFFF' },
  navy: { bg: colors.navy, fg: '#FFFFFF' },
  sky: { bg: colors.sky, fg: '#FFFFFF' },
  white: { bg: '#FFFFFF', fg: colors.orange },
} as const;

/** Endless gentle bob (up/down + slight tilt). Respects "reduce motion". */
function useFloat(delay: number, duration: number) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0.5);
  useEffect(() => {
    if (reduce) return;
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    return () => cancelAnimation(t);
  }, [reduce, delay, duration, t]);
  return useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(t.value, [0, 1], [-8, 8]) },
      { rotate: `${interpolate(t.value, [0, 1], [-5, 5])}deg` },
    ],
  }));
}

function Floating({ item, x, y, index }: { item: FloatingItem; x: number; y: number; index: number }) {
  const float = useFloat(index * 260, 2100 + (index % 3) * 450);
  const entering = ZoomIn.delay(250 + index * 110).springify().damping(12);

  if (item.kind === 'chip') {
    return (
      <Animated.View entering={entering} style={{ position: 'absolute', left: x, top: y, transform: [{ translateX: -50 }, { translateY: -20 }] }}>
        <Animated.View
          style={[
            { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16, ...shadow.card },
            float,
          ]}
        >
          <Ionicons name={item.icon} size={17} color={colors.orange} />
          <Text style={{ marginLeft: 6, fontSize: 13.5, fontWeight: '800', color: colors.ink }}>{item.label}</Text>
        </Animated.View>
      </Animated.View>
    );
  }

  const tone = TONES[item.tone ?? 'white'];
  const size = item.tone === 'white' || !item.tone ? 50 : 44;
  return (
    <Animated.View entering={entering} style={{ position: 'absolute', left: x - size / 2, top: y - size / 2 }}>
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size * 0.34,
            backgroundColor: tone.bg,
            alignItems: 'center',
            justifyContent: 'center',
            ...(item.tone === 'orange' ? shadow.cta : shadow.card),
          },
          float,
        ]}
      >
        <Ionicons name={item.icon} size={size * 0.48} color={tone.fg} />
      </Animated.View>
    </Animated.View>
  );
}

/** Slowly spinning dashed ring around the photo. */
function Orbit({ size }: { size: number }) {
  const reduce = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    r.value = withRepeat(withTiming(360, { duration: 24000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(r);
  }, [reduce, r]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.orange, opacity: 0.35 },
        style,
      ]}
    >
      <View style={{ position: 'absolute', top: -6, left: size / 2 - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.orange }} />
    </Animated.View>
  );
}

/**
 * Onboarding hero: brand photo in a circle on an orange halo, a spinning
 * orbit and icons/chips floating around it. `scrollX`/`index`/`pageWidth`
 * drive the parallax while the user swipes between slides.
 */
export function FloatingHero({
  image,
  items,
  width,
  height,
  index,
  scrollX,
}: {
  image: number;
  items: FloatingItem[];
  width: number;
  height: number;
  index: number;
  scrollX: SharedValue<number>;
}) {
  const photo = Math.min(height * 0.66, width * 0.62);
  const cx = width / 2;
  const cy = height / 2;
  const ring = photo + 56;
  const orbitR = ring / 2 + 14;

  const range = [(index - 1) * width, index * width, (index + 1) * width];
  const photoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(scrollX.value, range, [width * 0.35, 0, -width * 0.35], Extrapolation.CLAMP) },
      { scale: interpolate(scrollX.value, range, [0.7, 1, 0.7], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(scrollX.value, range, [0.2, 1, 0.2], Extrapolation.CLAMP),
  }));
  const itemsStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(scrollX.value, range, [width * 0.6, 0, -width * 0.6], Extrapolation.CLAMP) }],
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
  }));

  // Spread the floating items evenly on an ellipse around the photo.
  // Offset by half a step so no item sits straight above the photo (under the logo).
  const step = 360 / items.length;
  const start = -90 + step / 2;

  return (
    <View style={{ width, height }}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width, height, alignItems: 'center', justifyContent: 'center' }, photoStyle]}>
        <View style={{ position: 'absolute', width: ring + 40, height: ring + 40, borderRadius: (ring + 40) / 2, backgroundColor: colors.orangeTint }} />
        <View style={{ position: 'absolute', width: ring, height: ring, borderRadius: ring / 2, backgroundColor: colors.orange }} />
        <Orbit size={ring + 22} />
        <View style={{ width: photo, height: photo, borderRadius: photo / 2, borderWidth: 6, borderColor: '#fff', overflow: 'hidden', backgroundColor: colors.orangeSoft, ...shadow.card }}>
          <Image source={image} contentFit="cover" contentPosition="top" style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
        </View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width, height }, itemsStyle]}>
        {items.map((item, i) => {
          const a = ((start + i * step) * Math.PI) / 180;
          const rx = Math.min(orbitR + 6, width / 2 - 34);
          const ry = Math.min(orbitR, height / 2 - 26);
          let x = cx + rx * Math.cos(a);
          // Chips are ~100px wide and centered on x: keep them inside the screen.
          if (item.kind === 'chip') x = Math.min(Math.max(x, 62), width - 62);
          return <Floating key={i} item={item} index={i} x={x} y={cy + ry * Math.sin(a)} />;
        })}
      </Animated.View>
    </View>
  );
}
