import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, query, where, orderBy, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { AppNotification } from '../types';
import { useState, useEffect } from 'react';

// Request notification permission and register FCM device token
export async function requestPushPermission(userId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn("Notifications not supported in this browser.");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Try to register service worker and FCM token
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log("FCM Service Worker registered with scope:", registration.scope);

          // Dynamically import messaging
          const { getMessaging, getToken } = await import('firebase/messaging');
          const messaging = getMessaging();
          const currentToken = await getToken(messaging, {
            serviceWorkerRegistration: registration,
          }).catch((err) => {
            console.log("FCM token retrieval notice (standard in sandbox/iframe):", err.message);
            return null;
          });

          if (currentToken && userId) {
            const tokenId = currentToken.substring(0, 32);
            await setDoc(doc(db, 'users', userId, 'fcmTokens', tokenId), {
              token: currentToken,
              updatedAt: new Date().toISOString(),
              platform: 'web'
            }, { merge: true });
          }
        } catch (swErr) {
          console.log("Service Worker / FCM setup note:", swErr);
        }
      }
      return true;
    }
    return false;
  } catch (err) {
    console.warn("Permission request error:", err);
    return false;
  }
}

// Dispatches a notification to Firestore and displays browser native notification if permitted
export async function sendAppNotification({
  userId,
  title,
  body,
  type,
  referenceId
}: {
  userId: string;
  title: string;
  body: string;
  type: 'campaign_goal' | 'cashout_status' | 'purchase_status' | 'system';
  referenceId?: string;
}) {
  try {
    // 1. Save to Firestore notifications collection
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      body,
      type,
      referenceId: referenceId || null,
      read: false,
      createdAt: new Date().toISOString()
    });

    // 2. Trigger browser notification if permission is granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: referenceId || type
        });
      } catch (e) {
        // Fallback inside restricted iframe
        console.log("Browser notification popup blocked by iframe:", e);
      }
    }
  } catch (err) {
    console.error("Failed to send app notification:", err);
  }
}

// React hook to subscribe to user notifications
export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppNotification[];

      setNotifications(items);
      setUnreadCount(items.filter(n => !n.read).length);
      setLoading(false);
    }, (err) => {
      console.warn("Notifications listener note:", err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), {
        read: true
      });
    } catch (e) {
      console.error("Failed to mark notification as read:", e);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const item of unread) {
      try {
        await updateDoc(doc(db, 'notifications', item.id), {
          read: true
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead
  };
}
