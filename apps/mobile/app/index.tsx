import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';

export default function Index() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-6">
      {/* Logo */}
      <Text className="font-display text-4xl font-extrabold text-ink mb-2">
        TRAMPO<Text className="text-accent">.</Text>
      </Text>
      <Text className="text-ink-muted text-center mb-12">
        Encontre quem resolve, ou resolva e ganhe.
      </Text>

      {/* CTA */}
      <Link href="/(auth)/phone" asChild>
        <Pressable className="w-full bg-accent py-4 rounded-button items-center">
          <Text className="text-white font-bold text-base">Entrar com celular</Text>
        </Pressable>
      </Link>

      {/* Terms */}
      <Text className="text-ink-faint text-xs text-center mt-6 px-4">
        Ao continuar, você concorda com os Termos de Uso e Política de Privacidade
      </Text>
    </View>
  );
}
