import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';
import { Avatar, Card, Rating, Badge } from './primitives';

type IconName = keyof typeof Ionicons.glyphMap;

const CATEGORY_ICONS: Array<[RegExp, IconName]> = [
  [/limp|faxin|diar/i, 'sparkles-outline'],
  [/repar|reform|obra|manut/i, 'construct-outline'],
  [/el[eé]tr/i, 'flash-outline'],
  [/hidr|encan|bomb/i, 'water-outline'],
  [/mudan|frete|carret/i, 'cube-outline'],
  [/entreg|motob/i, 'bicycle-outline'],
  [/pet|cachorr|animal/i, 'paw-outline'],
  [/aula|professor|ensin/i, 'school-outline'],
  [/event|festa|gar[cç]/i, 'balloon-outline'],
  [/beleza|cabel|manic|est[eé]t/i, 'cut-outline'],
  [/pint/i, 'color-palette-outline'],
  [/jardin/i, 'leaf-outline'],
  [/instal|montag/i, 'hammer-outline'],
  [/ar.?cond|climat/i, 'snow-outline'],
  [/inform|tecnolog|comput/i, 'laptop-outline'],
];

/** Pick an icon for a category: DB icon if it is a valid Ionicons name, else by name. */
export function categoryIcon(cat: { name?: string | null; slug?: string | null; icon?: string | null }): IconName {
  if (cat.icon && cat.icon in Ionicons.glyphMap) return cat.icon as IconName;
  const key = `${cat.slug ?? ''} ${cat.name ?? ''}`;
  for (const [re, icon] of CATEGORY_ICONS) if (re.test(key)) return icon;
  return 'briefcase-outline';
}

export interface ProfessionalSummary {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  rating: number;
  totalTasks: number;
  reviewCount: number;
  categories: { id: string; name: string }[];
}

/**
 * Card used on Home / Buscar: avatar with verified check, name, main category,
 * rating and number of jobs.
 */
export function ProfessionalCard({ pro, onPress, onHire }: { pro: ProfessionalSummary; onPress?: () => void; onHire?: () => void }) {
  const mainCategory = pro.categories[0]?.name ?? 'Profissional';
  return (
    <Card onPress={onPress} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={pro.name} uri={pro.avatarUrl} size={64} verified />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>
            {pro.name ?? 'Profissional'}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 13, color: colors.inkMuted, marginTop: 1 }}>
            {pro.categories.length > 1 ? `${mainCategory} +${pro.categories.length - 1}` : mainCategory}
          </Text>
          <View style={{ marginTop: 4 }}>
            <Rating value={pro.rating} count={pro.reviewCount} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="briefcase-outline" size={13} color={colors.sky} />
            <Text style={{ fontSize: 12.5, color: colors.inkMuted, marginLeft: 4 }}>
              {pro.totalTasks} {pro.totalTasks === 1 ? 'serviço realizado' : 'serviços realizados'}
            </Text>
          </View>
        </View>
        {onHire ? (
          <Pressable
            onPress={onHire}
            accessibilityRole="button"
            accessibilityLabel={`Contratar ${pro.name ?? 'profissional'}`}
            style={{ backgroundColor: colors.orange, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-end' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12.5 }}>Contratar</Text>
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
        )}
      </View>
    </Card>
  );
}

export const TASK_STATUS: Record<string, { label: string; tone: 'orange' | 'success' | 'sky' | 'warning' | 'danger' | 'neutral' }> = {
  OPEN: { label: 'Aguardando profissional', tone: 'sky' },
  ACCEPTED: { label: 'Confirmado', tone: 'orange' },
  IN_PROGRESS: { label: 'Em andamento', tone: 'warning' },
  COMPLETED: { label: 'Concluído', tone: 'success' },
  RELEASED: { label: 'Finalizado', tone: 'success' },
  CANCELLED: { label: 'Cancelado', tone: 'danger' },
  DISPUTED: { label: 'Em disputa', tone: 'danger' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = TASK_STATUS[status] ?? TASK_STATUS.OPEN;
  return <Badge label={s.label} tone={s.tone} />;
}

/**
 * Compact task row used in lists (Meus pedidos, Agenda, Solicitações).
 */
export function TaskRow({
  title,
  category,
  categorySlug,
  subtitle,
  value,
  status,
  onPress,
}: {
  title: string;
  category: string;
  categorySlug?: string;
  subtitle?: string;
  value: string;
  status?: string;
  onPress?: () => void;
}) {
  return (
    <Card onPress={onPress} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.orangeTint, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={categoryIcon({ name: category, slug: categorySlug })} size={24} color={colors.orange} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: '800', color: colors.ink }}>
            {title}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12.5, color: colors.inkMuted, marginTop: 2 }}>
            {subtitle ?? category}
          </Text>
          {status && (
            <View style={{ marginTop: 6 }}>
              <StatusBadge status={status} />
            </View>
          )}
        </View>
        <Text style={{ fontSize: 15.5, fontWeight: '800', color: colors.ink, marginLeft: 8 }}>{value}</Text>
      </View>
    </Card>
  );
}
