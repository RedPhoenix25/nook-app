import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

// Helper to determine if we are in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

export function usePushNotifications(userId: string | undefined) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || isExpoGo) return; // Don't run in Expo Go to avoid crash

    registerForPushNotificationsAsync().then(async (token) => {
      if (token) {
        setExpoPushToken(token);
        // Save to Supabase
        await supabase
          .from('profiles')
          .update({ expo_push_token: token })
          .eq('id', userId);
      }
    });

  }, [userId]);

  return expoPushToken;
}

async function registerForPushNotificationsAsync() {
  let token;

  try {
    const Notifications = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }
      
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? "nook-app-id";
      token = (await Notifications.getExpoPushTokenAsync({
        projectId,
      })).data;
    } else {
      console.log('Must use physical device for Push Notifications');
    }
  } catch (e) {
    console.log("Error getting push token", e);
  }

  return token;
}

export async function sendPushNotification(expoPushToken: string | null | undefined, title: string, body: string) {
  if (!expoPushToken) return;

  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
  };

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error("Error sending push:", error);
  }
}
