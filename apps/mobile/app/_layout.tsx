import '../global.css';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { trpc, createTRPCClient, setOnSessionExpired } from '../src/lib/trpc';

// API URL - use environment variable in production
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function RootLayout() {
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
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F5F8FC' },
          }}
        />
      </QueryClientProvider>
    </trpc.Provider>
    </SafeAreaProvider>
  );
}
