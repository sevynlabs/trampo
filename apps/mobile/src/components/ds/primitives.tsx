import { ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  ViewStyle,
  StyleProp,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { colors, radius, shadow } from '../../theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'outline' | 'soft' | 'navy' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  flex?: boolean;
}

const BUTTON_COLORS: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.orange, fg: '#FFFFFF' },
  outline: { bg: '#FFFFFF', fg: colors.navy, border: colors.input },
  soft: { bg: colors.skySoft, fg: colors.navy },
  navy: { bg: colors.navy, fg: '#FFFFFF' },
  ghost: { bg: 'transparent', fg: colors.orange },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

/**
 * TRAMPO 2.0 button. Primary = solid orange with soft orange glow.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconRight,
  loading,
  disabled,
  size = 'lg',
  style,
  flex,
}: ButtonProps) {
  const c = BUTTON_COLORS[variant];
  const inactive = disabled || loading;
  const height = size === 'lg' ? 54 : size === 'md' ? 46 : 36;
  const fontSize = size === 'sm' ? 13 : 16;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        {
          height,
          borderRadius: size === 'sm' ? 10 : 16,
          backgroundColor: disabled ? '#E6EBF2' : c.bg,
          borderWidth: c.border ? 1.5 : 0,
          borderColor: c.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: size === 'sm' ? 14 : 22,
          opacity: pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        variant === 'primary' && !disabled ? shadow.cta : null,
        flex ? { flex: 1 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={fontSize + 3} color={disabled ? colors.inkFaint : c.fg} style={{ marginRight: 8 }} />}
          <Text style={{ color: disabled ? colors.inkFaint : c.fg, fontSize, fontWeight: '700' }}>{label}</Text>
          {iconRight && (
            <Ionicons name={iconRight} size={fontSize + 3} color={disabled ? colors.inkFaint : c.fg} style={{ marginLeft: 8 }} />
          )}
        </>
      )}
    </Pressable>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({
  children,
  style,
  onPress,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
}) {
  const base = [styles.card, padded && { padding: 16 }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [...base, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
    >
      {children}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ Avatar */

