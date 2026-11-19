import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const LAST_UPDATED = 'Junho de 2026';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Quais dados coletamos',
    body: 'Coletamos os dados que você fornece no cadastro (nome, telefone, CPF e, opcionalmente, e-mail), informações dos trampos que você cria ou realiza, sua localização (para mostrar trampos próximos) e documentos enviados para verificação de identidade (KYC).',
  },
  {
    title: 'Como usamos seus dados',
    body: 'Usamos seus dados para operar a plataforma: conectar clientes e profissionais, processar pagamentos, calcular distâncias no feed, verificar identidade, prevenir fraudes e dar suporte. Não vendemos seus dados pessoais.',
  },
  {
    title: 'Proteção do CPF e documentos',
    body: 'Seu CPF é armazenado de forma criptografada e nunca é exibido a outros usuários. Documentos de verificação (KYC) são guardados com segurança e acessados apenas por meio de links temporários, exclusivamente para verificação de identidade.',
  },
  {
    title: 'Pagamentos',
    body: 'Os pagamentos via Pix são processados pelo nosso parceiro de pagamentos (Asaas). Dados necessários para a cobrança e o repasse podem ser compartilhados com esse parceiro, que segue suas próprias políticas de privacidade e segurança.',
  },
  {
    title: 'Compartilhamento limitado',
    body: 'Compartilhamos com a outra parte de um trampo apenas o necessário para a execução do serviço (como nome e contato). Podemos compartilhar dados com autoridades quando exigido por lei.',
  },
  {
    title: 'Seus direitos',
    body: 'De acordo com a LGPD, você pode solicitar acesso, correção ou exclusão dos seus dados pessoais, bem como informações sobre o tratamento realizado. Para exercer esses direitos, entre em contato pelo suporte.',
  },
  {
    title: 'Retenção',
    body: 'Mantemos seus dados enquanto sua conta estiver ativa e pelo período necessário para cumprir obrigações legais, resolver disputas e fazer cumprir nossos acordos.',
  },
  {
    title: 'Contato',
    body: 'Dúvidas sobre privacidade podem ser enviadas para suporte@trampo.app.',
  },
];

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
