import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trpc } from '../lib/trpc';
import { formatCurrency } from '../lib/format';
import { Avatar, Card, Button, SectionHeader, IconButton, TaskRow, ListRow, AdBannerCarousel, colors } from '../components/ds';
import { MaintenanceBanner } from '../components/MaintenanceBanner';

const ACTIVE_ASSIGNED = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED'];
const AVAILABLE_KEY = 'trampo_tasker_available';

/**
 * Professional dashboard ("Olá, Carlos!"): availability toggle, requests /
 * in-progress tiles, earnings of the month and shortcuts.
 * Used as the Home tab for TASKER users and at /pro for BOTH users.
 */
export function TaskerHome({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [available, setAvailable] = useState(true);

  const { data: user } = trpc.profiles.getMe.useQuery();
  const assigned = trpc.tasks.listAssigned.useQuery();
  const earnings = trpc.payments.listForTasker.useQuery();
  const { data: unread } = trpc.notifications.unreadCount.useQuery();

  // Availability is a local preference for now (not yet used by the feed on the server)
  useEffect(() => {
    SecureStore.getItemAsync(AVAILABLE_KEY)
      .then((v) => {
        if (v !== null) setAvailable(v === '1');
      })
      .catch(() => {});
  }, []);
  const toggleAvailable = (v: boolean) => {
    setAvailable(v);
    SecureStore.setItemAsync(AVAILABLE_KEY, v ? '1' : '0').catch(() => {});
  };

  const activeAssigned = (assigned.data ?? []).filter((t) => ACTIVE_ASSIGNED.includes(t.status));
  const firstName = user?.name?.split(' ')[0];
  const profile = user?.taskerProfile;
  // Professionals need identity AND criminal record approved by the team
  const kycApproved = profile?.kycStatus === 'APPROVED' && user?.identityStatus === 'APPROVED';
  const proStatus = profile?.kycStatus ?? 'PENDING';

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([assigned.refetch(), earnings.refetch()]);
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
        {embedded && (
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Voltar" style={{ marginRight: 10 }}>
            <Ionicons name="arrow-back" size={24} color={colors.ink} />
          </Pressable>
        )}
        <Text style={{ flex: 1, fontSize: 24, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>
          Olá{firstName ? `, ${firstName}` : ''}! 👋
        </Text>
        <IconButton icon="notifications-outline" label="Notificações" badge={!!unread} onPress={() => router.push('/notifications')} />
        <View style={{ marginLeft: 12 }}>
          <Avatar name={user?.name} uri={user?.avatarUrl} size={42} verified={kycApproved} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <MaintenanceBanner />
        <View style={{ marginBottom: 16 }}>
          <AdBannerCarousel />
        </View>
        <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: available ? colors.success : colors.inkFaint }} />
          <Text style={{ flex: 1, marginLeft: 10, fontSize: 14.5, fontWeight: '600', color: colors.ink }}>
            {available ? 'Disponível para novos serviços' : 'Indisponível no momento'}
          </Text>
          <Switch
            value={available}
            onValueChange={toggleAvailable}
            trackColor={{ true: colors.success, false: colors.hairline }}
            thumbColor="#fff"
            accessibilityLabel="Disponível para novos serviços"
          />
        </Card>

        {!kycApproved && (
          <Card style={{ marginTop: 12, backgroundColor: colors.orangeTint }} onPress={() => router.push('/kyc')}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.orange} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontWeight: '800', color: colors.ink }}>
                  {proStatus === 'SUBMITTED' ? 'Conta profissional em análise' : 'Conclua sua conta profissional'}
                </Text>
                <Text style={{ fontSize: 13, color: colors.inkMuted }}>
                  {proStatus === 'SUBMITTED'
                    ? 'Os serviços disponíveis aparecem assim que a equipe aprovar.'
                    : proStatus === 'REJECTED'
                      ? 'Verificação reprovada. Toque para ver o motivo e reenviar.'
                      : 'Envie documento, selfie e a certidão de antecedentes criminais.'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
            </View>
          </Card>
        )}

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/(tabs)/feed')} accessibilityRole="button" accessibilityLabel="Ver solicitações">
            <View style={{ backgroundColor: colors.sky, borderRadius: 16, padding: 14, minHeight: 88 }}>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: '600' }}>Solicitações</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 10 }}>Ver novas</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ position: 'absolute', right: 12, bottom: 12 }} />
            </View>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/(tabs)/agenda')} accessibilityRole="button" accessibilityLabel="Serviços em andamento">
            <View style={{ backgroundColor: colors.orange, borderRadius: 16, padding: 14, minHeight: 88 }}>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: '600' }}>Em andamento</Text>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 2 }}>{activeAssigned.length}</Text>
            </View>
          </Pressable>
        </View>

        <Card style={{ marginTop: 14 }} onPress={() => router.push('/(tabs)/earnings')}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: colors.skySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="stats-chart" size={26} color={colors.sky} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ fontSize: 13, color: colors.inkMuted }}>Seus ganhos</Text>
              <Text style={{ fontSize: 24, fontWeight: '900', color: colors.ink }}>{formatCurrency(earnings.data?.thisMonth ?? 0)}</Text>
              <Text style={{ fontSize: 12, color: colors.inkMuted }}>Neste mês</Text>
            </View>
            <Button label="Sacar" size="sm" onPress={() => router.push('/withdraw')} />
          </View>
        </Card>

        {activeAssigned.length > 0 && (
          <View style={{ marginTop: 22 }}>
            <SectionHeader title="Em andamento" action="Agenda" onAction={() => router.push('/(tabs)/agenda')} />
            {activeAssigned.slice(0, 3).map((t) => (
              <TaskRow
                key={t.id}
                title={t.title}
                category={t.category.name}
                categorySlug={t.category.slug}
                subtitle={t.client?.name ? `Cliente: ${t.client.name}` : t.category.name}
                value={formatCurrency(t.taskerValue)}
                status={t.status}
                onPress={() => router.push(`/task/${t.id}`)}
              />
            ))}
          </View>
        )}

        <Card style={{ marginTop: 14, paddingVertical: 4 }}>
          <ListRow icon="grid-outline" label="Meus serviços" onPress={() => router.push('/profile/categories')} />
          <ListRow icon="calendar-outline" label="Agenda" onPress={() => router.push('/(tabs)/agenda')} />
          <ListRow icon="wallet-outline" label="Ganhos e saques" onPress={() => router.push('/(tabs)/earnings')} />
          <ListRow
            icon="star-outline"
            label={`Avaliações${profile && profile.rating > 0 ? ` (${profile.rating.toFixed(1).replace('.', ',')})` : ''}`}
            onPress={() => user && router.push(`/user/${user.id}`)}
          />
          <ListRow icon="settings-outline" label="Configurações" onPress={() => router.push('/(tabs)/profile')} />
        </Card>
      </ScrollView>
    </View>
  );
}
