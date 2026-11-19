import { View, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../../theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Brand hero used on onboarding / welcome screens: orange swoosh, a large
 * navy medallion with the slide icon and floating benefit chips
 * ("Rápido", "Seguro", "Local").
 * Real photography can replace the medallion later (assets/onboarding/*).
 */
export function BrandHero({
  icon,
  height = 320,
  chips = [
    { icon: 'flash', label: 'Rápido' },
    { icon: 'shield-checkmark', label: 'Seguro' },
    { icon: 'location', label: 'Local' },
  ],
}: {
  icon: IconName;
  height?: number;
  chips?: { icon: IconName; label: string }[];
}) {
  const medal = height * 0.62;
  return (
    <View style={{ height, justifyContent: 'center' }}>
      <Svg width="100%" height={height} viewBox="0 0 400 320" preserveAspectRatio="none" style={{ position: 'absolute' }}>
        <Path d="M-20 250 C 60 120, 170 60, 300 70 C 360 75, 400 40, 420 10 L 420 330 L -20 330 Z" fill={colors.orange} opacity={0.95} />
        <Path d="M-20 290 C 90 200, 220 170, 420 190 L 420 330 L -20 330 Z" fill={colors.orangePress} opacity={0.5} />
        <Circle cx="335" cy="60" r="34" fill={colors.sky} opacity={0.12} />
      </Svg>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 }}>
        <View
          style={{
            width: medal,
            height: medal,
            borderRadius: medal / 2,
            backgroundColor: colors.navy,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 6,
            borderColor: '#fff',
            ...shadow.card,
          }}
        >
          <Ionicons name={icon} size={medal * 0.44} color="#fff" />
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end', gap: 10 }}>
          {chips.map((c) => (
            <View
              key={c.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#fff',
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 14,
                ...shadow.card,
              }}
            >
              <Ionicons name={c.icon} size={18} color={colors.orange} />
              <Text style={{ marginLeft: 6, fontSize: 14, fontWeight: '800', color: colors.ink }}>{c.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
