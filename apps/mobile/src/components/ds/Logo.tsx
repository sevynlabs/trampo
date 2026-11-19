import { View, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme/tokens';

/** Pin outline of the official mark (docs/marca/logo-icone-pin.webp), viewBox 100×130. */
const PIN_PATH =
  'M50 0C22.4 0 0 21.6 0 48.5C0 68 16 86 48.6 128.5C49.3 129.4 50.7 129.4 51.4 128.5C84 86 100 68 100 48.5C100 21.6 77.6 0 50 0Z';
/** The rounded "t" with the slanted flag and curled tail. */
const T_PATH =
  'M53.3 22.5C53.3 19.5 51 17 47.5 17C42 17 37.5 19.5 35 24C31.5 30 27.5 35 24.5 39C21.5 43.5 23.5 51.3 28.5 51.3L33.7 51.3L33.7 72C33.7 85 43.5 93 56.5 93C67 93 75 87 75 79C75 73 70 68.5 65 70.3C62 71.3 60 71.8 58 71.6C55 71.3 53.3 68.8 53.3 65.2L53.3 51.3L68.3 51.3C72.5 51.3 75.3 47.5 75.3 42.8C75.3 38 72.5 34.4 68.3 34.4L53.3 34.4Z';

const WORD_FONT = 'Nunito_900Black';
const TAG_FONT = 'Nunito_800ExtraBold';

interface LogoMarkProps {
  size?: number;
  color?: string;
  letterColor?: string;
}

/** The TRAMPO mark: orange location pin with the white "t". `size` is the width. */
export function LogoMark({ size = 40, color = colors.orange, letterColor = '#FFFFFF' }: LogoMarkProps) {
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 100 130">
      <Path d={PIN_PATH} fill={color} />
      <Path d={T_PATH} fill={letterColor} />
    </Svg>
  );
}

function Swoosh({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 260 24">
      <Path d="M6 20 C 70 2, 150 6, 254 4" stroke={colors.orange} strokeWidth={7} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

interface LogoProps {
  /** Height reference (pin width); the word scales with it. */
  size?: number;
  /** "light" = navy word on light backgrounds; "dark" = white word on navy. */
  tone?: 'light' | 'dark';
  /** Show the "Serviços sob demanda" tagline. */
  tagline?: boolean;
  /**
   * "stacked" = tagline under the word (app headers);
   * "horizontal" = official lockup with a vertical bar and the tagline on the right.
   */
  variant?: 'stacked' | 'horizontal';
}

/** Full TRAMPO lockup following docs/marca/logo-horizontal-completo.webp. */
export function Logo({ size = 44, tone = 'light', tagline = true, variant = 'stacked' }: LogoProps) {
  const ink = tone === 'dark' ? '#FFFFFF' : colors.navy;
  const wordSize = size * 1.15;

  const word = (
    <View>
      <Text style={{ fontFamily: WORD_FONT, fontWeight: '900', fontSize: wordSize, lineHeight: wordSize * 1.15, color: ink, letterSpacing: -wordSize * 0.02 }}>
        trampo
      </Text>
      <View style={{ position: 'absolute', right: -wordSize * 0.05, bottom: -wordSize * 0.02 }}>
        <Swoosh width={wordSize * 1.6} height={wordSize * 0.18} />
      </View>
    </View>
  );

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Trampo, serviços sob demanda"
    >
      <LogoMark size={size * 0.82} />
      <View style={{ marginLeft: size * 0.12 }}>
        {word}
        {tagline && variant === 'stacked' && (
          <Text style={{ fontFamily: TAG_FONT, fontSize: Math.max(9, size * 0.24), fontWeight: '800', color: ink, marginTop: size * 0.04 }}>
            Serviços <Text style={{ color: colors.orange }}>sob demanda</Text>
          </Text>
        )}
      </View>
      {tagline && variant === 'horizontal' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: size * 0.3 }}>
          <View style={{ width: 1.5, height: size * 0.9, backgroundColor: ink, marginRight: size * 0.3 }} />
          <Text style={{ fontFamily: TAG_FONT, fontSize: size * 0.32, lineHeight: size * 0.38, fontWeight: '800', color: ink }}>
            {'Serviços\nsob demanda'}
          </Text>
        </View>
      )}
    </View>
  );
}
