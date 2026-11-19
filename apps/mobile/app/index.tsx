import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getRefreshToken } from '../src/lib/trpc';
import { Logo, BrandHero, Button, colors } from '../src/components/ds';

type IconName = keyof typeof Ionicons.glyphMap;

const SLIDES: { icon: IconName; title: string; highlight: string; text: string }[] = [
  {
    icon: 'people',
    title: 'Contrate\nprofissionais',
    highlight: 'com confiança',
    text: 'Encontre prestadores avaliados perto de você, de forma rápida e segura.',
  },
  {
    icon: 'hammer',
    title: 'Ofereça\nseus serviços',
    highlight: 'e ganhe mais',
    text: 'Divulgue o seu trabalho, receba solicitações e aumente sua renda.',
  },
  {
    icon: 'apps',
    title: 'Tudo no\nmesmo lugar',
    highlight: '',
    text: 'Serviços, pagamentos via Pix, chat, avaliações e suporte completo.',
  },
];

/** Splash (navy + logo) → onboarding (3 slides) for signed-out users. */
export default function Index() {
  const [session, setSession] = useState<'checking' | 'signed-in' | 'signed-out'>('checking');

  useEffect(() => {
    getRefreshToken()
      .then((token) => setSession(token ? 'signed-in' : 'signed-out'))
      .catch(() => setSession('signed-out'));
  }, []);

  if (session === 'signed-in') return <Redirect href="/(tabs)/home" />;
  if (session === 'checking') return <Splash />;
  return <Onboarding />;
}

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
      <StatusBar style="light" />
      <Animated.View entering={FadeIn.duration(500)}>
        <Logo size={64} tone="dark" />
      </Animated.View>
    </View>
  );
}

function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== page) setPage(i);
  };
  const login = () => router.push('/(auth)/phone');

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 20, alignItems: 'center' }}>
        <Logo size={46} />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={{ width, paddingTop: 12 }}>
            <BrandHero icon={s.icon} height={290} />
            <View style={{ paddingHorizontal: 28, marginTop: 18 }}>
              <Text style={{ fontSize: 30, lineHeight: 34, fontWeight: '900', color: colors.ink, letterSpacing: -0.8 }}>
                {s.title}
                {s.highlight ? <Text style={{ color: colors.orange }}>{`\n${s.highlight}`}</Text> : null}
              </Text>
              <Text style={{ fontSize: 15.5, lineHeight: 22, color: colors.inkSoft, marginTop: 12 }}>{s.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <Animated.View entering={FadeInUp.duration(500)} style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }} accessibilityRole="adjustable" accessibilityLabel={`Página ${page + 1} de ${SLIDES.length}`}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === page ? 22 : 8,
                height: 8,
                borderRadius: 4,
                marginHorizontal: 4,
                backgroundColor: i === page ? colors.orange : colors.hairline,
              }}
            />
          ))}
        </View>

        {last ? (
          <>
            <Button label="Começar agora" iconRight="arrow-forward" onPress={login} />
            <Button label="Já tenho uma conta" variant="outline" onPress={login} style={{ marginTop: 12 }} />
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => goTo(SLIDES.length - 1)} hitSlop={10} accessibilityRole="button">
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.inkMuted }}>Pular</Text>
            </Pressable>
            <Button label="Próximo" iconRight="arrow-forward" size="md" onPress={() => goTo(page + 1)} />
          </View>
        )}
        <Text style={{ textAlign: 'center', fontSize: 11.5, color: colors.inkFaint, marginTop: 14, lineHeight: 16 }}>
          Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade
        </Text>
      </Animated.View>
    </View>
  );
}
