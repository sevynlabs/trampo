import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../src/lib/trpc';

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
        color={focused ? '#018ABE' : '#94B2C4'}
      />
      <Text
        className={`text-xs mt-1 ${
          focused ? 'text-accent font-medium' : 'text-ink-faint'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { data: user } = trpc.profiles.getMe.useQuery();
  const isTasker = user?.role === 'TASKER' || user?.role === 'BOTH';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 80,
          backgroundColor: '#FFFFFF',
          borderTopColor: '#DCEAF1',
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="home-outline" focused={focused} label="Início" />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          href: isTasker ? '/(tabs)/feed' : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="search-outline" focused={focused} label="Buscar" />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          href: isTasker ? '/(tabs)/earnings' : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="wallet-outline" focused={focused} label="Ganhos" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person-outline" focused={focused} label="Perfil" />
          ),
        }}
      />
    </Tabs>
  );
}
