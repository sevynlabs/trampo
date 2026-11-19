import '../global.css';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { trpc, createTRPCClient, setOnSessionExpired } from '../src/lib/trpc';
import { UpdateGate } from '../src/components/UpdateGate';

// API URL - use environment variable in production
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function RootLayout() {
  // Rounded heavy face used by the TRAMPO wordmark (falls back to system until loaded)
  useFonts({ Nunito_800ExtraBold, Nunito_900Black });
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => createTRPCClient(API_URL));

  // Session could not be renewed: drop cached user data and go to the start
  useEffect(() => {
    setOnSessionExpired(() => {
      queryClient.clear();
      router.replace('/');
    });
  }, [queryClient]);

  return (
    <SafeAreaProvider>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <UpdateGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#F5F8FC' },
            }}
          />
        </UpdateGate>
      </QueryClientProvider>
    </trpc.Provider>
    </SafeAreaProvider>
  );
}
