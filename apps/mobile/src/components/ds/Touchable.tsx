import { useState } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

type TouchableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
};

/**
 * Pressable with press feedback that works under NativeWind v4: NativeWind's
 * Pressable interop drops function styles (`style={({ pressed }) => ...}`),
 * so the pressed state is tracked here and a plain style is passed down.
 */
export function Touchable({ style, onPressIn, onPressOut, ...props }: TouchableProps) {
  const [pressed, setPressed] = useState(false);
  const resolved = typeof style === 'function' ? style({ pressed }) : style;
  return (
    <Pressable
      {...props}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={resolved}
    />
  );
}
