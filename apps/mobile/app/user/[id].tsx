import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Share } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trpc } from '../../src/lib/trpc';
import { Avatar, Card, Rating, Button, Chip, IconCircle, ProfileCardShare, categoryIcon, colors, shadow } from '../../src/components/ds';

function since(iso: string) {
  const months = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (30 * 24 * 3600 * 1000)));
  if (months < 1) return { value: 'Novo', label: 'na plataforma' };
  if (months < 12) return { value: `${months} ${months === 1 ? 'mês' : 'meses'}`, label: 'na plataforma' };
  const years = Math.floor(months / 12);
  return { value: `${years} ${years === 1 ? 'ano' : 'anos'}`, label: 'na plataforma' };
}

type Tab = 'about' | 'services' | 'reviews';

/** "Perfil do profissional" (also used for any public profile). */
export default function PublicProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, card } = useLocalSearchParams<{ id: string; card?: string }>();
  const [tab, setTab] = useState<Tab>('about');
  const [cardOpen, setCardOpen] = useState(card === '1');

  const { data: me } = trpc.profiles.getMe.useQuery();
  const { data: profile, isLoading, isError, refetch } = trpc.profiles.getPublic.useQuery({ userId: id! });
  const { data: reviewsData } = trpc.reviews.listForUser.useQuery({ userId: id!, limit: 30 });

  if (isLoading || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        {isError ? (
          <Button label="Tentar novamente" variant="outline" onPress={() => refetch()} />
        ) : (
          <ActivityIndicator size="large" color={colors.orange} />
        )}
      </View>
    );
  }

  const reviews = reviewsData?.reviews ?? [];
  const positive = reviews.filter((r) => r.rating >= 4).length;
  const satisfaction = reviews.length ? Math.round((positive / reviews.length) * 100) : null;
  const time = since(profile.memberSince);
  const isMe = me?.id === profile.id;
  const mainCategory = profile.categories[0];
  const hire = () =>
    router.push({ pathname: '/task/create', params: mainCategory ? { categoryId: mainCategory.id } : {} });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Navy header */}
        <View style={{ backgroundColor: colors.navy, paddingTop: insets.top + 8, paddingBottom: 70, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Voltar">
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </Pressable>
            <Text style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 17, fontWeight: '800' }}>
              {profile.isTasker ? 'Perfil do profissional' : 'Perfil'}
            </Text>
            <Pressable
              onPress={() =>
                profile.isTasker
                  ? setCardOpen(true)
                  : Share.share({ message: `Conheça ${profile.name ?? 'este perfil'} no Trampo! ID: ${profile.publicCode}` })
              }
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Compartilhar perfil"
            >
              <Ionicons name="share-social-outline" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View style={{ marginTop: -56, alignItems: 'center', paddingHorizontal: 20 }}>
          <View style={{ borderWidth: 4, borderColor: '#fff', borderRadius: 70, ...shadow.card }}>
            <Avatar name={profile.name} uri={profile.avatarUrl} size={112} verified={profile.kycVerified} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.ink, marginTop: 10 }}>{profile.name ?? 'Usuário'}</Text>
          {profile.categories.length > 0 && (
            <Text style={{ fontSize: 14.5, color: colors.inkSoft, marginTop: 2, textAlign: 'center' }}>
              {profile.categories.map((c) => c.name).join(' · ')}
            </Text>
          )}
          {profile.isTasker && (
            <View style={{ marginTop: 6 }}>
              <Rating value={profile.rating} count={profile.reviewCount} size={15} />
            </View>
          )}
          <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.orangeTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.orange, letterSpacing: 0.8 }}>ID</Text>
            <Text selectable style={{ marginLeft: 6, fontSize: 13, fontWeight: '800', color: colors.navy, letterSpacing: 1 }}>{profile.publicCode}</Text>
          </View>
        </View>

        {profile.isTasker && (
          <Card style={{ marginHorizontal: 20, marginTop: 16, flexDirection: 'row', paddingVertical: 14 }}>
            <Stat icon="briefcase-outline" value={String(profile.totalTasks)} label="Serviços" />
            <View style={{ width: 1, backgroundColor: colors.hairline }} />
            <Stat icon="calendar-outline" value={time.value} label={time.label} />
            <View style={{ width: 1, backgroundColor: colors.hairline }} />
            <Stat icon="thumbs-up-outline" value={satisfaction === null ? '—' : `${satisfaction}%`} label="Satisfação" />
          </Card>
        )}

        {/* Tabs */}
        <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 20, borderBottomWidth: 1, borderBottomColor: colors.hairline }}>
          {(
            [
              ['about', 'Sobre'],
              ['services', 'Serviços'],
              ['reviews', `Avaliações${reviewsData ? ` (${reviewsData.total})` : ''}`],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: tab === key ? '800' : '600', color: tab === key ? colors.orange : colors.inkMuted }}>{label}</Text>
              {tab === key && <View style={{ position: 'absolute', bottom: -1, height: 3, width: '70%', borderRadius: 2, backgroundColor: colors.orange }} />}
            </Pressable>
          ))}
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          {tab === 'about' && (
            <>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 6 }}>Sobre mim</Text>
              <Text style={{ fontSize: 14.5, lineHeight: 21, color: colors.inkSoft }}>
                {profile.bio || 'Este profissional ainda não escreveu uma apresentação.'}
              </Text>
              <Card style={{ marginTop: 16, paddingVertical: 6 }}>
                <Check icon="shield-checkmark" color={colors.sky} label="Documentos verificados" ok={profile.kycVerified} />
                <Check icon="star" color={colors.star} label="Avaliações reais" ok={profile.reviewCount > 0} />
                <Check icon="location" color={colors.orange} label="Atua no Triângulo Mineiro" ok />
              </Card>
            </>
          )}

          {tab === 'services' &&
            (profile.categories.length === 0 ? (
              <Text style={{ color: colors.inkMuted }}>Nenhuma categoria cadastrada.</Text>
            ) : (
              profile.categories.map((c) => (
                <Card key={c.id} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center' }} onPress={isMe ? undefined : () => router.push({ pathname: '/task/create', params: { categoryId: c.id } })}>
                  <IconCircle icon={categoryIcon(c)} />
                  <Text style={{ flex: 1, marginLeft: 12, fontSize: 15.5, fontWeight: '700', color: colors.ink }}>{c.name}</Text>
                  {!isMe && <Text style={{ color: colors.orange, fontWeight: '700' }}>Contratar</Text>}
                </Card>
              ))
            ))}

          {tab === 'reviews' &&
            (reviews.length === 0 ? (
              <Text style={{ color: colors.inkMuted }}>Ainda não há avaliações.</Text>
            ) : (
              reviews.map((r) => (
                <Card key={r.id} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Avatar name={r.reviewer.name} uri={r.reviewer.avatarUrl} size={36} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontWeight: '800', color: colors.ink }}>{r.reviewer.name ?? 'Usuário'}</Text>
                      <Text style={{ fontSize: 12, color: colors.inkMuted }}>{r.task.title}</Text>
                    </View>
                    <Rating value={r.rating} />
                  </View>
                  {r.comment ? <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>{r.comment}</Text> : null}
                  {r.tags?.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                      {r.tags.map((t) => (
                        <Chip key={t} label={t} />
                      ))}
                    </View>
                  )}
                </Card>
              ))
            ))}
        </View>
      </ScrollView>

      {profile.isTasker && (
        <ProfileCardShare
          visible={cardOpen}
          onClose={() => setCardOpen(false)}
          data={{
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            publicCode: profile.publicCode,
            categories: profile.categories,
            rating: profile.rating,
            reviewCount: profile.reviewCount,
            totalTasks: profile.totalTasks,
            kycVerified: profile.kycVerified,
            bio: profile.bio,
            timeOnPlatform: time.value,
          }}
        />
      )}

      {profile.isTasker && !isMe && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: colors.hairline }}>
          <Button label="Chat" variant="outline" icon="chatbubble-outline" onPress={() => router.push('/(tabs)/chat')} style={{ paddingHorizontal: 18 }} />
          <Button label="Contratar" iconRight="arrow-forward" onPress={hire} flex />
        </View>
      )}
    </View>
  );
}

function Stat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Ionicons name={icon} size={20} color={colors.navy} />
      <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink, marginTop: 2 }}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.inkMuted }}>{label}</Text>
    </View>
  );
}

function Check({ icon, color, label, ok }: { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; ok: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{ flex: 1, marginLeft: 12, fontSize: 14.5, color: colors.ink }}>{label}</Text>
      <Ionicons name={ok ? 'checkmark' : 'remove'} size={20} color={ok ? colors.success : colors.inkFaint} />
    </View>
  );
}
