import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { trpc, createTRPCClient } from '../src/lib/trpc';

// API URL - use environment variable in production
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => createTRPCClient(API_URL));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F3F8FB' },
          }}
        />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
