import { Tabs, useRouter } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trpc } from '../../src/lib/trpc';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';
import { colors, shadow } from '../../src/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, focused, label }: { name: IconName; focused: boolean; label: string }) {
  const icon = (focused ? name.replace('-outline', '') : name) as IconName;
  return (
    <View style={{ alignItems: 'center', paddingTop: 8, width: 72 }}>
      <Ionicons name={icon in Ionicons.glyphMap ? icon : name} size={24} color={focused ? colors.orange : colors.inkMuted} />
      <Text numberOfLines={1} style={{ fontSize: 11, marginTop: 3, fontWeight: focused ? '700' : '500', color: focused ? colors.orange : colors.inkMuted }}>
        {label}
      </Text>
      {focused && <View style={{ width: 24, height: 3, borderRadius: 2, backgroundColor: colors.orange, marginTop: 4 }} />}
    </View>
  );
}

function PublishButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/task/create')}
      accessibilityRole="button"
      accessibilityLabel="Publicar serviço"
      style={{ flex: 1, alignItems: 'center' }}
    >
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 29,
          marginTop: -22,
          backgroundColor: colors.orange,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 4,
          borderColor: '#fff',
          ...shadow.cta,
        }}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </View>
      <Text style={{ fontSize: 11, marginTop: 2, fontWeight: '600', color: colors.ink }}>Publicar</Text>
    </Pressable>
  );
}

/**
 * Client tabs:  Início · Buscar · (+ Publicar) · Chat · Perfil
 * Tasker tabs:  Início · Solicitações · Agenda · Ganhos · Perfil
 * BOTH users get the client tabs; the tasker area is reachable from Início.
 */
export default function TabsLayout() {
  const { data: user } = trpc.profiles.getMe.useQuery();
  const insets = useSafeAreaInsets();
  usePushNotifications();
  const taskerOnly = user?.role === 'TASKER';

  const show = (visible: boolean, href: string) => (visible ? (href as never) : null);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 68 + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: '#FFFFFF',
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ tabBarAccessibilityLabel: 'Início', tabBarIcon: ({ focused }) => <TabIcon name="home-outline" focused={focused} label="Início" /> }}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: show(!taskerOnly, '/(tabs)/search'),
          tabBarAccessibilityLabel: 'Buscar',
          tabBarIcon: ({ focused }) => <TabIcon name="search-outline" focused={focused} label="Buscar" />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          href: show(taskerOnly, '/(tabs)/feed'),
          tabBarAccessibilityLabel: 'Solicitações',
          tabBarIcon: ({ focused }) => <TabIcon name="briefcase-outline" focused={focused} label="Solicitações" />,
        }}
      />
      <Tabs.Screen
        name="publish"
        // expo-router (SDK 58+) forbids `href` together with `tabBarButton`:
        // visible → custom button only; hidden → href: null only.
        options={
          taskerOnly
            ? { href: null }
            : { tabBarAccessibilityLabel: 'Publicar', tabBarButton: () => <PublishButton /> }
        }
      />
      <Tabs.Screen
        name="agenda"
        options={{
          href: show(taskerOnly, '/(tabs)/agenda'),
          tabBarAccessibilityLabel: 'Agenda',
          tabBarIcon: ({ focused }) => <TabIcon name="calendar-outline" focused={focused} label="Agenda" />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: show(!taskerOnly, '/(tabs)/chat'),
          tabBarAccessibilityLabel: 'Chat',
          tabBarIcon: ({ focused }) => <TabIcon name="chatbubble-ellipses-outline" focused={focused} label="Chat" />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          href: show(taskerOnly, '/(tabs)/earnings'),
          tabBarAccessibilityLabel: 'Ganhos',
          tabBarIcon: ({ focused }) => <TabIcon name="wallet-outline" focused={focused} label="Ganhos" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarAccessibilityLabel: 'Perfil', tabBarIcon: ({ focused }) => <TabIcon name="person-outline" focused={focused} label="Perfil" /> }}
      />
    </Tabs>
  );
}
