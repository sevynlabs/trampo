import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { trpc } from '../../src/lib/trpc';
import { formatCurrency } from '../../src/lib/format';
import { GradientButton } from '../../src/components/GradientButton';
import { EmptyState, EmptyTasksIllustration } from '../../src/components/illustrations';
import { PressableCard } from '../../src/components/PressableCard';
import { SkeletonCard } from '../../src/components/Skeleton';

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  OPEN: { label: 'Aberto', bg: 'rgba(1, 138, 190, 0.1)', text: '#018ABE' },
  ACCEPTED: { label: 'Aceito', bg: 'rgba(245, 158, 11, 0.1)', text: '#D97706' },
  IN_PROGRESS: { label: 'Em andamento', bg: 'rgba(245, 158, 11, 0.1)', text: '#D97706' },
  COMPLETED: { label: 'Concluído', bg: 'rgba(14, 159, 110, 0.1)', text: '#0E9F6E' },
  RELEASED: { label: 'Finalizado', bg: 'rgba(14, 159, 110, 0.1)', text: '#0E9F6E' },
  CANCELLED: { label: 'Cancelado', bg: 'rgba(225, 29, 72, 0.1)', text: '#E11D48' },
  DISPUTED: { label: 'Em disputa', bg: 'rgba(225, 29, 72, 0.1)', text: '#E11D48' },
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: user, isLoading: userLoading } = trpc.profiles.getMe.useQuery();
  const { data: tasks, refetch, isLoading: tasksLoading } = trpc.tasks.listMine.useQuery(undefined, {
    enabled: !!user,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const isTasker = user?.role === 'TASKER' || user?.role === 'BOTH';
  const { data: unread } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: !!user,
  });

  const isLoading = userLoading || tasksLoading;

  return (
    <View style={styles.container}>
      {/* Header with subtle gradient */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#EEF6FA', '#F3F8FB']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Animated.Text
              entering={FadeIn.duration(300)}
              style={styles.greeting}
            >
              {getGreeting()}, {user?.name?.split(' ')[0] || 'Usuário'}
            </Animated.Text>
            <Animated.Text
              entering={FadeIn.delay(100).duration(300)}
              style={styles.subtitle}
            >
              {isTasker ? 'O que você quer fazer hoje?' : 'Precisa de ajuda com algo?'}
            </Animated.Text>
          </View>

          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={8}
            style={styles.notificationButton}
          >
            <Ionicons name="notifications-outline" size={22} color="#001B48" />
            {!!unread && unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Quick actions */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(420)}
          style={styles.actionsRow}
        >
          <Link href="/task/create" asChild>
            <Pressable style={styles.actionCardPrimary}>
              <LinearGradient
                colors={['#02457A', '#018ABE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.actionIcon}>
                <Ionicons name="add-circle" size={28} color="#ffffff" />
              </View>
              <Text style={styles.actionTitleLight}>Criar serviço</Text>
              <Text style={styles.actionSubtitleLight}>
                Encontre quem resolve
              </Text>
            </Pressable>
          </Link>

          {isTasker && (
            <Link href="/(tabs)/feed" asChild>
              <Pressable style={styles.actionCardSecondary}>
                <View style={styles.actionIcon}>
                  <Ionicons name="search" size={28} color="#018ABE" />
                </View>
                <Text style={styles.actionTitle}>Buscar trabalhos</Text>
                <Text style={styles.actionSubtitle}>
                  Ganhe dinheiro
                </Text>
              </Pressable>
            </Link>
          )}
        </Animated.View>

        {/* My tasks */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(420)}
          style={styles.sectionHeader}
        >
          <Text style={styles.sectionTitle}>Meus serviços</Text>
        </Animated.View>

        {isLoading ? (
          <View style={styles.skeletonContainer}>
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} index={i} style={styles.skeletonCard} />
            ))}
          </View>
        ) : tasks?.length === 0 ? (
          <EmptyState
            illustration={EmptyTasksIllustration}
            title="Você ainda não criou trampos"
            subtitle="Crie seu primeiro serviço e encontre profissionais perto de você."
          >
            <GradientButton
              label="Criar primeiro trampo"
              icon="add"
              onPress={() => router.push('/task/create')}
            />
          </EmptyState>
        ) : (
          <View style={styles.taskList}>
            {tasks?.map((task, i) => {
              const status = STATUS_LABELS[task.status] || STATUS_LABELS.OPEN;
              return (
                <PressableCard
                  key={task.id}
                  index={i}
                  variant={task.status === 'OPEN' ? 'highlighted' : 'default'}
                  onPress={() => router.push(`/task/${task.id}`)}
                >
                  <View style={styles.taskHeader}>
                    <Text style={styles.taskTitle} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                      <Text style={[styles.statusText, { color: status.text }]}>
                        {status.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.taskAddress}>
                    <Ionicons name="location-outline" size={14} color="#5B7A91" />
                    <Text style={styles.taskAddressText} numberOfLines={1}>
                      {task.address}
                    </Text>
                  </View>

                  <View style={styles.taskFooter}>
                    <Text style={styles.taskCategory}>
                      {task.category.name}
                    </Text>
                    <Text style={styles.taskValue}>
                      {formatCurrency(task.totalValue)}
                    </Text>
                  </View>
                </PressableCard>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F8FB',
  },
  headerContainer: {
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#DCEAF1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#001B48',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#5B7A91',
    marginTop: 4,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#02457A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  actionCardPrimary: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#018ABE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  actionCardSecondary: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#DCEAF1',
    shadowColor: '#02457A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    marginBottom: 8,
  },
  actionTitleLight: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  actionSubtitleLight: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#001B48',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#5B7A91',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#001B48',
  },
  skeletonContainer: {
    gap: 12,
  },
  skeletonCard: {
    marginBottom: 0,
  },
  taskList: {
    gap: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#001B48',
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskAddressText: {
    flex: 1,
    fontSize: 14,
    color: '#5B7A91',
    marginLeft: 4,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF6FA',
  },
  taskCategory: {
    fontSize: 13,
    color: '#5B7A91',
  },
  taskValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#018ABE',
  },
});
