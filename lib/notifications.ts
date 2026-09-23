import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Android shows a small monochrome icon in the status bar. The default channel
 * is created once with the same identifier the expo-notifications config plugin
 * registers, so server-sent FCM messages land in our channel (and therefore use
 * our icon/colour) instead of an unnamed fallback channel.
 */
export const DEFAULT_CHANNEL_ID = 'default';

async function getExpoNotifications() {
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

async function getExpoDevice() {
  try {
    return await import('expo-device');
  } catch {
    return null;
  }
}

/**
 * Foreground presentation rules. Without a handler, notifications that arrive
 * while the app is open are not shown at all.
 */
export async function configureNotificationHandling() {
  const Notifications = await getExpoNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: 'School updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

/**
 * Registers the device for push and returns the Expo push token, or null when
 * push is unavailable (simulator, denied permission, Expo Go, no credentials).
 * The caller is responsible for handing the token to `set_push_token()` on the
 * server; tokens are never logged.
 */
export async function registerForPushNotifications() {
  const Notifications = await getExpoNotifications();
  const Device = await getExpoDevice();
  if (!Notifications || !Device) return null;

  // Permission is only requested on a real device: a simulator cannot receive
  // remote notifications and the prompt would be pointless.
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: 'School updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({ projectId: projectId ?? undefined });
    return token.data;
  } catch {
    // Expected in Expo Go and in builds without FCM credentials.
    return null;
  }
}

/**
 * Where a tapped notification should take the user. The payload shapes come
 * from supabase/functions/send-notification.
 */
export function routeForNotification(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as { type?: string };
  switch (payload.type) {
    case 'new_message':
      return '/(tabs)/messages';
    case 'new_announcement':
      return '/(tabs)';
    default:
      return null;
  }
}

export async function scheduleHomeworkReminder(homeworkTitle: string, dueDate: Date, minutesBefore: number = 1440) {
  const Notifications = await getExpoNotifications();
  if (!Notifications) return;

  const triggerDate = new Date(dueDate.getTime() - minutesBefore * 60 * 1000);
  if (triggerDate <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Homework Reminder',
      body: `"${homeworkTitle}" is due soon!`,
      sound: true,
    },
    trigger: { date: triggerDate, type: Notifications.SchedulableTriggerInputTypes.DATE },
  });
}

export async function cancelAllHomeworkReminders() {
  const Notifications = await getExpoNotifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
