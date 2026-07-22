import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

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

export async function registerForPushNotifications() {
  const ExpoNotifications = await getExpoNotifications();
  const ExpoDevice = await getExpoDevice();
  if (!ExpoNotifications || !ExpoDevice) {
    console.log('Push notifications not available (expo-notifications or expo-device not loaded)');
    return null;
  }

  if (Platform.OS === 'android') {
    await ExpoNotifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: ExpoNotifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const permResult = await ExpoNotifications.getPermissionsAsync();
  const existingStatus = (permResult as any).status;
  let finalStatus: string = existingStatus;
  if (existingStatus !== 'granted') {
    const reqResult = await ExpoNotifications.requestPermissionsAsync();
    finalStatus = (reqResult as any).status;
  }
  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = (await ExpoNotifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    })).data;
    return token;
  } catch (err) {
    console.log('Failed to get push token (expected in Expo Go):', (err as Error).message);
    return null;
  }
}

export async function scheduleHomeworkReminder(homeworkTitle: string, dueDate: Date, minutesBefore: number = 1440) {
  const ExpoNotifications = await getExpoNotifications();
  if (!ExpoNotifications) return;

  const triggerDate = new Date(dueDate.getTime() - minutesBefore * 60 * 1000);
  if (triggerDate <= new Date()) return;

  await ExpoNotifications.scheduleNotificationAsync({
    content: {
      title: 'Homework Reminder',
      body: `"${homeworkTitle}" is due soon!`,
      sound: true,
    },
    trigger: { date: triggerDate, type: (ExpoNotifications as any).SchedulableTriggerInputTypes.DATE },
  });
}

export async function cancelAllHomeworkReminders() {
  const ExpoNotifications = await getExpoNotifications();
  if (!ExpoNotifications) return;
  await ExpoNotifications.cancelAllScheduledNotificationsAsync();
}
