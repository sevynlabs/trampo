import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../src/lib/trpc';
import { clearToken } from '../../src/lib/trpc';

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

  const isTasker = user?.role === 'TASKER' || user?.role === 'BOTH';
  const kycStatus = user?.taskerProfile?.kycStatus;

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await clearToken();
          utils.invalidate();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-surface px-6 pt-16 pb-6 border-b border-border items-center">
        <View className="w-20 h-20 bg-accent/10 rounded-full items-center justify-center mb-3">
          <Text className="font-display text-3xl text-accent font-bold">
            {user?.name?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
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

        {isTasker && user?.taskerProfile?.rating && (
          <View className="flex-row items-center mt-2">
            <Ionicons name="star" size={16} color="#EA580C" />
            <Text className="text-ink-soft font-medium ml-1">
              {user.taskerProfile.rating.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
      >
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
          <Ionicons name="log-out-outline" size={20} color="#DC2626" />
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
      <Ionicons name={icon} size={22} color="#52525B" />
      <Text className="flex-1 text-ink ml-3">{label}</Text>
      <Ionicons name="chevron-forward" size={20} color="#A1A1AA" />
    </Pressable>
  );
}
