import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { trpc, clearTokens, getRefreshToken } from '../../src/lib/trpc';

const KYC_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'text-warning' },
  SUBMITTED: { label: 'Em análise', color: 'text-accent' },
  APPROVED: { label: 'Aprovado', color: 'text-success' },
  REJECTED: { label: 'Rejeitado', color: 'text-danger' },
};

export default function ProfileScreen() {
  const router = useRouter();
  const { data: user } = trpc.profiles.getMe.useQuery();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const logout = trpc.auth.logout.useMutation();
  const unregisterPush = trpc.profiles.unregisterPushToken.useMutation();

  const isTasker = user?.role === 'TASKER' || user?.role === 'BOTH';
  const kycStatus = user?.taskerProfile?.kycStatus;

  const becomeTasker = trpc.profiles.becomeTasker.useMutation({
    onSuccess: () => {
      utils.profiles.getMe.invalidate();
      Alert.alert(
        'Bem-vindo, profissional! 🎉',
        'Agora configure suas categorias e envie seus documentos para começar a pegar trampos.',
        [
          { text: 'Depois', style: 'cancel' },
          { text: 'Configurar', onPress: () => router.push('/profile/categories') },
        ]
      );
    },
    onError: (err) => Alert.alert('Erro', err.message),
  });

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          // Revoke the session server-side and stop pushes to this device;
          // local sign-out happens even if the network calls fail.
          const refreshToken = await getRefreshToken();
          await Promise.allSettled([
            unregisterPush.mutateAsync(),
            logout.mutateAsync({ refreshToken: refreshToken ?? undefined }),
          ]);
          await clearTokens();
          queryClient.clear();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-surface px-6 pt-16 pb-6 border-b border-border items-center">
        <LinearGradient
          colors={['#001B48', '#018ABE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 80,
            height: 80,
            borderRadius: 9999,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
            shadowColor: '#018ABE',
            shadowOpacity: 0.4,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <Text className="font-display text-3xl text-white font-bold">
            {user?.name?.charAt(0).toUpperCase() || '?'}
          </Text>
        </LinearGradient>
        <Text className="font-display text-xl font-bold text-ink">
          {user?.name || 'Usuário'}
        </Text>
        <Text className="text-ink-muted mt-1">{user?.phone}</Text>

        {isTasker && kycStatus && (
          <View className="flex-row items-center mt-3">
            <Text className="text-ink-muted text-sm">Verificação: </Text>
            <Text
              className={`font-medium text-sm ${
                KYC_STATUS_LABELS[kycStatus]?.color || 'text-ink'
              }`}
            >
              {KYC_STATUS_LABELS[kycStatus]?.label || kycStatus}
            </Text>
          </View>
        )}

        {isTasker && (user?.taskerProfile?.rating ?? 0) > 0 && (
          <View className="flex-row items-center mt-2">
            <Ionicons name="star" size={16} color="#018ABE" />
            <Text className="text-ink-soft font-medium ml-1">
              {user?.taskerProfile?.rating?.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
      >
        {/* Become a tasker CTA */}
        {user && !isTasker && (
          <Pressable
            onPress={() => becomeTasker.mutate()}
            disabled={becomeTasker.isPending}
            className="mb-6 rounded-card overflow-hidden"
          >
            <LinearGradient
              colors={['#02457A', '#018ABE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 20, flexDirection: 'row', alignItems: 'center' }}
            >
              <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
                <Ionicons name="briefcase-outline" size={24} color="#fff" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-white font-bold text-base">Quero oferecer serviços</Text>
                <Text className="text-white/80 text-sm mt-0.5">
                  Vire profissional e ganhe fazendo trampos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </LinearGradient>
          </Pressable>
        )}

        {/* Menu items */}
        <View className="bg-surface rounded-card border border-border overflow-hidden mb-6">
          <MenuItem
            icon="person-outline"
            label="Editar perfil"
            onPress={() => router.push('/profile/edit')}
          />
          {isTasker && (
            <>
              <MenuItem
                icon="grid-outline"
                label="Categorias de serviço"
                onPress={() => router.push('/profile/categories')}
              />
              <MenuItem
                icon="location-outline"
                label="Área de atuação"
                onPress={() => router.push('/profile/service-area')}
              />
              <MenuItem
                icon="document-outline"
                label="Documentos (KYC)"
                onPress={() => router.push('/kyc')}
              />
            </>
          )}
        </View>

        {user?.isAdmin && (
          <View className="bg-surface rounded-card border border-border overflow-hidden mb-6">
            <MenuItem
              icon="shield-checkmark-outline"
              label="Disputas (admin)"
              onPress={() => router.push('/admin/disputes')}
            />
            <MenuItem
              icon="pulse-outline"
              label="Operações (admin)"
              onPress={() => router.push('/admin/ops')}
            />
          </View>
        )}

        <View className="bg-surface rounded-card border border-border overflow-hidden mb-6">
          <MenuItem
            icon="help-circle-outline"
            label="Ajuda e suporte"
            onPress={() => router.push('/info/help')}
          />
          <MenuItem
            icon="document-text-outline"
            label="Termos de uso"
            onPress={() => router.push('/info/terms')}
          />
          <MenuItem
            icon="shield-outline"
            label="Política de privacidade"
            onPress={() => router.push('/info/privacy')}
          />
        </View>

        <Pressable
          onPress={handleLogout}
          className="bg-surface rounded-card border border-danger/20 p-4 flex-row items-center justify-center"
        >
          <Ionicons name="log-out-outline" size={20} color="#E11D48" />
          <Text className="text-danger font-medium ml-2">Sair da conta</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center p-4 border-b border-border last:border-b-0"
    >
      <Ionicons name={icon} size={22} color="#5B7A91" />
      <Text className="flex-1 text-ink ml-3">{label}</Text>
      <Ionicons name="chevron-forward" size={20} color="#94B2C4" />
    </Pressable>
  );
}
