import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { HELP_FAQ, SUPPORT_EMAIL } from '@trampo/contracts';

const FAQ = HELP_FAQ;

export default function HelpScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Ajuda e suporte',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#041E42" />
            </Pressable>
          ),
        }}
      />

      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
        <Text className="font-display text-xl font-bold text-ink mb-1">
          Perguntas frequentes
        </Text>
        <Text className="text-ink-muted mb-6">Tire suas dúvidas sobre o TRAMPO</Text>

        {FAQ.map((item, i) => (
          <View
            key={i}
            className="bg-surface rounded-card border border-border p-4 mb-3"
          >
            <Text className="font-bold text-ink mb-2">{item.q}</Text>
            <Text className="text-ink-soft text-sm leading-5">{item.a}</Text>
          </View>
        ))}

        {/* Contact */}
        <View className="bg-accent/5 rounded-card border border-accent/20 p-5 mt-4">
          <Text className="font-bold text-ink mb-1">Ainda precisa de ajuda?</Text>
          <Text className="text-ink-muted text-sm mb-4">
            Nossa equipe responde em até 24 horas.
          </Text>
          <Pressable
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            className="bg-accent py-4 rounded-button items-center flex-row justify-center"
          >
            <Ionicons name="mail-outline" size={20} color="#fff" />
            <Text className="text-white font-bold ml-2">Falar com o suporte</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
