import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeInUp,
  SharedValue,
  ZoomIn,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { getRefreshToken } from '../src/lib/trpc';
import { Logo, LogoMark, FloatingHero, Button, AnimatedIntro, colors } from '../src/components/ds';
import type { FloatingItem } from '../src/components/ds';
import { photos } from '../src/theme/photos';

const SLIDES: { image: number; title: string; highlight: string; text: string; items: FloatingItem[] }[] = [
  {
    image: photos.heroCrossedArms,
    title: 'Contrate\nprofissionais',
    highlight: 'com confiança',
    text: 'Encontre prestadores avaliados perto de você, de forma rápida e segura.',
    items: [
      { kind: 'icon', icon: 'construct', tone: 'white' },
      { kind: 'chip', icon: 'flash', label: 'Rápido' },
      { kind: 'icon', icon: 'water', tone: 'sky' },
      { kind: 'chip', icon: 'shield-checkmark', label: 'Seguro' },
      { kind: 'icon', icon: 'color-palette', tone: 'white' },
      { kind: 'chip', icon: 'location', label: 'Local' },
      { kind: 'icon', icon: 'star', tone: 'orange' },
    ],
  },
  {
    image: photos.cleaning,
    title: 'Ofereça\nseus serviços',
    highlight: 'e ganhe mais',
    text: 'Divulgue o seu trabalho, receba solicitações e aumente sua renda.',
    items: [
      { kind: 'icon', icon: 'cash', tone: 'orange' },
      { kind: 'chip', icon: 'trending-up', label: '+ Clientes' },
      { kind: 'icon', icon: 'calendar', tone: 'white' },
      { kind: 'icon', icon: 'sparkles', tone: 'sky' },
      { kind: 'chip', icon: 'star', label: '4,9' },
      { kind: 'icon', icon: 'briefcase', tone: 'navy' },
    ],
  },
  {
    image: photos.construction,
    title: 'Tudo no\nmesmo lugar',
    highlight: '',
    text: 'Serviços, pagamentos via Pix, chat, avaliações e suporte completo.',
    items: [
      { kind: 'icon', icon: 'chatbubble-ellipses', tone: 'white' },
      { kind: 'chip', icon: 'qr-code', label: 'Pix' },
      { kind: 'icon', icon: 'star', tone: 'orange' },
      { kind: 'icon', icon: 'headset', tone: 'navy' },
      { kind: 'chip', icon: 'shield-checkmark', label: 'Garantia' },
      { kind: 'icon', icon: 'notifications', tone: 'sky' },
    ],
  },
];

/** Splash (logo) → onboarding (3 animated slides) for signed-out users. */
export default function Index() {
  const [session, setSession] = useState<'checking' | 'signed-in' | 'signed-out'>('checking');
  const [splashDone, setSplashDone] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    getRefreshToken()
      .then((token) => setSession(token ? 'signed-in' : 'signed-out'))
      .catch(() => setSession('signed-out'));
    // Let the logo animation play before moving on.
    const t = setTimeout(() => setSplashDone(true), 1400);
    return () => clearTimeout(t);
  }, []);

  if (session === 'signed-in' && splashDone) return <Redirect href="/(tabs)/home" />;
  if (session === 'signed-in' || session === 'checking') return <Splash />;
  // Signed out: full opening animation (3D pin → smoke → logo), then the onboarding
  if (!introDone) return <AnimatedIntro onFinish={() => setIntroDone(true)} />;
  return <Onboarding />;
}

function Splash() {
  const { width } = useWindowDimensions();
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <StatusBar style="dark" />
      <Animated.View entering={ZoomIn.springify().damping(10)}>
        <LogoMark size={78} />
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(450).duration(500)} style={{ marginTop: 28 }}>
        <Logo size={56} maxWidth={width - 64} />
      </Animated.View>
    </View>
  );
}

