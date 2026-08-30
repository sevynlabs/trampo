import { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const SKELETON_BASE = '#DCEAF1';
const SKELETON_HIGHLIGHT = '#EEF6FA';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

interface SkeletonTextProps extends SkeletonProps {
  lines?: number;
  lastLineWidth?: number | `${number}%`;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

function SkeletonBase({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(shimmer.value, [0, 1], [-200, 200]),
      },
    ],
  }));

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius,
          backgroundColor: SKELETON_BASE,
        },
        style,
      ]}
    >
      <AnimatedLinearGradient
        colors={[SKELETON_BASE, SKELETON_HIGHLIGHT, SKELETON_BASE]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.shimmer, animatedStyle]}
      />
    </View>
  );
}

export function Skeleton(props: SkeletonProps) {
  return <SkeletonBase {...props} />;
}

export function SkeletonText({
  lines = 1,
  lastLineWidth = '60%',
  height = 14,
  ...props
}: SkeletonTextProps) {
  return (
    <View style={styles.textContainer}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBase
          key={i}
          height={height}
          borderRadius={4}
          width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
          style={i < lines - 1 ? styles.textLine : undefined}
          {...props}
        />
      ))}
    </View>
  );
}

export function SkeletonCircle({ size = 48, style }: { size?: number; style?: ViewStyle }) {
  return <SkeletonBase width={size} height={size} borderRadius={size / 2} style={style} />;
}

export function SkeletonCard({
  index = 0,
  style,
}: {
  index?: number;
  style?: ViewStyle;
}) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.ease),
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.card,
        animatedStyle,
        { transform: [{ translateY: 0 }] },
        style,
      ]}
    >
      <View style={styles.cardHeader}>
        <SkeletonCircle size={40} />
        <View style={styles.cardHeaderText}>
          <SkeletonBase width="70%" height={14} borderRadius={4} />
          <SkeletonBase width="40%" height={12} borderRadius={4} style={styles.cardSubtitle} />
        </View>
      </View>
      <SkeletonText lines={2} height={12} />
      <View style={styles.cardFooter}>
        <SkeletonBase width={60} height={12} borderRadius={4} />
        <SkeletonBase width={80} height={20} borderRadius={4} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 200,
  },
  textContainer: {
    width: '100%',
  },
  textLine: {
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCEAF1',
    shadowColor: '#02457A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  cardSubtitle: {
    marginTop: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#DCEAF1',
  },
});
