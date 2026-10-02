import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { GradientButton } from '../src/components/GradientButton';
import { getRefreshToken } from '../src/lib/trpc';

export default function Index() {
  const router = useRouter();
  const [session, setSession] = useState<'checking' | 'signed-in' | 'signed-out'>('checking');

  // Restore the session on cold start (the API client renews the access token)
  useEffect(() => {
    getRefreshToken()
      .then((token) => setSession(token ? 'signed-in' : 'signed-out'))
      .catch(() => setSession('signed-out'));
  }, []);

  if (session === 'signed-in') {
    return <Redirect href="/(tabs)/home" />;
  }

  if (session === 'checking') {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#018ABE" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <StatusBar style="dark" />
      <LinearGradient colors={['#FFFFFF', '#EAF3F8']} style={{ flex: 1 }}>
        <View className="flex-1 px-8 pt-24 pb-10">
          {/* Logo lockup, centered */}
          <View className="flex-1 items-center justify-center">
            <Animated.View entering={FadeIn.duration(700)}>
              <LinearGradient
                colors={['#018ABE', '#02457A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 104,
                  height: 104,
                  borderRadius: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#018ABE',
                  shadowOpacity: 0.45,
                  shadowRadius: 22,
                  shadowOffset: { width: 0, height: 12 },
                  elevation: 8,
                }}
              >
                <Text className="text-white font-display font-extrabold" style={{ fontSize: 60 }}>
                  T
                </Text>
              </LinearGradient>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(200).duration(700)} className="items-center">
              <Text
                className="font-display font-extrabold text-ink mt-7"
                style={{ fontSize: 52, letterSpacing: -1.5 }}
              >
                TRAMPO<Text style={{ color: '#018ABE' }}>.</Text>
              </Text>
              <Text
                className="text-ink-muted mt-3"
                style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' }}
              >
                Serviços sob demanda
              </Text>
            </Animated.View>
          </View>

          {/* CTA */}
          <Animated.View entering={FadeInUp.delay(400).duration(700)}>
            <GradientButton
              label="Entrar com celular"
              icon="phone-portrait-outline"
              onPress={() => router.push('/(auth)/phone')}
            />
            <Text className="text-center text-xs mt-4 text-ink-faint px-6 leading-5">
              Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade
            </Text>
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
}
