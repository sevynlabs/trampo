/**
 * Legal texts shown in the app (Perfil → Termos/Privacidade/Ajuda) and on the
 * public website (/privacidade, /termos, /suporte, /excluir-conta) that the
 * App Store and Google Play link to. One source, so both always match.
 *
 * Review with a lawyer before launch (LGPD). Fees are dynamic (admin panel),
 * so the texts refer to "the values shown in the app" instead of numbers.
 */

export type LegalSection = { title: string; body: string };

export const LEGAL_LAST_UPDATED = 'Novembro de 2026';
export const SUPPORT_EMAIL = 'suporte@trampo.app';

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: 'Quem somos',
    body: 'O Trampo é uma plataforma que conecta pessoas que precisam de serviços a profissionais autônomos no Triângulo Mineiro (Uberlândia, Uberaba e Araguari). Esta política explica quais dados pessoais tratamos, para quê e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).',
  },
  {
    title: 'Quais dados coletamos',
    body: 'Cadastro: nome, telefone, CPF e, opcionalmente, e-mail e foto de perfil. Profissionais: categorias de serviço, cidade de atuação, chave Pix e documentos de verificação (documento com foto, selfie e, quando solicitado, certidão de antecedentes). Uso: pedidos criados ou realizados, mensagens do chat, avaliações, pagamentos e saques. Localização aproximada no momento do uso, para mostrar serviços próximos. Identificador do aparelho para envio de notificações.',
  },
  {
    title: 'Para que usamos',
    body: 'Para operar a plataforma (conectar clientes e profissionais, agendar e acompanhar serviços), processar pagamentos e repasses, verificar identidade e prevenir fraudes, enviar avisos sobre seus pedidos, dar suporte e cumprir obrigações legais e fiscais. Não vendemos seus dados pessoais e não os usamos para publicidade de terceiros.',
  },
  {
    title: 'Proteção do CPF e documentos',
    body: 'O CPF é armazenado criptografado e nunca é exibido a outros usuários. Documentos de verificação ficam em armazenamento privado e só são acessados pela equipe de análise por links temporários.',
  },
  {
    title: 'Com quem compartilhamos',
    body: 'Com a outra parte de um serviço, apenas o necessário para executá-lo (nome, foto e o endereço do serviço após o aceite). Com prestadores que operam a plataforma para nós: processamento de pagamentos Pix (Asaas), envio de SMS de verificação (Twilio), hospedagem e banco de dados (Supabase e provedores de nuvem), envio de notificações e e-mails. Com autoridades, quando exigido por lei.',
  },
  {
    title: 'Por quanto tempo guardamos',
    body: 'Enquanto sua conta estiver ativa. Ao excluir a conta, apagamos dados pessoais, documentos e fotos. Registros de pedidos e pagamentos são mantidos de forma anonimizada pelo prazo exigido pela legislação fiscal (LGPD, art. 16, I).',
  },
  {
    title: 'Seus direitos',
    body: 'Você pode pedir confirmação e acesso aos seus dados, correção, anonimização, portabilidade, informação sobre compartilhamento e exclusão. A exclusão da conta pode ser feita no próprio app em Perfil → Excluir conta. Para os demais pedidos, escreva para o e-mail de suporte.',
  },
  {
    title: 'Contato',
    body: `Dúvidas sobre privacidade e pedidos sobre seus dados: ${SUPPORT_EMAIL}.`,
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: '1. Sobre o Trampo',
    body: 'O Trampo é uma plataforma que conecta pessoas que precisam de serviços (clientes) a profissionais autônomos na região do Triângulo Mineiro. O Trampo atua apenas como intermediário e não é prestador dos serviços anunciados.',
  },
  {
    title: '2. Cadastro e conta',
    body: 'Para usar o Trampo você deve ter 18 anos ou mais e fornecer informações verdadeiras, incluindo telefone e CPF. Você é responsável pela segurança da sua conta e por toda atividade realizada nela. Profissionais passam por verificação de identidade antes de receber solicitações.',
  },
  {
    title: '3. Pedidos e pagamentos',
    body: 'O valor de cada pedido, a taxa de serviço do cliente, a comissão do profissional e o acréscimo de urgência são exibidos no app antes da confirmação. O cliente paga via Pix e o valor fica retido em garantia até a conclusão do serviço; depois disso é liberado ao profissional.',
  },
  {
    title: '4. Cancelamentos',
    body: 'O cancelamento é gratuito até 30 minutos antes do horário agendado. Depois desse prazo pode ser cobrada uma taxa de cancelamento, informada no app antes de confirmar.',
  },
  {
    title: '5. Disputas',
    body: 'Se houver problema com um serviço, qualquer das partes pode abrir uma disputa pelo app. O pagamento fica retido até a equipe do Trampo analisar o caso e decidir pela liberação ao profissional ou pelo reembolso ao cliente.',
  },
  {
    title: '6. Conduta',
    body: 'É proibido usar a plataforma para fins ilícitos, assediar outros usuários, combinar pagamento por fora para evitar as taxas ou anunciar serviços que violem a lei. Contas que descumprirem estes termos podem ser suspensas ou removidas.',
  },
  {
    title: '7. Responsabilidade',
    body: 'A relação de serviço é estabelecida diretamente entre cliente e profissional. O Trampo não se responsabiliza pela execução dos serviços, sem prejuízo dos direitos garantidos pelo Código de Defesa do Consumidor.',
  },
  {
    title: '8. Exclusão de conta',
    body: 'Você pode excluir sua conta a qualquer momento em Perfil → Excluir conta, desde que não haja serviço em andamento, saldo a sacar ou saque em processamento.',
  },
  {
    title: '9. Alterações',
    body: 'Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas no app. Continuar usando a plataforma depois da mudança significa aceitar os novos termos.',
  },
];

export const HELP_FAQ: { q: string; a: string }[] = [
  {
    q: 'Como funciona o pagamento?',
    a: 'O pagamento é feito via Pix depois que um profissional aceita o seu pedido. O valor fica protegido em garantia e só é liberado ao profissional depois da conclusão do serviço.',
  },
  {
    q: 'Quais são as taxas?',
    a: 'A taxa de serviço do cliente, a comissão do profissional e o acréscimo de urgência aparecem no app antes de você confirmar o pedido.',
  },
  {
    q: 'Posso cancelar um pedido?',
    a: 'Sim. O cancelamento é gratuito até 30 minutos antes do horário agendado. Depois disso pode haver taxa de cancelamento, mostrada antes de confirmar.',
  },
  {
    q: 'E se algo der errado com o serviço?',
    a: 'Abra uma disputa pela tela do pedido enquanto ele estiver em andamento ou concluído. O pagamento fica retido até nossa equipe analisar o caso.',
  },
  {
    q: 'Como recebo como profissional?',
    a: 'Depois de concluir o serviço, o valor entra em garantia e é liberado para o seu saldo. Você acompanha em Ganhos e faz o saque por Pix.',
  },
  {
    q: 'Como excluo minha conta?',
    a: 'No app, vá em Perfil → Excluir conta. Se não conseguir acessar o app, escreva para o e-mail de suporte a partir do telefone cadastrado.',
  },
];

export const DELETE_ACCOUNT_STEPS: string[] = [
  'Abra o app Trampo e entre com o seu número de celular.',
  'Toque em Perfil, na barra de baixo.',
  'Toque em Excluir conta.',
  'Leia o que será apagado, digite EXCLUIR e confirme.',
];
