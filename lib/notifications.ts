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
 * server.
 *
 * It fails *silently* by design, which is right for families and painful when
 * push does not work — use `logPushDiagnostics()` below, which reports the reason.
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
 * Console output that must never reach a release build.
 *
 * A push token identifies a physical device, so printing one in production was an
 * audit finding. Everything this module logs goes through here, so the guard
 * cannot be forgotten at a call site.
 */
function devLog(message: string) {
  if (__DEV__) {
    console.log(message);
  }
}

/**
 * Explains, in order, why push registration succeeded or failed — and prints the
 * token so it can be pasted into https://expo.dev/notifications to test delivery
 * without the database trigger.
 *
 * Development builds only: `devLog` drops the report when `__DEV__` is false. The
 * value is still returned, so a debug screen can show it without any logging.
 *
 * Pass the token the caller already obtained to avoid asking for it twice; pass
 * nothing after a failure, and this asks again to capture the platform's own
 * error message, which is the part that names the real cause.
 */
export async function logPushDiagnostics(knownToken?: string | null): Promise<string> {
  const Notifications = await getExpoNotifications();
  const Device = await getExpoDevice();
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;

  const lines: string[] = [
    `platform: ${Platform.OS}`,
    `expo-notifications: ${Notifications ? 'loaded' : 'NOT AVAILABLE'}`,
    `expo-device: ${Device ? 'loaded' : 'NOT AVAILABLE'}`,
    Device
      ? `physical device: ${Device.isDevice}${Device.isDevice ? '' : ' — an emulator/simulator cannot receive remote push'}`
      : 'physical device: unknown',
    // storeClient means Expo Go, which cannot receive Android remote push at all.
    `execution environment: ${Constants.executionEnvironment}${
      Constants.executionEnvironment === 'storeClient'
        ? ' — this is Expo Go, which cannot receive remote push; use a development build'
        : ''
    }`,
    `EAS projectId: ${projectId ?? 'MISSING — set expo.extra.eas.projectId in app.json'}`,
  ];

  if (Notifications) {
    const { status } = await Notifications.getPermissionsAsync();
    lines.push(`permission: ${status}`);
  }

  if (knownToken) {
    lines.push(`token: ${knownToken}`);
    lines.push('-> paste that token at https://expo.dev/notifications to test delivery');
  } else if (Notifications && Device?.isDevice) {
    try {
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      lines.push(`token: ${token.data}`);
      lines.push('-> paste that token at https://expo.dev/notifications to test delivery');
    } catch (error) {
      lines.push(`token FAILED: ${error instanceof Error ? error.message : String(error)}`);
      lines.push(
        '-> usual causes: google-services.json missing or naming another package, '
        + 'no FCM V1 service-account key on the EAS project, Expo Go, or an emulator',
      );
    }
  } else {
    lines.push('token: not attempted (no device permission or the module is unavailable)');
  }

  const report = lines.join('\n');
  devLog(`[push] diagnostics\n${report}`);
  return report;
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
