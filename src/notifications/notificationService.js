import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { generateSummaryClient } from '../ai/summarizerService';
import { summaryRepository } from '../data/summaryRepository';

// Request permission and return boolean
export async function requestNotificationPermission() {
  try {
    // Some simulator/dev-client environments report Device.isDevice=false
    // but Expo Notifications can still respond to permission requests.
    // Allow requesting permissions even when Device.isDevice is false during QA.
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('requestNotificationPermission error', e);
    return false;
  }
}

// Fetch last 7 days of logs for a child and generate a client summary
async function buildSummaryForChild(childId) {
  try {
    // Try cached summary first
    const cached = await summaryRepository.getLatestSummary(childId).catch(() => null);
    if (cached) return cached;

    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const startTs = Timestamp.fromDate(start);
    const endTs = Timestamp.fromDate(end);

    const feedQ = query(collection(db, 'feedLogs'), where('childId', '==', childId), where('timestamp', '>=', startTs), where('timestamp', '<=', endTs));
    const sleepQ = query(collection(db, 'sleepLogs'), where('childId', '==', childId), where('timestamp', '>=', startTs), where('timestamp', '<=', endTs));
    const diaperQ = query(collection(db, 'diaperLogs'), where('childId', '==', childId), where('time', '>=', startTs), where('time', '<=', endTs));

    const [feedSnap, sleepSnap, diaperSnap] = await Promise.all([getDocs(feedQ), getDocs(sleepQ), getDocs(diaperQ)]);

    const feeds = [];
    feedSnap.forEach(d => feeds.push({ id: d.id, ...d.data() }));
    const sleeps = [];
    sleepSnap.forEach(d => sleeps.push({ id: d.id, ...d.data() }));
    const diapers = [];
    diaperSnap.forEach(d => diapers.push({ id: d.id, ...d.data() }));

    const { text, metrics } = await generateSummaryClient({ feeds, sleeps, diapers });
    return { text, metrics };
  } catch (e) {
    console.warn('buildSummaryForChild error', e);
    return { text: '', metrics: {} };
  }
}

// Throttle notifications per child using AsyncStorage
async function canNotifyChild(childId, throttleHours = 6) {
  try {
    const key = `lastDigestNotified:${childId}`;
    const val = await AsyncStorage.getItem(key);
    if (!val) return true;
    const last = Number(val);
    if (Number.isNaN(last)) return true;
    const cutoff = Date.now() - throttleHours * 60 * 60 * 1000;
    return last < cutoff;
  } catch (e) {
    return true;
  }
}

async function markNotified(childId) {
  try {
    const key = `lastDigestNotified:${childId}`;
    await AsyncStorage.setItem(key, String(Date.now()));
  } catch (e) {
    // ignore
  }
}

/**
 * Send a digest notification for a child immediately (throttled).
 * Returns the notification id or null.
 */
export async function sendDigestNotificationForChild(childId, options = {}) {
  const { throttleHours = 6, force = false } = options;
  try {
    if (!childId) return null;
    if (!force) {
      const ok = await canNotifyChild(childId, throttleHours);
      if (!ok) return null;
    }

    const granted = await requestNotificationPermission();
    if (!granted) {
      console.warn('push digest permission denied');
      return null;
    }

    let summary = await summaryRepository.getLatestSummary(childId).catch(() => null);
    let body = '';
    if (summary && summary.text) {
      body = summary.text;
    } else {
      const built = await buildSummaryForChild(childId);
      body = built?.text || '';
    }

    if (!body) return null;

    // schedule an immediate notification (1s delay)
    const trigger = new Date(Date.now() + 1000);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Baby Digest',
        body,
        sound: true,
        data: { childId },
      },
      trigger,
    });

    await markNotified(childId);
    return id;
  } catch (e) {
    console.warn('sendDigestNotificationForChild failed', e);
    return null;
  }
}

// (consolidated default export is declared at the end of this file)

function nextWeekdayDate(weekday, hour = 19, minute = 0) {
  // weekday: 0 (Sunday) .. 6 (Saturday)
  const now = new Date();
  const target = new Date(now);
  const day = now.getDay();
  let delta = (weekday - day + 7) % 7;
  if (delta === 0) {
    // If today but earlier than the time, keep today; otherwise go next week
    if (now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute)) delta = 7;
  }
  target.setDate(now.getDate() + delta);
  target.setHours(hour, minute, 0, 0);
  return target;
}

// Schedule a weekly notification on Sunday at 19:00 local time
export async function scheduleWeeklyDigestNotification(bodyText) {
  try {
    // Compute next Sunday (0) at 19:00
    const date = nextWeekdayDate(0, 19, 0);

    // Use a calendar trigger — set repeats:true and weekday/hour/minute where supported
    const trigger = {
      weekday: 1, // expo uses 1 (Sunday) .. 7 (Saturday) for calendar triggers
      hour: 19,
      minute: 0,
      repeats: true,
    };

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Weekly Baby Digest',
        body: bodyText || 'Your weekly summary is ready.',
        sound: true,
      },
      trigger,
    });
    return id;
  } catch (e) {
    console.warn('scheduleWeeklyDigestNotification failed', e);
    return null;
  }
}

// Schedule a test notification a few minutes in the future for QA (default: 2 minutes)
export async function scheduleImmediateTestNotification(bodyText, minutesFromNow = 2) {
  try {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutesFromNow);
    const trigger = now;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Test: Weekly Baby Digest',
        body: bodyText || 'This is a test digest notification.',
        sound: true,
      },
      trigger,
    });
    return id;
  } catch (e) {
    console.warn('scheduleImmediateTestNotification failed', e);
    return null;
  }
}

export async function cancelScheduledNotification(id) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (e) {
    console.warn('cancelScheduledNotification failed', e);
  }
}

// Consolidated default export
export default {
  requestNotificationPermission,
  scheduleWeeklyDigestNotification,
  scheduleImmediateTestNotification,
  cancelScheduledNotification,
  sendDigestNotificationForChild,
};
