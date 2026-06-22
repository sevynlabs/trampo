import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const SUPPORT_EMAIL = 'suporte@trampo.app';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Como funciona o pagamento?',
    a: 'O pagamento é feito via Pix quando um profissional aceita seu trampo. O valor fica protegido (em garantia) e só é liberado ao profissional 1 hora após a conclusão do serviço.',
  },
  {
    q: 'Quais são as taxas?',
    a: 'O cliente paga uma taxa de serviço de 5%. O profissional recebe o valor do trampo com desconto de 15% de comissão. Trampos urgentes (menos de 1h) têm acréscimo de 30%.',
  },
  {
    q: 'Posso cancelar um trampo?',
    a: 'Sim. O cancelamento é gratuito até 30 minutos antes do horário agendado. Após isso, pode haver uma taxa de cancelamento de 20%.',
  },
  {
    q: 'E se algo der errado com o serviço?',
    a: 'Você pode abrir uma disputa pela tela do trampo enquanto ele estiver em andamento ou concluído. O pagamento fica retido até nossa equipe analisar e resolver o caso.',
  },
  {
    q: 'Como recebo como profissional?',
    a: 'Após concluir um trampo, o valor entra em garantia e é liberado automaticamente para sua carteira 1 hora depois. Você acompanha tudo na aba Ganhos.',
  },
];

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
              <Ionicons name="arrow-back" size={24} color="#001B48" />
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
