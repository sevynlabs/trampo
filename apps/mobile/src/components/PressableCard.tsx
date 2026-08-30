import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeInDown,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type CardVariant = 'default' | 'highlighted' | 'urgent';

interface PressableCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** Position in a list — drives the staggered entrance delay. */
  index?: number;
  /** Disable the entrance animation (e.g. for a single card). */
  animateIn?: boolean;
  /** Card variant for visual emphasis */
  variant?: CardVariant;
  style?: ViewStyle;
}

const VARIANT_CONFIG: Record<CardVariant, { accent: [string, string]; borderColor: string }> = {
  default: {
    accent: ['transparent', 'transparent'],
    borderColor: '#DCEAF1',
  },
  highlighted: {
    accent: ['#02457A', '#018ABE'],
    borderColor: '#018ABE',
  },
  urgent: {
    accent: ['#DC2626', '#F59E0B'],
    borderColor: '#F59E0B',
  },
};

/**
 * A refined, tappable card: soft elevation, hairline border and a subtle
 * press-scale animation, with an optional staggered fade-in-up entrance.
 *
 * Variants:
 * - default: standard card
 * - highlighted: accent corner + blue border
 * - urgent: warning gradient accent
 */
export function PressableCard({
  children,
  onPress,
  index = 0,
  animateIn = true,
  variant = 'default',
  style,
}: PressableCardProps) {
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const config = VARIANT_CONFIG[variant];
  const showAccent = variant !== 'default';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: interpolate(pressed.value, [0, 1], [0.07, 0.12]),
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 90 });
    pressed.value = withTiming(1, { duration: 90 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 160 });
    pressed.value = withTiming(0, { duration: 160 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      entering={animateIn ? FadeInDown.delay(Math.min(index, 8) * 55).duration(420) : undefined}
      style={[
        styles.card,
        { borderColor: config.borderColor },
        animatedStyle,
        style,
      ]}
    >
      {/* Corner accent */}
      {showAccent && (
        <View style={styles.accentContainer}>
          <LinearGradient
            colors={config.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.accent}
          />
        </View>
      )}

      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#02457A',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    overflow: 'hidden',
  },
  accentContainer: {
    position: 'absolute',
    top: -1,
    left: 16,
    width: 3,
    height: 28,
    borderRadius: 2,
    overflow: 'hidden',
  },
  accent: {
    flex: 1,
  },
});
