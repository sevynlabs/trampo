import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LEGAL_LAST_UPDATED, PRIVACY_SECTIONS } from '@trampo/contracts';

const LAST_UPDATED = LEGAL_LAST_UPDATED;
const SECTIONS = PRIVACY_SECTIONS;

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Política de privacidade',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#041E42" />
            </Pressable>
          ),
        }}
      />

      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
        <Text className="text-ink-muted text-sm mb-6">
          Última atualização: {LAST_UPDATED}
        </Text>

        {SECTIONS.map((s, i) => (
          <View key={i} className="mb-6">
            <Text className="font-bold text-ink mb-2">{s.title}</Text>
            <Text className="text-ink-soft text-sm leading-6">{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </>
  );
}
