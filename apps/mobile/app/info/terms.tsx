import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const LAST_UPDATED = 'Junho de 2026';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Sobre o TRAMPO',
    body: 'O TRAMPO é uma plataforma que conecta pessoas que precisam de serviços (clientes) a profissionais autônomos (taskers) na região do Triângulo Mineiro. O TRAMPO atua apenas como intermediário e não é prestador dos serviços anunciados.',
  },
  {
    title: '2. Cadastro e conta',
    body: 'Para usar o TRAMPO você deve ter 18 anos ou mais e fornecer informações verdadeiras, incluindo telefone e CPF. Você é responsável por manter a segurança da sua conta e por toda atividade realizada nela.',
  },
  {
    title: '3. Trampos e pagamentos',
    body: 'O valor de cada trampo é definido na criação e calculado pela plataforma. O cliente paga via Pix e o valor fica retido em garantia (escrow). A taxa de serviço ao cliente é de 5% e a comissão do profissional é de 15%. Trampos urgentes têm acréscimo de 30%. O valor é liberado ao profissional 1 hora após a conclusão.',
  },
  {
    title: '4. Cancelamentos',
    body: 'O cancelamento é gratuito até 30 minutos antes do horário agendado. Após esse prazo, poderá ser aplicada uma taxa de cancelamento de 20% do valor do trampo.',
  },
  {
    title: '5. Disputas',
    body: 'Caso haja problema com um serviço, qualquer das partes pode abrir uma disputa pelo aplicativo. O pagamento permanece retido até que a equipe do TRAMPO analise e resolva o caso, liberando o valor ao profissional ou reembolsando o cliente.',
  },
  {
    title: '6. Conduta',
    body: 'É proibido usar a plataforma para fins ilícitos, assediar outros usuários, contornar o sistema de pagamento ou anunciar serviços que violem a lei. Contas que descumprirem estes termos podem ser suspensas ou removidas.',
  },
  {
    title: '7. Limitação de responsabilidade',
    body: 'O TRAMPO não se responsabiliza pela qualidade, segurança ou legalidade dos serviços prestados entre usuários. A relação de serviço é estabelecida diretamente entre cliente e profissional.',
  },
  {
    title: '8. Alterações',
    body: 'Estes termos podem ser atualizados periodicamente. Mudanças relevantes serão comunicadas no aplicativo. O uso contínuo da plataforma após alterações implica aceitação dos novos termos.',
  },
];

export default function TermsScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Termos de uso',
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
