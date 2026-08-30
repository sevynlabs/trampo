import { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const AnimatedView = Animated.createAnimatedComponent(View);

interface InputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  success?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  onIconRightPress?: () => void;
}

export function Input({
  label,
  value,
  onChangeText,
  error,
  success,
  icon,
  iconRight,
  onIconRightPress,
  ...textInputProps
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const labelPosition = useSharedValue(value ? 1 : 0);
  const focusAnimation = useSharedValue(0);
  const shakeAnimation = useSharedValue(0);
  const prevError = useRef<string | undefined>(undefined);

  const hasValue = value.length > 0;
  const isActive = isFocused || hasValue;

  useEffect(() => {
    labelPosition.value = withTiming(isActive ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.ease),
    });
  }, [isActive]);

  useEffect(() => {
    focusAnimation.value = withTiming(isFocused ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });
  }, [isFocused]);

  useEffect(() => {
    if (error && error !== prevError.current) {
      shakeAnimation.value = withSequence(
        withTiming(-4, { duration: 50 }),
        withTiming(4, { duration: 50 }),
        withTiming(-4, { duration: 50 }),
        withTiming(4, { duration: 50 }),
        withTiming(-4, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }
    prevError.current = error;
  }, [error]);

  const labelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(labelPosition.value, [0, 1], [0, -24]) },
      { scale: interpolate(labelPosition.value, [0, 1], [1, 0.75]) },
    ],
  }));

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnimation.value }],
    borderColor: error
      ? '#E11D48'
      : success
      ? '#0E9F6E'
      : isFocused
      ? '#018ABE'
      : '#DCEAF1',
    shadowOpacity: interpolate(focusAnimation.value, [0, 1], [0, 0.15]),
  }));

  const getBorderColor = () => {
    if (error) return '#E11D48';
    if (success) return '#0E9F6E';
    if (isFocused) return '#018ABE';
    return '#DCEAF1';
  };

  const getLabelColor = () => {
    if (error) return '#E11D48';
    if (success) return '#0E9F6E';
    if (isFocused) return '#018ABE';
    return '#5B7A91';
  };

  return (
    <View style={styles.wrapper}>
      <Pressable onPress={() => inputRef.current?.focus()}>
        <AnimatedView
          style={[
            styles.container,
            containerAnimatedStyle,
            {
              borderColor: getBorderColor(),
              shadowColor: '#018ABE',
            },
          ]}
        >
          {icon && (
            <View style={styles.iconLeft}>
              <Ionicons
                name={icon}
                size={20}
                color={isFocused ? '#018ABE' : '#5B7A91'}
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Animated.Text
              style={[
                styles.label,
                labelAnimatedStyle,
                { color: getLabelColor() },
              ]}
            >
              {label}
            </Animated.Text>

            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              style={[styles.input, icon && styles.inputWithIcon]}
              placeholderTextColor="#94B2C4"
              {...textInputProps}
            />
          </View>

          {(iconRight || success) && (
            <Pressable
              onPress={onIconRightPress}
              disabled={!onIconRightPress}
              style={styles.iconRight}
              hitSlop={8}
            >
              <Ionicons
                name={success ? 'checkmark-circle' : iconRight!}
                size={20}
                color={success ? '#0E9F6E' : '#5B7A91'}
              />
            </Pressable>
          )}
        </AnimatedView>
      </Pressable>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

export function PhoneInput({
  ddd,
  onDddChange,
  number,
  onNumberChange,
  error,
}: {
  ddd: string;
  onDddChange: (text: string) => void;
  number: string;
  onNumberChange: (text: string) => void;
  error?: string;
}) {
  const [focusedField, setFocusedField] = useState<'ddd' | 'number' | null>(null);
  const dddRef = useRef<TextInput>(null);
  const numberRef = useRef<TextInput>(null);
  const shakeAnimation = useSharedValue(0);
  const prevError = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (error && error !== prevError.current) {
      shakeAnimation.value = withSequence(
        withTiming(-4, { duration: 50 }),
        withTiming(4, { duration: 50 }),
        withTiming(-4, { duration: 50 }),
        withTiming(4, { duration: 50 }),
        withTiming(-4, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }
    prevError.current = error;
  }, [error]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnimation.value }],
  }));

  const handleDddChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 2);
    onDddChange(digits);
    if (digits.length >= 2) {
      numberRef.current?.focus();
    }
  };

  return (
    <View style={styles.wrapper}>
      <AnimatedView style={[styles.phoneRow, containerAnimatedStyle]}>
        <View style={[styles.phonePrefix, focusedField && styles.phonePrefixFaded]}>
          <Text style={styles.phonePrefixText}>+55</Text>
        </View>

        <TextInput
          ref={dddRef}
          value={ddd}
          onChangeText={handleDddChange}
          onFocus={() => setFocusedField('ddd')}
          onBlur={() => setFocusedField(null)}
          placeholder="DDD"
          placeholderTextColor="#94B2C4"
          keyboardType="number-pad"
          maxLength={2}
          style={[
            styles.phoneDdd,
            styles.phoneInputText,
            focusedField === 'ddd' && styles.phoneInputFocused,
            error && styles.phoneInputError,
          ]}
        />

        <TextInput
          ref={numberRef}
          value={number}
          onChangeText={(text) => onNumberChange(text.replace(/\D/g, '').slice(0, 9))}
          onFocus={() => setFocusedField('number')}
          onBlur={() => setFocusedField(null)}
          placeholder="00000-0000"
          placeholderTextColor="#94B2C4"
          keyboardType="number-pad"
          maxLength={9}
          style={[
            styles.phoneNumber,
            styles.phoneInputText,
            focusedField === 'number' && styles.phoneInputFocused,
            error && styles.phoneInputError,
          ]}
        />
      </AnimatedView>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 0,
  },
  iconLeft: {
    marginRight: 12,
  },
  iconRight: {
    marginLeft: 12,
  },
  inputContainer: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 24,
  },
  label: {
    position: 'absolute',
    left: 0,
    top: 2,
    fontSize: 16,
    fontWeight: '500',
    transformOrigin: 'left center',
  },
  input: {
    fontSize: 16,
    color: '#001B48',
    padding: 0,
    margin: 0,
  },
  inputWithIcon: {
    marginLeft: 0,
  },
  errorText: {
    color: '#E11D48',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  // Phone Input styles
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  phonePrefix: {
    backgroundColor: '#EEF6FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#DCEAF1',
  },
  phonePrefixFaded: {
    opacity: 0.7,
  },
  phonePrefixText: {
    color: '#5B7A91',
    fontSize: 16,
    fontWeight: '500',
  },
  phoneDdd: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: '#DCEAF1',
    width: 72,
  },
  phoneNumber: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: '#DCEAF1',
  },
  phoneInputFocused: {
    borderColor: '#018ABE',
    shadowColor: '#018ABE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 2,
  },
  phoneInputError: {
    borderColor: '#E11D48',
  },
  phoneInputText: {
    fontSize: 16,
    color: '#001B48',
    textAlign: 'center',
  },
});
