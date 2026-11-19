import { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trpc } from '../../src/lib/trpc';
import { formatCurrency } from '../../src/lib/format';
import { SkeletonCard } from '../../src/components/Skeleton';
import { TaskerHome } from '../../src/screens/TaskerHome';
import { Image } from 'expo-image';
import { photos } from '../../src/theme/photos';
import {
  Logo,
  Avatar,
  Card,
  Button,
  SearchBar,
  CategoryTile,
  SectionHeader,
  IconButton,
  ProfessionalCard,
  TaskRow,
  AdBannerCarousel,
  categoryIcon,
  colors,
} from '../../src/components/ds';
import { MaintenanceBanner } from '../../src/components/MaintenanceBanner';

const ACTIVE_CLIENT = ['OPEN', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED'];

export default function HomeScreen() {
  const { data: user } = trpc.profiles.getMe.useQuery();
  if (user?.role === 'TASKER') return <TaskerHome />;
  return <ClientHome />;
}

function ClientHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data: user } = trpc.profiles.getMe.useQuery();
  const isBoth = user?.role === 'BOTH';
  const { data: unread } = trpc.notifications.unreadCount.useQuery(undefined, { enabled: !!user });
  const { data: categories } = trpc.categories.list.useQuery();
  const pros = trpc.profiles.listTaskers.useQuery({ limit: 5 }, { enabled: !!user });
  const tasks = trpc.tasks.listMine.useQuery(undefined, { enabled: !!user });
  const active = (tasks.data ?? []).filter((t) => ACTIVE_CLIENT.includes(t.status)).slice(0, 3);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([pros.refetch(), tasks.refetch()]);
    setRefreshing(false);
  };

  const firstName = user?.name?.split(' ')[0];
  const cats = (categories ?? []).slice(0, 4);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Logo size={34} />
        </View>
        <IconButton
          icon="notifications-outline"
          label={unread ? `Notificações, ${unread} não lidas` : 'Notificações'}
          badge={!!unread}
          onPress={() => router.push('/notifications')}
        />
        <Pressable onPress={() => router.push('/(tabs)/profile')} accessibilityRole="button" accessibilityLabel="Meu perfil" style={{ marginLeft: 12 }}>
          <Avatar name={user?.name} uri={user?.avatarUrl} size={40} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <MaintenanceBanner />
        <AdBannerCarousel />
        <Animated.View entering={FadeInDown.duration(380)} style={{ marginTop: 18 }}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: colors.ink, letterSpacing: -0.6 }}>
            Olá{firstName ? `, ${firstName}` : ''}! 👋
          </Text>
          <Text style={{ fontSize: 16, color: colors.inkSoft, marginTop: 2, marginBottom: 16 }}>O que você precisa hoje?</Text>
          <SearchBar
            placeholder="Buscar serviços, profissionais..."
            onPress={() => router.push('/(tabs)/search')}
            onFilter={() => router.push({ pathname: '/(tabs)/search', params: { filters: '1' } })}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(380)} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
          {cats.map((c) => (
            <CategoryTile
              key={c.id}
              label={c.name}
              icon={categoryIcon(c)}
              onPress={() => router.push({ pathname: '/(tabs)/search', params: { categoryId: c.id } })}
            />
          ))}
          <CategoryTile label="Ver mais" icon="grid-outline" onPress={() => router.push('/(tabs)/search')} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(380)}>
          <Pressable
            onPress={() => router.push('/task/create')}
            accessibilityRole="button"
            style={{ marginTop: 22, backgroundColor: colors.navy, borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}
          >
            <Image
              source={photos.drill}
              contentFit="cover"
              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '45%', opacity: 0.55 }}
              accessibilityIgnoresInvertColors
            />
            <View style={{ flex: 1, paddingRight: 40 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', lineHeight: 22 }}>Encontre o profissional ideal perto de você</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 }}>Publique seu pedido e receba a confirmação.</Text>
            </View>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
              <Ionicons name="arrow-forward" size={22} color="#fff" />
            </View>
          </Pressable>
        </Animated.View>

        {active.length > 0 && (
          <View style={{ marginTop: 26 }}>
            <SectionHeader title="Meus pedidos" action="Ver todos" onAction={() => router.push('/orders')} />
            {active.map((t) => (
              <TaskRow
                key={t.id}
                title={t.title}
                category={t.category.name}
                categorySlug={t.category.slug}
                subtitle={t.assignment?.tasker?.name ? `com ${t.assignment.tasker.name}` : t.category.name}
                value={formatCurrency(t.totalValue)}
                status={t.status}
                onPress={() => router.push(`/task/${t.id}`)}
              />
            ))}
          </View>
        )}

        <View style={{ marginTop: 26 }}>
          <SectionHeader title="Profissionais perto de você" action="Ver todos" onAction={() => router.push('/(tabs)/search')} />
          {pros.isLoading ? (
            [0, 1].map((i) => <SkeletonCard key={i} index={i} style={{ marginBottom: 12 }} />)
          ) : pros.isError ? (
            <Pressable onPress={() => pros.refetch()} accessibilityRole="button">
              <Text style={{ color: colors.inkMuted }}>Não foi possível carregar. Toque para tentar de novo.</Text>
            </Pressable>
          ) : (pros.data ?? []).length === 0 ? (
            <Card>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>Ainda não há profissionais verificados na sua região</Text>
              <Text style={{ fontSize: 13.5, color: colors.inkMuted, marginTop: 4, marginBottom: 14 }}>
                Publique seu pedido: assim que alguém da categoria aceitar, você é avisado.
              </Text>
              <Button label="Publicar pedido" size="md" icon="add" onPress={() => router.push('/task/create')} />
            </Card>
          ) : (
            (pros.data ?? []).map((p) => <ProfessionalCard key={p.id} pro={p} onPress={() => router.push(`/user/${p.id}`)} />)
          )}
        </View>

        {isBoth && (
          <Card style={{ marginTop: 14 }} onPress={() => router.push('/pro')}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="construct" size={22} color={colors.orange} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>Área do profissional</Text>
                <Text style={{ fontSize: 13, color: colors.inkMuted }}>Solicitações, agenda e ganhos</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
