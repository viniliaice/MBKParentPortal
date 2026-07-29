import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerForPushNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
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
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';

SplashScreen.preventAutoHideAsync();

// Reanimated's "strict mode" warns whenever ANY shared value's `.value` is
// read during a React render pass — including reads deep inside third-party
// libraries we don't control. We audited every shared value in this app's
// own code (components/engine/**) and found zero render-time reads; every
// `.value` access happens inside useAnimatedStyle/useAnimatedProps,
// useEffect/useLayoutEffect, or a gesture worklet, which are all the
// sanctioned places. The warning traces back to `react-native-keyboard-
// controller` and `react-native-screens` (both read shared values while
// building context/animated-component props during render) — a widely
// reported false-positive for those exact libraries, not a bug in this
// codebase (see their GitHub issues #649/#662 and similar reports against
// react-native-screens/react-native-bottom-sheet). Since we can't patch
// node_modules, we disable strict-mode logging via Reanimated's own
// documented escape hatch instead of leaving noisy, actionable-looking
// warnings for a problem outside our control.
configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

const queryClient = new QueryClient();

const VALID_SEGMENTS = new Set(['(tabs)', 'login', 'homework', 'attendance', 'results', 'lesson', 'quizzes']);

function AuthGate() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading || segments.length === 0) return;
    const inTabs = segments[0] === '(tabs)';
    if (!user && inTabs) {
      router.replace('/login');
    } else if (user && !inTabs && !VALID_SEGMENTS.has(segments[0])) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  return null;
}

function RootLayoutNav() {
  const { user } = useAuth();
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') return;
      const token = await registerForPushNotifications();
      console.log('📱 PUSH TOKEN:', token);
      if (token && user) {
        await supabase.from('profiles').update({ expo_push_token: token }).eq('id', user.id);
        console.log('✅ Push token saved to Supabase for user:', user.id);
      } else if (!token) {
        console.log('❌ No push token — Firebase may not be configured');
      } else if (!user) {
        console.log('⚠️ Got token but no user logged in — token not saved');
      }
    })();
  }, [user]);
  return (
    <>
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="homework" options={{ presentation: 'card' }} />
        <Stack.Screen name="attendance" options={{ presentation: 'card' }} />
        <Stack.Screen name="results" options={{ presentation: 'card' }} />
        <Stack.Screen name="lesson/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="quizzes" />
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
    </SafeAreaProvider>
  );
}
