import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { trpc } from '../../lib/trpc';
import { photos } from '../../theme/photos';
import { colors, shadow } from '../../theme/tokens';

/** Banner art is landscape, ~2.4:1 (e.g. 1200×500). */
const RATIO = 2.4;
const AUTOPLAY_MS = 5000;

type Banner = { id: string; advertiser: string; title: string; imageUrl: string; linkUrl: string | null };

/**
 * Advertiser carousel at the top of the home. Auto-advances, pauses while the
 * user is touching it, and records taps. When no campaign is on air it shows
 * Trampo's own "Anuncie aqui" slot so the space is never empty.
 */
export function AdBannerCarousel({ horizontalPadding = 20 }: { horizontalPadding?: number }) {
  const { width: screen } = useWindowDimensions();
  const width = screen - horizontalPadding * 2;
  const height = Math.round(width / RATIO);

  const { data, isLoading } = trpc.banners.list.useQuery(undefined, { staleTime: 5 * 60_000 });
  const click = trpc.banners.click.useMutation();
  const banners: Banner[] = data ?? [];

  const ref = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const touching = useRef(false);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => {
      if (touching.current) return;
      setPage((p) => {
        const next = (p + 1) % banners.length;
        ref.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [banners.length, width]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
    touching.current = false;
  };

  const open = (b: Banner) => {
    click.mutate({ id: b.id });
    if (b.linkUrl) Linking.openURL(b.linkUrl).catch(() => {});
  };

  if (isLoading) {
    return <View style={{ width, height, borderRadius: 20, backgroundColor: colors.hairline }} />;
  }

  if (banners.length === 0) return <HouseBanner width={width} height={height} />;

  return (
    <Animated.View entering={FadeIn.duration(400)}>
      <View style={{ width, height, borderRadius: 20, overflow: 'hidden', ...shadow.card }}>
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={() => (touching.current = true)}
          onMomentumScrollEnd={onMomentumEnd}
        >
          {banners.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => open(b)}
              accessibilityRole={b.linkUrl ? 'link' : 'image'}
              accessibilityLabel={`Anúncio de ${b.advertiser}: ${b.title}`}
              style={{ width, height }}
            >
              <Image source={{ uri: b.imageUrl }} contentFit="cover" transition={250} style={{ width, height }} accessibilityIgnoresInvertColors />
              <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(4,30,66,0.72)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3 }}>Patrocinado</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {banners.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
          {banners.map((b, i) => (
            <View key={b.id} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 3, marginHorizontal: 3, backgroundColor: i === page ? colors.orange : colors.hairline }} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

/** Fallback slot while no advertiser campaign is live. */
function HouseBanner({ width, height }: { width: number; height: number }) {
  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      accessible
      accessibilityLabel="Espaço publicitário: anuncie sua marca no Trampo"
      style={{ width, height, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.navy, ...shadow.card }}
    >
      <Image source={photos.drill} contentFit="cover" contentPosition="top" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '46%', opacity: 0.6 }} accessibilityIgnoresInvertColors />
      <View style={{ flex: 1, padding: 16, justifyContent: 'center', width: '64%' }}>
        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.orange, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
          <Ionicons name="megaphone" size={11} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '800', marginLeft: 4 }}>ESPAÇO PUBLICITÁRIO</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 8, lineHeight: 21 }}>Sua marca aqui</Text>
        <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12.5, marginTop: 2 }}>Anuncie para quem contrata serviços na sua região.</Text>
      </View>
    </Animated.View>
  );
}
