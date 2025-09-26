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
    // New behavior: allow multiple notifications per window. We store an array of timestamps
    // under key `digestNotifiedTimes:{childId}` and allow up to maxPerWindow sends in the window.
    const key = `digestNotifiedTimes:${childId}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return { ok: true, count: 0 };
    let arr = [];
    try { arr = JSON.parse(raw) || []; } catch (e) { arr = []; }
    const cutoff = Date.now() - throttleHours * 60 * 60 * 1000;
    // keep only timestamps within window
    const recent = arr.filter((t) => Number(t) >= cutoff);
    return { ok: recent.length === 0, count: recent.length, recent };
  } catch (e) {
    return { ok: true, count: 0 };
  }
}

async function markNotified(childId) {
  try {
    const key = `digestNotifiedTimes:${childId}`;
    const raw = await AsyncStorage.getItem(key);
    let arr = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch (e) { arr = []; }
    arr.push(Date.now());
    await AsyncStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {
    // ignore
  }
}

/**
 * Send a digest notification for a child immediately (throttled).
 * Returns the notification id or null.
 */
export async function sendDigestNotificationForChild(childId, options = {}) {
  // options: throttleHours, force, maxPerWindow
  const { throttleHours = 1, force = false, maxPerWindow = 4 } = options;
  try {
    if (!childId) return null;
    if (!force) {
      const res = await canNotifyChild(childId, throttleHours);
      // res: { ok, count, recent }
      const count = res?.count || 0;
      if (!res.ok && count >= maxPerWindow) return null;
    }

    const granted = await requestNotificationPermission();
    if (!granted) {
      console.warn('push digest permission denied');
      return null;
    }

    // Build pattern-based prediction text instead of long digest
    const pattern = await buildPatternForChild(childId).catch(() => null);
    const body = pattern?.text || '';
    if (!body) return null;

    // schedule an immediate notification (1s delay)
    const trigger = new Date(Date.now() + 1000);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Baby: Predicted Next Events',
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
    // Default: schedule weekly on Monday at 19:00 local time
    // bodyText can be provided; otherwise the caller should schedule with a childId using buildPatternForChild
    const trigger = {
      // expo calendar trigger uses 1 (Sunday) .. 7 (Saturday) — Monday is 2
      weekday: 2,
      hour: 19,
      minute: 0,
      repeats: true,
    };

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Weekly Baby Summary',
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

// Build pattern-based predictions for next feeding/sleep/diaper events
async function buildPatternForChild(childId) {
  try {
    // Fetch last N events per log type (7-14 days) and compute simple statistics
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(end.getDate() - 13); // two weeks for patterns
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

    // Helper to get sorted timestamps (ms)
    const sortedTs = (arr, field = 'timestamp') => arr
      .map(x => {
        const t = x[field];
        return (t && t.toDate) ? t.toDate().getTime() : (typeof t === 'number' ? t : null);
      })
      .filter(Boolean)
      .sort((a,b) => a - b);

    const feedTs = sortedTs(feeds, 'timestamp');
    const sleepTs = sortedTs(sleeps, 'timestamp');
    const diaperTs = sortedTs(diapers, 'time');

    // Predict next feed: average interval between last up to 6 feed events
    let nextFeedText = 'Not enough feeding data.';
    if (feedTs.length >= 2) {
      const last = feedTs[feedTs.length - 1];
      const deltas = [];
      for (let i = Math.max(0, feedTs.length - 6); i < feedTs.length - 1; i++) deltas.push(feedTs[i+1] - feedTs[i]);
      const avg = deltas.reduce((s,v)=>s+v,0)/deltas.length;
      const next = new Date(last + avg);
      const mins = Math.round((next - Date.now()) / 60000);
      nextFeedText = `Next feeding ~ in ${mins <= 0 ? '<1' : mins} min (avg interval ${Math.round(avg/60000)} min).`;
    }

    // Predict next sleep: look for common hour-of-day for sleep start times
    let nextSleepText = 'Not enough sleep data.';
    if (sleepTs.length >= 2) {
      const hours = sleepTs.map(t => new Date(t).getHours());
      // compute most common hour
      const counts = {};
      hours.forEach(h => counts[h] = (counts[h]||0)+1);
      const bestHour = Number(Object.keys(counts).reduce((a,b)=>counts[a]>counts[b]?a:b));
      // find next occurrence of that hour
      const now = new Date();
      const target = new Date(now);
      target.setHours(bestHour, 0, 0, 0);
      if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
      const mins = Math.round((target - now)/60000);
      nextSleepText = `Next likely sleep around ${bestHour}:00 (~in ${Math.round(mins/60)}h ${mins%60}m).`;
    }

    // Predict next diaper (poop): average interval
    let nextDiaperText = 'Not enough diaper data.';
    if (diaperTs.length >= 2) {
      const last = diaperTs[diaperTs.length - 1];
      const deltas = [];
      for (let i = Math.max(0, diaperTs.length - 6); i < diaperTs.length - 1; i++) deltas.push(diaperTs[i+1] - diaperTs[i]);
      const avg = deltas.reduce((s,v)=>s+v,0)/deltas.length;
      const next = new Date(last + avg);
      const mins = Math.round((next - Date.now()) / 60000);
      nextDiaperText = `Next poop ~ in ${mins <= 0 ? '<1' : mins} min (avg ${Math.round(avg/3600000)} h).`;
    }

    const text = `${nextFeedText}\n${nextSleepText}\n${nextDiaperText}`;
    return { text, feedCount: feedTs.length, sleepCount: sleepTs.length, diaperCount: diaperTs.length };
  } catch (e) {
    console.warn('buildPatternForChild error', e);
    return { text: '' };
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
