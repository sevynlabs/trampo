import { ReactNode } from 'react';
import { View, Text, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { usePlatformConfig } from '../lib/platform-config';
import { Logo, Button, colors } from './ds';

/** Compare "1.2.10" vs "1.3.0" → negative when a < b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const ANDROID_PACKAGE = 'com.sevynlabs.trampo';

function storeUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as { iosStoreUrl?: string };
  if (Platform.OS === 'ios') return extra.iosStoreUrl || 'https://apps.apple.com/br/search?term=trampo';
  return `market://details?id=${ANDROID_PACKAGE}`;
}

/**
 * Blocks the app with an "update the app" screen when the installed version
 * is older than the minimum set in the admin panel (Configurações → Versão
 * mínima). Used only for breaking changes; normal releases never block.
 */
export function UpdateGate({ children }: { children: ReactNode }) {
  const { minAppVersion } = usePlatformConfig();
  const current = Constants.expoConfig?.version ?? '0.0.0';
  if (!minAppVersion || compareVersions(current, minAppVersion) >= 0) return <>{children}</>;

  const open = () =>
    Linking.openURL(storeUrl()).catch(() => Linking.openURL(`https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`));

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 }}>
      <Logo size={48} maxWidth={260} />
      <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink, textAlign: 'center', marginTop: 12 }}>Atualize o Trampo</Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: colors.inkSoft, textAlign: 'center' }}>
        Esta versão do app ({current}) não é mais compatível. Baixe a versão nova na loja para continuar.
      </Text>
      <Button label={Platform.OS === 'ios' ? 'Abrir a App Store' : 'Abrir o Google Play'} icon="download-outline" onPress={open} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}
