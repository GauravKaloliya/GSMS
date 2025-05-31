import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { getToken, savePushToken } from './apiClient';

export default function useAuthNotifications() {
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    async function init() {
      const token = await getToken();
      if (!token) {
        router.replace('/signin');
        return;
      }

      notificationListener.current = Notifications.addNotificationReceivedListener(
        notification => {
          Alert.alert(
            notification.request.content.title ?? 'Notification',
            notification.request.content.body ?? ''
          );
        }
      );

      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        response => {
          console.log('User interacted with notification:', response);
        }
      );

      await registerForPushNotifications();
    }

    init();

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}

async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) {
    Alert.alert('Must use physical device for Push Notifications');
    return;
  }
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    Alert.alert('Failed to get push token permissions!');
    return;
  }
  const pushTokenData = await Notifications.getExpoPushTokenAsync();
  const pushToken = pushTokenData.data;

  try {
    await savePushToken(pushToken, Platform.OS);
    console.log('Push token saved:', pushToken);
  } catch (error) {
    console.warn('Failed to save push token:', error);
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
}