export function Avatar({
  name,
  uri,
  size = 48,
  verified,
}: {
  name?: string | null;
  uri?: string | null;
  size?: number;
  verified?: boolean;
}) {
  const initials = (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.navy,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.36 }}>{initials || '?'}</Text>
        </View>
      )}
      {verified && (
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: Math.max(16, size * 0.34),
            height: Math.max(16, size * 0.34),
            borderRadius: 99,
            backgroundColor: colors.success,
            borderWidth: 2,
            borderColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark" size={Math.max(10, size * 0.2)} color="#fff" />
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ Rating */

export function Rating({ value, count, size = 13 }: { value: number; count?: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Ionicons name="star" size={size + 1} color={colors.star} />
      <Text style={{ marginLeft: 4, fontSize: size, fontWeight: '700', color: colors.ink }}>
        {value > 0 ? value.toFixed(1).replace('.', ',') : 'Novo'}
      </Text>
      {count !== undefined && count > 0 && (
        <Text style={{ marginLeft: 4, fontSize: size, color: colors.inkMuted }}>
          ({count} {count === 1 ? 'avaliação' : 'avaliações'})
        </Text>
      )}
    </View>
  );
}

/* ----------------------------------------------------------- Category tile */

export function CategoryTile({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: IconName;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [
        styles.catTile,
        active && { backgroundColor: colors.orange },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons name={icon} size={26} color={active ? '#fff' : colors.orange} />
      <Text
        numberOfLines={2}
        style={{
          marginTop: 6,
          fontSize: 11.5,
          fontWeight: '600',
          textAlign: 'center',
          color: active ? '#fff' : colors.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ---------------------------------------------------------- Section header */

export function SectionHeader({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, style]}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 }}>{title}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.sky }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ----------------------------------------------------------- Screen header */

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  center,
  tone = 'light',
  paddingTop = 0,
}: {
  title?: string;
  subtitle?: string;
  onBack?: (() => void) | false;
  right?: ReactNode;
  center?: boolean;
  tone?: 'light' | 'dark';
  paddingTop?: number;
}) {
  const router = useRouter();
  const fg = tone === 'dark' ? '#fff' : colors.ink;
  const back = onBack === false ? null : onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home')));
  return (
    <View
      style={{
        paddingTop: paddingTop + 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: tone === 'dark' ? colors.navy : 'transparent',
      }}
    >
      {back ? (
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Voltar" style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color={fg} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1, alignItems: center ? 'center' : 'flex-start' }}>
        {!!title && (
          <Text numberOfLines={1} style={{ fontSize: center ? 18 : 22, fontWeight: '800', color: fg, letterSpacing: -0.4 }}>
            {title}
          </Text>
        )}
        {!!subtitle && <Text style={{ fontSize: 13, color: tone === 'dark' ? 'rgba(255,255,255,0.75)' : colors.inkMuted, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      <View style={{ minWidth: back && center ? 32 : 0, flexDirection: 'row', alignItems: 'center', gap: 12 }}>{right}</View>
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color = colors.ink,
  badge,
  filled,
}: {
  icon: IconName;
  onPress?: () => void;
  label: string;
  color?: string;
  badge?: boolean;
  filled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={filled ? { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.card } : { padding: 4 }}
    >
      <Ionicons name={icon} size={22} color={color} />
      {badge && (
        <View style={{ position: 'absolute', top: filled ? 8 : 2, right: filled ? 9 : 2, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange, borderWidth: 1.5, borderColor: '#fff' }} />
      )}
    </Pressable>
  );
}

/* --------------------------------------------------------------- SearchBar */

export function SearchBar({
  onFilter,
  onPress,
  style,
  ...input
}: TextInputProps & { onFilter?: () => void; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const content = (
    <View style={[styles.search, style]}>
      <Ionicons name="search" size={20} color={colors.ink} />
      {onPress ? (
        <Text style={{ flex: 1, marginLeft: 10, fontSize: 15, color: colors.inkFaint }}>{input.placeholder}</Text>
      ) : (
        <TextInput
          placeholderTextColor={colors.inkFaint}
          style={{ flex: 1, marginLeft: 10, fontSize: 15, color: colors.ink, paddingVertical: 0 }}
          returnKeyType="search"
          {...input}
        />
      )}
      {onFilter && (
        <Pressable onPress={onFilter} hitSlop={8} accessibilityRole="button" accessibilityLabel="Filtros" style={{ borderLeftWidth: 1, borderLeftColor: colors.hairline, paddingLeft: 12 }}>
          <Ionicons name="options-outline" size={22} color={colors.navy} />
        </Pressable>
      )}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="search" accessibilityLabel={input.placeholder}>
      {content}
    </Pressable>
  );
}

/* -------------------------------------------------------------------- Chip */

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        height: 34,
        borderRadius: 99,
        backgroundColor: active ? colors.orange : '#fff',
        borderWidth: 1,
        borderColor: active ? colors.orange : colors.hairline,
        marginRight: 8,
      }}
    >
      {icon && <Ionicons name={icon} size={14} color={active ? '#fff' : colors.navy} style={{ marginRight: 4 }} />}
      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------- Badge */

export function Badge({ label, tone = 'orange', icon }: { label: string; tone?: 'orange' | 'success' | 'sky' | 'warning' | 'danger' | 'neutral'; icon?: IconName }) {
  const map = {
    orange: [colors.orangeTint, colors.orange],
    success: [colors.successSoft, colors.success],
    sky: [colors.skySoft, colors.sky],
    warning: [colors.warningSoft, '#B45309'],
    danger: [colors.dangerSoft, colors.danger],
    neutral: [colors.background, colors.inkMuted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}>
      {icon && <Ionicons name={icon} size={13} color={fg} style={{ marginRight: 4 }} />}
      <Text style={{ fontSize: 12, fontWeight: '700', color: fg }}>{label}</Text>
    </View>
  );
}

/* --------------------------------------------------------------- IconBadge */

export function IconCircle({ icon, color = colors.orange, bg = colors.orangeTint, size = 44 }: { icon: IconName; color?: string; bg?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

/* ----------------------------------------------------------------- ListRow */

export function ListRow({ icon, label, value, onPress, danger }: { icon: IconName; label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 }, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.navy} />
      <Text style={{ flex: 1, marginLeft: 14, fontSize: 15, fontWeight: '600', color: danger ? colors.danger : colors.ink }}>{label}</Text>
      {value && <Text style={{ fontSize: 14, color: colors.inkMuted, marginRight: 6 }}>{value}</Text>}
      {!danger && <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />}
    </Pressable>
  );
}

/* ---------------------------------------------------------------- StatTile */

export function StatTile({ value, label, icon, tone = 'white' }: { value: string; label: string; icon?: IconName; tone?: 'white' | 'sky' | 'orange' }) {
  const bg = tone === 'sky' ? colors.sky : tone === 'orange' ? colors.orange : '#fff';
  const fg = tone === 'white' ? colors.ink : '#fff';
  return (
    <View style={[{ flex: 1, backgroundColor: bg, borderRadius: radius.lg, padding: 14, alignItems: tone === 'white' ? 'center' : 'flex-start' }, tone === 'white' && shadow.card]}>
      {icon && <Ionicons name={icon} size={20} color={tone === 'white' ? colors.navy : '#fff'} />}
      {tone !== 'white' && <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>{label}</Text>}
      <Text style={{ fontSize: 22, fontWeight: '800', color: fg, marginTop: icon ? 4 : 2 }}>{value}</Text>
      {tone === 'white' && <Text style={{ fontSize: 12, color: colors.inkMuted, textAlign: 'center' }}>{label}</Text>}
    </View>
  );
}

/* ---------------------------------------------------------- StatusTimeline */

export interface TimelineStep {
  label: string;
  caption?: string | null;
}

/**
 * Horizontal order timeline: done steps are orange checks, the current step
 * a blue ring, upcoming steps grey.
 */
export function StatusTimeline({ steps, current }: { steps: TimelineStep[]; current: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {steps.map((s, i) => {
        const done = i < current || (i === current && current === steps.length - 1);
        const active = i === current && !done;
        return (
          <View key={s.label} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={{ flex: 1, height: 3, backgroundColor: i === 0 ? 'transparent' : i <= current ? colors.orange : colors.hairline }} />
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done ? colors.orange : '#fff',
                  borderWidth: done ? 0 : 3,
                  borderColor: active ? colors.sky : colors.hairline,
                }}
              >
                {done && <Ionicons name="checkmark" size={16} color="#fff" />}
                {active && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.sky }} />}
              </View>
              <View style={{ flex: 1, height: 3, backgroundColor: i === steps.length - 1 ? 'transparent' : i < current ? colors.orange : colors.hairline }} />
            </View>
            <Text style={{ marginTop: 6, fontSize: 11.5, fontWeight: '700', color: i <= current ? colors.ink : colors.inkMuted, textAlign: 'center' }}>{s.label}</Text>
            {!!s.caption && <Text style={{ fontSize: 10.5, color: colors.inkMuted, textAlign: 'center' }}>{s.caption}</Text>}
          </View>
        );
      })}
    </View>
  );
}

/* --------------------------------------------------------------- InfoRow */

export function InfoRow({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
      <Ionicons name={icon} size={18} color={colors.navy} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, marginLeft: 12, fontSize: 14.5, color: colors.inkSoft, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.card,
    ...shadow.card,
  },
  catTile: {
    width: 66,
    minHeight: 76,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 10,
    ...shadow.card,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadow.card,
  },
});
