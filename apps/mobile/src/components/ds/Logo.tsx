import { View, Text } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { colors } from '../../theme/tokens';

interface LogoMarkProps {
  size?: number;
  /** Pin fill. Defaults to brand orange. */
  color?: string;
  /** Letter color. Defaults to white. */
  letterColor?: string;
}

/**
 * The TRAMPO mark: a location pin with a "t" cut in it.
 */
export function LogoMark({ size = 40, color = colors.orange, letterColor = '#FFFFFF' }: LogoMarkProps) {
  return (
    <Svg width={size} height={size * 1.18} viewBox="0 0 100 118">
      <Path
        d="M50 2C23.5 2 2 23.1 2 49.2c0 17.6 9.8 31.2 21.6 43.3L50 116l26.4-23.5C88.2 80.4 98 66.8 98 49.2 98 23.1 76.5 2 50 2z"
        fill={color}
      />
      <SvgText
        x="51"
        y="76"
        fill={letterColor}
        fontSize="72"
        fontWeight="900"
        textAnchor="middle"
      >
        t
      </SvgText>
    </Svg>
  );
}

interface LogoProps {
  /** Height of the pin mark; the word scales with it. */
  size?: number;
  /** "light" = navy word on light backgrounds; "dark" = white word on navy. */
  tone?: 'light' | 'dark';
  /** Show the "Serviços sob demanda" tagline. */
  tagline?: boolean;
}

/**
 * Full TRAMPO lockup: pin mark + "trampo" + "Serviços sob demanda" with the
 * orange swoosh under it.
 */
export function Logo({ size = 44, tone = 'light', tagline = true }: LogoProps) {
  const wordColor = tone === 'dark' ? '#FFFFFF' : colors.navy;
  const tagColor = tone === 'dark' ? '#FFFFFF' : colors.navy;
  const wordSize = size * 0.95;

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Trampo, serviços sob demanda"
    >
      <LogoMark size={size} />
      <View style={{ marginLeft: size * 0.12 }}>
        <Text
          style={{
            fontSize: wordSize,
            lineHeight: wordSize * 1.1,
            fontWeight: '900',
            color: wordColor,
            letterSpacing: -wordSize * 0.04,
          }}
        >
          trampo
        </Text>
        {tagline && (
          <View style={{ marginTop: -wordSize * 0.08 }}>
            <Text style={{ fontSize: Math.max(9, size * 0.24), fontWeight: '700', color: tagColor }}>
              Serviços <Text style={{ color: colors.orange }}>sob demanda</Text>
            </Text>
            <Svg width={wordSize * 2.6} height={size * 0.16} viewBox="0 0 260 16">
              <Path
                d="M4 10 C 80 2, 170 2, 256 8"
                stroke={colors.orange}
                strokeWidth={5}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </View>
        )}
      </View>
    </View>
  );
}
