import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../src/lib/trpc';
import { formatCurrency } from '../../src/lib/format';
import { GradientButton } from '../../src/components/GradientButton';
import { EmptyState, EmptyTasksIllustration } from '../../src/components/illustrations';
import { PressableCard } from '../../src/components/PressableCard';
import { useState } from 'react';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Aberto', color: 'bg-accent' },
  ACCEPTED: { label: 'Aceito', color: 'bg-warning' },
  IN_PROGRESS: { label: 'Em andamento', color: 'bg-warning' },
  COMPLETED: { label: 'Concluído', color: 'bg-success' },
  RELEASED: { label: 'Finalizado', color: 'bg-success' },
  CANCELLED: { label: 'Cancelado', color: 'bg-danger' },
  DISPUTED: { label: 'Em disputa', color: 'bg-danger' },
};

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: user } = trpc.profiles.getMe.useQuery();
  const { data: tasks, refetch } = trpc.tasks.listMine.useQuery(undefined, {
    enabled: !!user,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const isTasker = user?.role === 'TASKER' || user?.role === 'BOTH';

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-surface px-6 pt-16 pb-6 border-b border-border">
        <Text className="font-display text-2xl font-bold text-ink">
          Olá, {user?.name?.split(' ')[0] || 'Usuário'}
        </Text>
        <Text className="text-ink-muted mt-1">
          {isTasker ? 'O que você quer fazer hoje?' : 'Precisa de ajuda com algo?'}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Quick actions */}
        <View className="flex-row gap-3 mb-8">
          <Link href="/task/create" asChild>
            <Pressable className="flex-1 bg-accent p-4 rounded-card">
              <Ionicons name="add-circle-outline" size={28} color="#fff" />
              <Text className="text-white font-bold mt-2">Criar serviço</Text>
              <Text className="text-white/80 text-sm">
                Encontre quem resolve
              </Text>
            </Pressable>
          </Link>

          {isTasker && (
            <Link href="/(tabs)/feed" asChild>
              <Pressable className="flex-1 bg-surface border border-border p-4 rounded-card">
                <Ionicons name="search-outline" size={28} color="#018ABE" />
                <Text className="text-ink font-bold mt-2">Buscar trabalhos</Text>
                <Text className="text-ink-muted text-sm">
                  Ganhe dinheiro
                </Text>
              </Pressable>
            </Link>
          )}
        </View>

        {/* My tasks */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="font-display text-lg font-bold text-ink">
            Meus serviços
          </Text>
        </View>

        {tasks?.length === 0 ? (
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
          <View className="gap-3">
            {tasks?.map((task, i) => {
              const status = STATUS_LABELS[task.status] || STATUS_LABELS.OPEN;
              return (
                <PressableCard
                  key={task.id}
                  index={i}
                  onPress={() => router.push(`/task/${task.id}`)}
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <Text className="font-bold text-ink flex-1 mr-2">
                      {task.title}
                    </Text>
                    <View className={`px-2 py-1 rounded-chip ${status.color}`}>
                      <Text className="text-white text-xs font-medium">
                        {status.label}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-ink-muted text-sm mb-3" numberOfLines={1}>
                    {task.address}
                  </Text>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-ink-soft text-sm">
                      {task.category.name}
                    </Text>
                    <Text className="font-bold text-accent">
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
