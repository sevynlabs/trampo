import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** Position in a list — drives the staggered entrance delay. */
  index?: number;
  /** Disable the entrance animation (e.g. for a single card). */
  animateIn?: boolean;
  style?: ViewStyle;
}

/**
 * A refined, tappable card: soft elevation, hairline border and a subtle
 * press-scale animation, with an optional staggered fade-in-up entrance.
 */
export function PressableCard({
  children,
  onPress,
  index = 0,
  animateIn = true,
  style,
}: PressableCardProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.98, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 160 });
      }}
      entering={animateIn ? FadeInDown.delay(Math.min(index, 8) * 55).duration(420) : undefined}
      style={[styles.card, animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCEAF1',
    padding: 16,
    shadowColor: '#02457A',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
});
