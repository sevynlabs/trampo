import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Card, ListRow, Rating, colors } from '../../src/components/ds';
import { useQueryClient } from '@tanstack/react-query';
import { trpc, clearTokens, getRefreshToken } from '../../src/lib/trpc';

const KYC_STATUS_LABELS: Record<string, { label: string; tone: 'warning' | 'sky' | 'success' | 'danger' }> = {
  PENDING: { label: 'Pendente', tone: 'warning' },
  SUBMITTED: { label: 'Em análise', tone: 'sky' },
  APPROVED: { label: 'Aprovado', tone: 'success' },
  REJECTED: { label: 'Rejeitado', tone: 'danger' },
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const kyc = kycStatus ? KYC_STATUS_LABELS[kycStatus] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      {/* Navy header */}
      <View style={{ backgroundColor: colors.navy, paddingTop: insets.top + 16, paddingBottom: 56, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Meu perfil</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }} style={{ marginTop: -44 }}>
        <Card style={{ alignItems: 'center', paddingTop: 20 }}>
          <Pressable onPress={() => router.push('/profile/edit')} accessibilityRole="button" accessibilityLabel="Alterar foto do perfil">
            <Avatar name={user?.name} uri={user?.avatarUrl} size={84} verified={kycStatus === 'APPROVED'} />
            <View style={{ position: 'absolute', left: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.orange, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </Pressable>
          <Text style={{ fontSize: 21, fontWeight: '900', color: colors.ink, marginTop: 10 }}>{user?.name || 'Usuário'}</Text>
          <Text style={{ color: colors.inkMuted, marginTop: 2 }}>{user?.phone}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Badge label={isTasker ? (user?.role === 'BOTH' ? 'Cliente e profissional' : 'Profissional') : 'Cliente'} tone="sky" />
            {isTasker && kyc && <Badge label={`Verificação: ${kyc.label}`} tone={kyc.tone} />}
          </View>
          {isTasker && (user?.taskerProfile?.rating ?? 0) > 0 && (
            <View style={{ marginTop: 8 }}>
              <Rating value={user!.taskerProfile!.rating} />
            </View>
          )}
          {user?.publicCode && (
            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.orangeTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.orange, letterSpacing: 0.8 }}>MEU ID</Text>
              <Text selectable style={{ marginLeft: 6, fontSize: 13, fontWeight: '800', color: colors.navy, letterSpacing: 1 }}>{user.publicCode}</Text>
            </View>
          )}
          {isTasker && user && (
            <View style={{ flexDirection: 'row', gap: 18, marginTop: 12 }}>
              <Pressable onPress={() => router.push(`/user/${user.id}`)} hitSlop={8} accessibilityRole="button">
                <Text style={{ color: colors.sky, fontWeight: '700' }}>Ver perfil público</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id, card: '1' } })}
                hitSlop={8}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Ionicons name="card-outline" size={16} color={colors.orange} />
                <Text style={{ color: colors.orange, fontWeight: '800', marginLeft: 4 }}>Cartão de visita</Text>
              </Pressable>
            </View>
          )}
        </Card>

        {/* Become a tasker CTA */}
        {user && !isTasker && (
          <Pressable
            onPress={() => becomeTasker.mutate()}
            disabled={becomeTasker.isPending}
            accessibilityRole="button"
            style={{ marginTop: 14, backgroundColor: colors.orange, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center' }}
          >
            <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' }}>
              <Ionicons name="construct-outline" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Quero prestar serviços</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>Divulgue seu trabalho e conquiste clientes</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </Pressable>
        )}

        <Card style={{ marginTop: 14, paddingVertical: 4 }}>
          <ListRow icon="person-outline" label="Editar perfil" onPress={() => router.push('/profile/edit')} />
          {user?.role !== 'TASKER' && <ListRow icon="receipt-outline" label="Meus pedidos" onPress={() => router.push('/orders')} />}
          {user?.role === 'BOTH' && <ListRow icon="construct-outline" label="Área do profissional" onPress={() => router.push('/pro')} />}
          {isTasker && (
            <>
              <ListRow icon="grid-outline" label="Categorias de serviço" onPress={() => router.push('/profile/categories')} />
              <ListRow icon="location-outline" label="Área de atuação" onPress={() => router.push('/profile/service-area')} />
              <ListRow icon="document-outline" label="Documentos (verificação)" onPress={() => router.push('/kyc')} />
            </>
          )}
          <ListRow icon="notifications-outline" label="Notificações" onPress={() => router.push('/notifications')} />
        </Card>

        {user?.isAdmin && (
          <Card style={{ marginTop: 14, paddingVertical: 4 }}>
            <ListRow icon="shield-checkmark-outline" label="Disputas (admin)" onPress={() => router.push('/admin/disputes')} />
            <ListRow icon="pulse-outline" label="Operações (admin)" onPress={() => router.push('/admin/ops')} />
          </Card>
        )}

        <Card style={{ marginTop: 14, paddingVertical: 4 }}>
          <ListRow icon="help-circle-outline" label="Ajuda e suporte" onPress={() => router.push('/info/help')} />
          <ListRow icon="document-text-outline" label="Termos de uso" onPress={() => router.push('/info/terms')} />
          <ListRow icon="shield-outline" label="Política de privacidade" onPress={() => router.push('/info/privacy')} />
        </Card>

        <Card style={{ marginTop: 14, paddingVertical: 4 }}>
          <ListRow icon="log-out-outline" label="Sair da conta" danger onPress={handleLogout} />
        </Card>
      </ScrollView>
    </View>
  );
}
