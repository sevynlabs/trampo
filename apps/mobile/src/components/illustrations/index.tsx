import React from 'react';
import { View, Text } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Rect,
  Path,
  G,
} from 'react-native-svg';

/**
 * On-brand abstract illustrations built from SVG primitives + the TRAMPO blue
 * gradient. Kept geometric/“tech” to match the palette without heavy artwork.
 */

type IllustrationProps = { size?: number };

function Gradients() {
  return (
    <Defs>
      <LinearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#02457A" />
        <Stop offset="1" stopColor="#018ABE" />
      </LinearGradient>
      <LinearGradient id="soft" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#97CADB" />
        <Stop offset="1" stopColor="#D6E8EE" />
      </LinearGradient>
    </Defs>
  );
}

/** Discovery / empty feed — a location pin over a soft orbit. */
export function EmptyTasksIllustration({ size = 160 }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Gradients />
      <Circle cx="80" cy="84" r="62" fill="url(#soft)" opacity={0.45} />
      <Circle
        cx="80"
        cy="84"
        r="46"
        fill="none"
        stroke="#018ABE"
        strokeOpacity={0.35}
        strokeWidth={2}
        strokeDasharray="4 8"
      />
      {/* pin */}
      <Path
        d="M80 36c-16 0-29 13-29 29 0 21 29 47 29 47s29-26 29-47c0-16-13-29-29-29z"
        fill="url(#brand)"
      />
      <Circle cx="80" cy="65" r="11" fill="#ffffff" />
      <Circle cx="80" cy="65" r="5" fill="#018ABE" />
    </Svg>
  );
}

/** Earnings — a wallet with a gradient coin. */
export function EmptyEarningsIllustration({ size = 160 }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Gradients />
      <Circle cx="80" cy="80" r="64" fill="url(#soft)" opacity={0.4} />
      {/* wallet body */}
      <Rect x="40" y="58" width="80" height="54" rx="12" fill="url(#brand)" />
      <Rect x="40" y="58" width="80" height="20" rx="12" fill="#001B48" opacity={0.25} />
      {/* coin */}
      <Circle cx="104" cy="86" r="13" fill="#ffffff" />
      <Circle cx="104" cy="86" r="13" fill="url(#soft)" opacity={0.6} />
      <Path
        d="M104 79v14M100 83h6a2.5 2.5 0 010 5h-4a2.5 2.5 0 000 5h6"
        stroke="#02457A"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Generic empty / all-clear — gradient circle with a check. */
export function AllClearIllustration({ size = 160 }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Gradients />
      <Circle cx="80" cy="80" r="64" fill="url(#soft)" opacity={0.4} />
      <Circle cx="80" cy="80" r="40" fill="url(#brand)" />
      <Path
        d="M64 81l11 11 22-24"
        stroke="#ffffff"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <G opacity={0.5}>
        <Circle cx="124" cy="50" r="4" fill="#018ABE" />
        <Circle cx="36" cy="60" r="3" fill="#02457A" />
        <Circle cx="44" cy="116" r="3" fill="#018ABE" />
      </G>
    </Svg>
  );
}

/** Inbox / no messages — abstract chat bubbles. */
export function EmptyInboxIllustration({ size = 160 }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Gradients />
      <Circle cx="80" cy="80" r="64" fill="url(#soft)" opacity={0.4} />
      <Rect x="38" y="50" width="68" height="46" rx="14" fill="url(#brand)" />
      <Path d="M58 96l0 16 18-16z" fill="#018ABE" />
      <Rect x="74" y="76" width="48" height="34" rx="12" fill="#ffffff" />
      <Rect x="74" y="76" width="48" height="34" rx="12" fill="url(#soft)" opacity={0.5} />
      <Circle cx="86" cy="93" r="3" fill="#02457A" />
      <Circle cx="98" cy="93" r="3" fill="#02457A" />
      <Circle cx="110" cy="93" r="3" fill="#02457A" />
    </Svg>
  );
}

interface EmptyStateProps {
  illustration?: React.ComponentType<IllustrationProps>;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

/** Centered empty-state: illustration + title + subtitle + optional action. */
export function EmptyState({
  illustration: Illustration = AllClearIllustration,
  title,
  subtitle,
  children,
}: EmptyStateProps) {
  return (
    <View className="items-center px-8 py-10">
      <Illustration />
      <Text className="font-display text-lg font-bold text-ink mt-6 text-center">{title}</Text>
      {subtitle ? (
        <Text className="text-ink-muted text-center mt-2 leading-5">{subtitle}</Text>
      ) : null}
      {children ? <View className="mt-6 w-full">{children}</View> : null}
    </View>
  );
}
