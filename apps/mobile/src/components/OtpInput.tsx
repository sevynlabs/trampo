import { useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
} from 'react-native';
import type { TextInputInstance } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  interpolate,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const OTP_LENGTH = 6;

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  success?: boolean;
  disabled?: boolean;
}

function OtpDigitBox({
  digit,
  isActive,
  isFilled,
  isError,
  isSuccess,
  index,
}: {
  digit: string;
  isActive: boolean;
  isFilled: boolean;
  isError: boolean;
  isSuccess: boolean;
  index: number;
}) {
  const scale = useSharedValue(1);
  const cursorOpacity = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      cursorOpacity.value = withRepeat(
        withTiming(1, { duration: 500 }),
        -1,
        true
      );
    } else {
      cursorOpacity.value = withTiming(0, { duration: 100 });
    }
  }, [isActive]);

  useEffect(() => {
    if (isFilled) {
      scale.value = withSequence(
        withTiming(1.08, { duration: 80, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 120, easing: Easing.inOut(Easing.ease) })
      );
    }
  }, [isFilled, digit]);

  const boxAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const cursorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const getBorderColor = () => {
    if (isError) return '#E11D48';
    if (isSuccess) return '#0E9F6E';
    if (isActive) return '#FF6A00';
    if (isFilled) return '#0B2E5C';
    return '#E6EBF2';
  };

  const getBackgroundColor = () => {
    if (isSuccess) return 'rgba(14, 159, 110, 0.05)';
    if (isError) return 'rgba(225, 29, 72, 0.05)';
    return '#ffffff';
  };

  return (
    <Animated.View
      entering={FadeIn.delay(index * 50).duration(200)}
      style={[
        styles.digitBox,
        boxAnimatedStyle,
        {
          borderColor: getBorderColor(),
          backgroundColor: getBackgroundColor(),
          borderWidth: isActive || isFilled ? 2 : 1.5,
        },
      ]}
    >
      {digit ? (
        <Text style={styles.digitText}>{digit}</Text>
      ) : isActive ? (
        <Animated.View style={[styles.cursor, cursorAnimatedStyle]} />
      ) : null}
    </Animated.View>
  );
}

export function OtpInput({
  value,
  onChange,
  error,
  success,
  disabled,
}: OtpInputProps) {
  const inputRef = useRef<TextInputInstance>(null);
  const shakeAnimation = useSharedValue(0);
  const prevError = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (error && error !== prevError.current) {
      shakeAnimation.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }
    prevError.current = error;
  }, [error]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnimation.value }],
  }));

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(digits);
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        disabled={disabled}
      >
        <Animated.View style={[styles.boxesContainer, containerAnimatedStyle]}>
          {Array.from({ length: OTP_LENGTH }).map((_, i) => (
            <OtpDigitBox
              key={i}
              digit={value[i] || ''}
              isActive={value.length === i && !disabled}
              isFilled={!!value[i]}
              isError={!!error}
              isSuccess={!!success}
              index={i}
            />
          ))}
        </Animated.View>
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus
        editable={!disabled}
        style={styles.hiddenInput}
      />

      {!!error && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.errorContainer}
        >
          <Ionicons name="alert-circle" size={16} color="#E11D48" />
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      )}

      {success && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.successContainer}
        >
          <Ionicons name="checkmark-circle" size={16} color="#0E9F6E" />
          <Text style={styles.successText}>Código verificado</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  boxesContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  digitBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B2E5C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  digitText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#041E42',
  },
  cursor: {
    width: 2,
    height: 24,
    backgroundColor: '#FF6A00',
    borderRadius: 1,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 6,
  },
  errorText: {
    color: '#E11D48',
    fontSize: 14,
    fontWeight: '500',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 6,
  },
  successText: {
    color: '#0E9F6E',
    fontSize: 14,
    fontWeight: '500',
  },
});
