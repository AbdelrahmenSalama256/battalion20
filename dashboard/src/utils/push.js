import { api } from '../api';

export async function registerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push not supported');
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    // Check existing subscription
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      sendToBackend(existing);
      return true;
    }

    // Don't request if permission already denied
    if (Notification.permission === 'denied') {
      console.log('Push permission denied');
      return false;
    }

    // Subscribe
    const publicKey = 'BKTs62IfCdNH1Mpshq_JN3jV5A4Uy9s9rkGyYEWpS_JrxBCw77OvGbRgmaimlb9-PP4sv1j7ftw-JHVozz-0jm4';
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await sendToBackend(sub);
    return true;
  } catch (e) {
    console.error('Push registration error:', e.message);
    return false;
  }
}

async function sendToBackend(sub) {
  try {
    await api.pushSubscribe(sub.endpoint, {
      p256dh: arrayBufferToBase64(sub.getKey('p256dh')),
      auth: arrayBufferToBase64(sub.getKey('auth')),
    });
  } catch (e) {
    console.error('Push sendToBackend error:', e.message);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
