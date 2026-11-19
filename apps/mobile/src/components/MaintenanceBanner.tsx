import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlatformConfig } from '../lib/platform-config';

/** Shown on the home screens while the admin has maintenance mode on. */
export function MaintenanceBanner({ style }: { style?: object }) {
  const { maintenanceMode } = usePlatformConfig();
  if (!maintenanceMode) return null;
  return (
    <View
      accessibilityRole="alert"
      style={[
        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 16, padding: 14, marginBottom: 14 },
        style,
      ]}
    >
      <Ionicons name="construct" size={20} color="#B45309" />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ fontWeight: '800', color: '#92400E' }}>Estamos em manutenção</Text>
        <Text style={{ color: '#92400E', fontSize: 13, marginTop: 2 }}>
          Novas solicitações e aceites estão pausados por alguns minutos. Serviços em andamento seguem normalmente.
        </Text>
      </View>
    </View>
  );
}
