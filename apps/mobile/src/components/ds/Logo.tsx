import { View } from 'react-native';
import { Image } from 'expo-image';

/**
 * Official TRAMPO artwork, used exactly as delivered by the brand
 * (docs/marca/logo-horizontal-completo.webp and logo-icone-pin.webp).
 * The PNGs only had the white margins trimmed and the white background made
 * transparent — shapes, colors and proportions are untouched.
 */
const LOGO = require('../../../assets/brand/logo-horizontal.png');
const PIN = require('../../../assets/brand/logo-pin.png');
const LOGO_RATIO = 1200 / 229;
const PIN_RATIO = 480 / 619;

interface LogoMarkProps {
  /** Width of the pin. */
  size?: number;
}

/** The TRAMPO mark: orange location pin with the white "t". */
export function LogoMark({ size = 40 }: LogoMarkProps) {
  return (
    <Image
      source={PIN}
      contentFit="contain"
      style={{ width: size, height: size / PIN_RATIO }}
      accessibilityLabel="Trampo"
      accessibilityIgnoresInvertColors
    />
  );
}

interface LogoProps {
  /** Height of the full lockup; the width follows the original proportion. */
  size?: number;
  /** Optional max width (the lockup shrinks to fit, keeping proportion). */
  maxWidth?: number;
}

/** Full TRAMPO lockup: pin + "trampo" + "| Serviços sob demanda". */
export function Logo({ size = 44, maxWidth }: LogoProps) {
  let height = size;
  let width = size * LOGO_RATIO;
  if (maxWidth && width > maxWidth) {
    width = maxWidth;
    height = maxWidth / LOGO_RATIO;
  }
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Trampo, serviços sob demanda">
      <Image source={LOGO} contentFit="contain" style={{ width, height }} accessibilityIgnoresInvertColors />
    </View>
  );
}