function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollX = useSharedValue(0);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;
  const heroHeight = Math.min(400, Math.max(300, height * 0.44));

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
    onMomentumEnd: (e) => {
      runOnJS(setPage)(Math.round(e.contentOffset.x / width));
    },
  });

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };
  const login = () => router.push('/(auth)/phone');

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar style="dark" />
      <Animated.View entering={FadeInDown.duration(600)} style={{ paddingTop: insets.top + 18, alignItems: 'center', paddingHorizontal: 32 }}>
        <Logo size={44} maxWidth={width - 64} />
      </Animated.View>

      <Animated.ScrollView
        // Reanimated 4 types Animated.ScrollView's ref as `never` with RN 0.88; the instance is a plain ScrollView.
        ref={scrollRef as never}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={s.title} style={{ width, paddingTop: 16 }}>
            <FloatingHero image={s.image} items={s.items} width={width} height={heroHeight} index={i} scrollX={scrollX} />
            <SlideText slide={s} index={i} width={width} scrollX={scrollX} />
          </View>
        ))}
      </Animated.ScrollView>

      <Animated.View entering={FadeInUp.delay(300).duration(500)} style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20 }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}
          accessibilityRole="adjustable"
          accessibilityLabel={`Página ${page + 1} de ${SLIDES.length}`}
        >
          {SLIDES.map((_, i) => (
            <Dot key={i} index={i} width={width} scrollX={scrollX} />
          ))}
        </View>

        {last ? (
          <Animated.View key="last" entering={FadeIn.duration(350)}>
            <Button label="Começar agora" iconRight="arrow-forward" onPress={login} />
            <Button label="Já tenho uma conta" variant="outline" onPress={login} style={{ marginTop: 12 }} />
          </Animated.View>
        ) : (
          <Animated.View key="next" entering={FadeIn.duration(350)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => goTo(SLIDES.length - 1)} hitSlop={10} accessibilityRole="button">
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.inkMuted }}>Pular</Text>
            </Pressable>
            <Button label="Próximo" iconRight="arrow-forward" size="md" onPress={() => goTo(page + 1)} />
          </Animated.View>
        )}
        <Text style={{ textAlign: 'center', fontSize: 11.5, color: colors.inkFaint, marginTop: 14, lineHeight: 16 }}>
          Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade
        </Text>
      </Animated.View>
    </View>
  );
}

function SlideText({
  slide,
  index,
  width,
  scrollX,
}: {
  slide: (typeof SLIDES)[number];
  index: number;
  width: number;
  scrollX: SharedValue<number>;
}) {
  const range = [(index - 1) * width, index * width, (index + 1) * width];
  const title = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollX.value, range, [26, 0, 26], Extrapolation.CLAMP) }],
  }));
  const body = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollX.value, range, [44, 0, 44], Extrapolation.CLAMP) }],
  }));
  return (
    <View style={{ paddingHorizontal: 28, marginTop: 10 }}>
      <Animated.Text style={[{ fontSize: 30, lineHeight: 34, fontWeight: '900', color: colors.ink, letterSpacing: -0.8 }, title]}>
        {slide.title}
        {slide.highlight ? <Text style={{ color: colors.orange }}>{`\n${slide.highlight}`}</Text> : null}
      </Animated.Text>
      <Animated.Text style={[{ fontSize: 15.5, lineHeight: 22, color: colors.inkSoft, marginTop: 12 }, body]}>{slide.text}</Animated.Text>
    </View>
  );
}

function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = scrollX.value / width;
    const active = interpolate(Math.abs(p - index), [0, 1], [1, 0], Extrapolation.CLAMP);
    return {
      width: 8 + 16 * active,
      opacity: 0.45 + 0.55 * active,
      backgroundColor: active > 0.5 ? colors.orange : colors.hairline,
    };
  });
  return <Animated.View style={[{ height: 8, borderRadius: 4, marginHorizontal: 4 }, style]} />;
}
