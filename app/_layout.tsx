import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  configureNotificationHandling,
  logPushDiagnostics,
  registerForPushNotifications,
  routeForNotification,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DancingScript_400Regular, DancingScript_700Bold } from '@expo-google-fonts/dancing-script';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const VALID_SEGMENTS = new Set(['(tabs)', 'login', 'homework', 'attendance', 'results', 'lesson', 'quizzes', 'legal', 'account']);

function AuthGate() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const first = segments[0] as string | undefined;
    if (loading || !first) return;
    const inTabs = first === '(tabs)';
    if (!user && inTabs) {
      router.replace('/login');
    } else if (user && !inTabs && !VALID_SEGMENTS.has(first)) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  return null;
}

function RootLayoutNav() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const router = useRouter();

  // Foreground presentation + Android channel. Runs once.
  useEffect(() => {
    configureNotificationHandling();
  }, []);

  // Register the device token for the signed-in account. The token is stored
  // server-side through the set_push_token() RPC (the profiles table is not
  // writable by clients) and is never printed to the console.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;

    (async () => {
      const token = await registerForPushNotifications();
      // Development builds print a full report (including the token, so it can be
      // pasted into expo.dev/notifications); release builds print nothing, because
      // a token identifies a device. See docs/notifications.md §0.
      if (__DEV__) await logPushDiagnostics(token);
      if (!token || cancelled) return;
      await supabase.rpc('set_push_token', { p_token: token });
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Tapping a notification opens the screen it belongs to.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let subscription: { remove: () => void } | undefined;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        subscription = Notifications.addNotificationResponseReceivedListener(response => {
          const target = routeForNotification(response.notification.request.content.data);
          if (target) router.push(target as never);
        });
      } catch {
        // expo-notifications unavailable (web / Expo Go): nothing to route.
      }
    })();

    return () => subscription?.remove();
  }, [router]);

  return (
    <>
      {/* Readable clock and battery in both appearances. */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="homework" options={{ presentation: 'card' }} />
        <Stack.Screen name="attendance" options={{ presentation: 'card' }} />
        <Stack.Screen name="results" options={{ presentation: 'card' }} />
        <Stack.Screen name="lesson/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="quizzes" />
        <Stack.Screen name="legal" options={{ presentation: 'card' }} />
        <Stack.Screen name="account" options={{ presentation: 'card' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    DancingScript_400Regular,
    DancingScript_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      {/* The theme sits above the error boundary: the fallback screen is themed too. */}
      <ThemeProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppProvider>
                <GestureHandlerRootView>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </AppProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
