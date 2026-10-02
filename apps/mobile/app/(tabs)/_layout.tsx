import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trpc } from '../../src/lib/trpc';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';

type TabIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  label: string;
};

function TabIcon({ name, focused, label }: TabIconProps) {
  return (
    <View className="items-center pt-2">
      <Ionicons
        name={name}
        size={24}
        color={focused ? '#018ABE' : '#5B7A91'}
      />
      <Text
        className={`text-xs mt-1 ${
          focused ? 'text-accent font-medium' : 'text-ink-muted'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { data: user, isLoading } = trpc.profiles.getMe.useQuery();
  const insets = useSafeAreaInsets();
  // Registers the push token and routes notification taps (signed-in area only)
  usePushNotifications();
  // Show all tabs while loading or if user is tasker (better UX than hiding)
  const isTasker = isLoading || user?.role === 'TASKER' || user?.role === 'BOTH';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: '#FFFFFF',
          borderTopColor: '#DCEAF1',
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarAccessibilityLabel: 'Início',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="home-outline" focused={focused} label="Início" />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          tabBarAccessibilityLabel: 'Buscar',
          href: isTasker ? '/(tabs)/feed' : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="search-outline" focused={focused} label="Buscar" />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          tabBarAccessibilityLabel: 'Ganhos',
          href: isTasker ? '/(tabs)/earnings' : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="wallet-outline" focused={focused} label="Ganhos" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarAccessibilityLabel: 'Perfil',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person-outline" focused={focused} label="Perfil" />
          ),
        }}
      />
    </Tabs>
  );
}
