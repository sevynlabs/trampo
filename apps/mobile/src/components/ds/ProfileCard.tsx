import { useRef, useState } from 'react';
import { View, Text, Modal, Pressable, Platform, Share, ScrollView, ActivityIndicator } from 'react-native';
import type { ViewInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo, LogoMark } from './Logo';
import { Avatar } from './primitives';
import { colors, shadow } from '../../theme/tokens';

export interface ProfileCardData {
  name: string | null;
  avatarUrl: string | null;
  publicCode: string;
  categories: { id: string; name: string }[];
  rating: number;
  reviewCount: number;
  totalTasks: number;
  kycVerified: boolean;
  bio: string | null;
  /** e.g. "2 anos" */
  timeOnPlatform: string;
}

const CARD_W = 330;

/**
 * Shareable "business card" with the Trampo identity. Deliberately has NO
 * contact data (phone, e-mail, address) — only the public in-app ID, so new
 * clients find the professional inside the app.
 */
export function ProfileBusinessCard({ data }: { data: ProfileCardData }) {
  const specialty = data.categories.map((c) => c.name).slice(0, 3).join(' · ');
  return (
    <View style={{ width: CARD_W, borderRadius: 28, overflow: 'hidden', backgroundColor: '#fff' }}>
      {/* Navy header with brand swoosh */}
      <View style={{ height: 132, backgroundColor: colors.navy, paddingHorizontal: 20, paddingTop: 18 }}>
        <Svg width={CARD_W} height={132} viewBox="0 0 330 132" style={{ position: 'absolute', left: 0, top: 0 }}>
          <Circle cx="300" cy="18" r="62" fill={colors.orange} opacity={0.16} />
          <Circle cx="18" cy="140" r="46" fill={colors.sky} opacity={0.14} />
          <Path d="M150 118 C 210 96, 270 98, 330 108" stroke={colors.orange} strokeWidth={6} strokeLinecap="round" fill="none" />
        </Svg>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <LogoMark size={22} />
          <View style={{ marginLeft: 8 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>CARTÃO DO PROFISSIONAL</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10.5, marginTop: 1 }}>Serviços sob demanda</Text>
          </View>
        </View>
      </View>

      {/* Identity */}
      <View style={{ alignItems: 'center', marginTop: -52, paddingHorizontal: 22 }}>
        <View style={{ borderWidth: 4, borderColor: '#fff', borderRadius: 60 }}>
          <Avatar name={data.name} uri={data.avatarUrl} size={96} verified={data.kycVerified} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink, marginTop: 8, textAlign: 'center' }} numberOfLines={2}>
          {data.name ?? 'Profissional'}
        </Text>
        {!!specialty && (
          <Text style={{ fontSize: 13.5, color: colors.inkSoft, marginTop: 2, textAlign: 'center' }} numberOfLines={2}>
            {specialty}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.orangeTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
            <Ionicons name="star" size={14} color={colors.star} />
            <Text style={{ marginLeft: 4, fontWeight: '800', color: colors.ink, fontSize: 13 }}>
              {data.rating > 0 ? data.rating.toFixed(1).replace('.', ',') : 'Novo'}
            </Text>
            {data.reviewCount > 0 && <Text style={{ marginLeft: 3, color: colors.inkMuted, fontSize: 12 }}>({data.reviewCount})</Text>}
          </View>
          {data.kycVerified && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E1F3FB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
              <Ionicons name="shield-checkmark" size={14} color={colors.sky} />
              <Text style={{ marginLeft: 4, fontWeight: '800', color: colors.sky, fontSize: 12 }}>Verificado</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.background }}>
        <CardStat value={String(data.totalTasks)} label="Serviços" />
        <View style={{ width: 1, backgroundColor: colors.hairline }} />
        <CardStat value={data.timeOnPlatform} label="no Trampo" />
        <View style={{ width: 1, backgroundColor: colors.hairline }} />
        <CardStat value={String(data.reviewCount)} label="Avaliações" />
      </View>

      {!!data.bio && (
        <Text style={{ marginHorizontal: 22, marginTop: 12, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft, textAlign: 'center' }} numberOfLines={3}>
          “{data.bio}”
        </Text>
      )}

      {/* Public ID — the only way to reach this professional */}
      <View style={{ marginHorizontal: 20, marginTop: 16, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.orange, backgroundColor: colors.orangeTint, paddingVertical: 12, alignItems: 'center' }}>
        <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, color: colors.orange }}>ID NO TRAMPO</Text>
        <Text style={{ fontSize: 30, fontWeight: '900', color: colors.navy, letterSpacing: 2, marginTop: 2 }}>{data.publicCode}</Text>
        <Text style={{ fontSize: 11.5, color: colors.inkMuted, marginTop: 2 }}>Busque este código no app para contratar</Text>
      </View>

      {/* Footer with the official logo */}
      <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 18, marginTop: 16, borderTopWidth: 1, borderTopColor: colors.hairline }}>
        <Logo size={30} />
      </View>
    </View>
  );
}

function CardStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.inkMuted, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

/**
 * Modal with the card preview and a "Compartilhar" action that exports the
 * card as a PNG (native share sheet). On web, falls back to sharing text.
 */
export function ProfileCardShare({ visible, onClose, data }: { visible: boolean; onClose: () => void; data: ProfileCardData }) {
  const insets = useSafeAreaInsets();
  // RN 0.88 types View as a function component; the ref is the host element.
  const cardRef = useRef<ViewInstance>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareText = `Conheça ${data.name ?? 'este profissional'} no Trampo! Busque o ID ${data.publicCode} no app.`;

  const share = async () => {
    setError(null);
    setBusy(true);
    try {
      if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
        const uri = await captureRef(cardRef as never, { format: 'png', quality: 1, result: 'tmpfile', width: 1080 });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Compartilhar cartão' });
      } else {
        await Share.share({ message: shareText });
      }
    } catch {
      setError('Não foi possível gerar a imagem. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(4,30,66,0.86)' }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            hitSlop={10}
            style={{ position: 'absolute', top: insets.top + 12, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>

          <Animated.Text entering={FadeIn.duration(300)} style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 }}>
            Cartão de visita
          </Animated.Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
            Sem telefone ou e-mail: quem receber encontra você pelo ID.
          </Text>

          <Animated.View entering={ZoomIn.springify().damping(14)} style={{ ...shadow.card }}>
            {/* collapsable=false so the native view exists for the snapshot */}
            <View ref={cardRef} collapsable={false} style={{ borderRadius: 28, backgroundColor: '#fff' }}>
              <ProfileBusinessCard data={data} />
            </View>
          </Animated.View>

          {error && <Text style={{ color: '#FFB4A0', marginTop: 12 }}>{error}</Text>}

          <Pressable
            onPress={share}
            disabled={busy}
            accessibilityRole="button"
            style={{ marginTop: 20, width: CARD_W, height: 54, borderRadius: 16, backgroundColor: colors.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.7 : 1, ...shadow.cta }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="share-social" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 8 }}>Compartilhar cartão</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
