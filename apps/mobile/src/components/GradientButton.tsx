import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'primary' | 'dark' | 'danger';

const GRADIENTS: Record<Variant, [string, string]> = {
  // deep blue -> vibrant blue (the palette's signature gradient)
  primary: ['#FF8A2B', '#FF6A00'],
  // deep navy -> dark blue (for hero / secondary emphasis)
  dark: ['#041E42', '#0B2E5C'],
  danger: ['#9F1239', '#E11D48'],
};

const DISABLED: [string, string] = ['#C9D2DE', '#C9D2DE'];

interface GradientButtonProps {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  size?: 'md' | 'lg';
}

/**
 * Primary call-to-action: a gradient pill with a subtle press-scale animation
 * and an optional leading/trailing icon. The signature TRAMPO button.
 */
export function GradientButton({
  label,
  onPress,
  icon,
  iconRight,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'lg',
}: GradientButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const inactive = disabled || loading;
  const colors = disabled ? DISABLED : GRADIENTS[variant];
  const padV = size === 'lg' ? 16 : 12;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={inactive ? undefined : onPress}
      onPressIn={() => {
        if (!inactive) scale.value = withTiming(0.97, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 140 });
      }}
      style={[animatedStyle, styles.shadow, { borderRadius: 16 }]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { paddingVertical: padV }]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon && <Ionicons name={icon} size={20} color="#fff" style={{ marginRight: 8 }} />}
            <Text style={styles.label}>{label}</Text>
            {iconRight && (
              <Ionicons name={iconRight} size={20} color="#fff" style={{ marginLeft: 8 }} />
            )}
          </>
        )}
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  gradient: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  label: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  shadow: {
    shadowColor: '#FF6A00',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
