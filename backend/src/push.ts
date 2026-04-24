import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

export async function sendPushNotification(pushToken: string | null | undefined, title: string, body: string, data?: Record<string, any>) {
  if (!pushToken) return;
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const messages: ExpoPushMessage[] = [{
    to: pushToken,
    sound: 'default',
    title,
    body,
    data: data || {},
  }];

  try {
    const chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (error) {
    console.error('Error sending push notification', error);
  }
}
