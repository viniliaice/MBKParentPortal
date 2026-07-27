import { Stack } from 'expo-router';

export default function QuizzesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="results" options={{ presentation: 'card' }} />
      <Stack.Screen name="history" options={{ presentation: 'card' }} />
    </Stack>
  );
}
