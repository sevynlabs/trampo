import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeInDown,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SelectionCardProps {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
  index?: number;
  disabled?: boolean;
  style?: ViewStyle;
}

export function SelectionCard({
  title,
  description,
  icon,
  selected,
  onPress,
  index = 0,
  disabled = false,
  style,
}: SelectionCardProps) {
  const scale = useSharedValue(1);
  const selectionProgress = useSharedValue(selected ? 1 : 0);
  const checkScale = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    selectionProgress.value = withTiming(selected ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });
    checkScale.value = withSpring(selected ? 1 : 0, {
      damping: 12,
      stiffness: 180,
    });
  }, [selected]);

  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 90 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 160 });
  };

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: selected ? '#018ABE' : '#DCEAF1',
    borderWidth: interpolate(selectionProgress.value, [0, 1], [1, 2]),
  }));

  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: selectionProgress.value * 0.05,
  }));

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  const iconColor = selected ? '#018ABE' : '#5B7A91';
  const titleColor = selected ? '#018ABE' : '#001B48';

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(420)}
      style={[styles.container, containerAnimatedStyle, style]}
    >
      {/* Selection background tint */}
      <Animated.View style={[styles.selectionBackground, backgroundAnimatedStyle]}>
        <LinearGradient
          colors={['#018ABE', '#97CADB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.content}>
        {icon && (
          <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
            <Ionicons name={icon} size={24} color={iconColor} />
          </View>
        )}

        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
          {description && <Text style={styles.description}>{description}</Text>}
        </View>

        <Animated.View style={[styles.checkContainer, checkAnimatedStyle]}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={14} color="#ffffff" />
          </View>
        </Animated.View>
      </View>
    </AnimatedPressable>
  );
}

interface SelectionCardGroupProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function SelectionCardGroup({ children, style }: SelectionCardGroupProps) {
  return <View style={[styles.group, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#02457A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  selectionBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EEF6FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconContainerSelected: {
    backgroundColor: 'rgba(1, 138, 190, 0.1)',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  description: {
    fontSize: 14,
    color: '#5B7A91',
    lineHeight: 20,
  },
  checkContainer: {
    marginLeft: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#018ABE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: {
    gap: 12,
  },
});
