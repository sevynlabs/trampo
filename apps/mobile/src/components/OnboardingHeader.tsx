import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GradientMesh } from './GradientMesh';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingHeaderProps {
  title: string;
  subtitle?: string;
  showMesh?: boolean;
  meshHeight?: number;
  meshIntensity?: 'subtle' | 'normal' | 'vibrant';
}

export function OnboardingHeader({
  title,
  subtitle,
  showMesh = true,
  meshHeight = 180,
  meshIntensity = 'normal',
}: OnboardingHeaderProps) {
  return (
    <View style={styles.container}>
      {showMesh && (
        <View style={styles.meshContainer}>
          <GradientMesh height={meshHeight} intensity={meshIntensity} />
          <View style={styles.meshFade} />
        </View>
      )}

      <View style={styles.content}>
        <Animated.Text
          entering={FadeInDown.delay(100).duration(420)}
          style={styles.title}
        >
          {title}
        </Animated.Text>

        {subtitle && (
          <Animated.Text
            entering={FadeInDown.delay(200).duration(420)}
            style={styles.subtitle}
          >
            {subtitle}
          </Animated.Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  meshContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  meshFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'transparent',
  },
  content: {
    paddingTop: 80,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#001B48',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#5B7A91',
    lineHeight: 22,
  },
});
