// [KEPT incoming imports + added what’s necessary]
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Switch, TextInput, StyleSheet, ScrollView, Image, Alert, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import NotificationService from '../src/notifications/notificationService';
import { summaryRepository } from '../src/data/summaryRepository';
import { useActiveChild } from '../src/contexts/ActiveChildContext';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react-native';

// [ADDED] your role hook so we can show caregiver actions
import useUserRole from './useUserRole';

// [INCOMING constant]
const neonGradients = {
  card: ['#6491ebff', '#7676dbff'],
  button: ['#5aececff', '#62a8e5ff'],
  button2: ['#000001ff', '#000004ff'],
  warn: ['#faaa72ff', '#f68dc0ff'],
  input: ['#fad0c43f', '#ffd1ff4a'],
};

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { darkMode, setDarkMode } = useDarkMode();

  // [KEPT incoming state]
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [testNotifId, setTestNotifId] = useState(null);
  const [throttleInfo, setThrottleInfo] = useState(null);

  // [MFA: keep a simple toggle only]
  const [mfa, setMfa] = useState(false);

  // [ADDED] role to show caregiver actions
  const { role } = useUserRole();

  // [KEPT incoming load for weekly digest preference]
  useEffect(() => {
    const load = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setWeeklyDigest(!!(data?.settings?.notifications?.weeklyDigest));
        }
      } catch (e) {
        console.error('load settings', e);
      }
    };
    load();
  }, []);

  // [ADDED] load MFA flag (simple boolean) — deeper MFA logic is intentionally NOT wired
  useEffect(() => {
    const loadMfa = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        const ref = doc(db, 'users', currentUser.uid); // using lowercase 'users' to match incoming
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setMfa(!!snap.data()?.MFAEnabled);
        }
      } catch (e) {
        console.error('load MFA', e);
      }
    };
    loadMfa();
  }, []);

  // [KEPT incoming active child access]
  const { activeChildId, activeChildName } = (() => {
    try {
      return useActiveChild();
    } catch (e) {
      return { activeChildId: null, activeChildName: null };
    }
  })();

  // [KEPT incoming notification helpers]
  const sendTestNotification = async () => {
    const granted = await NotificationService.requestNotificationPermission();
    if (!granted) {
      console.warn('test notif permission denied');
      return;
    }
    const name = activeChildName || 'your child';
    const body = `Test digest for ${name}: this message arrives in ~2 minutes.`;
    const id = await NotificationService.scheduleImmediateTestNotification(body, 2);
    if (id) setTestNotifId(id);
  };
  const cancelTestNotification = async () => {
    if (!testNotifId) return;
    await NotificationService.cancelScheduledNotification(testNotifId);
    setTestNotifId(null);
  };
  const showThrottle = async () => {
    try {
      const childId = activeChildId;
      if (!childId) { Alert.alert('No active child', 'Set an active child before checking throttle.'); return; }
      const key = `digestNotifiedTimes:${childId}`;
      const val = await AsyncStorage.getItem(key);
      if (!val) { setThrottleInfo(null); Alert.alert('Throttle', 'No throttle entry found for child'); return; }
      let arr = [];
      try { arr = JSON.parse(val) || []; } catch { arr = []; }
      if (!arr.length) { setThrottleInfo(null); Alert.alert('Throttle', 'No timestamps stored'); return; }
      const when = new Date(arr[arr.length - 1]).toLocaleString();
      setThrottleInfo({ key, arr });
      Alert.alert('Throttle', `Last notified: ${when} (count=${arr.length})`);
    } catch (e) {
      console.error('showThrottle', e);
      Alert.alert('Error', String(e));
    }
  };
  const clearThrottle = async () => {
    try {
      const childId = activeChildId;
      if (!childId) { Alert.alert('No active child', 'Set an active child before clearing throttle.'); return; }
      const key = `digestNotifiedTimes:${childId}`;
      await AsyncStorage.removeItem(key);
      setThrottleInfo(null);
      Alert.alert('Throttle cleared', `Removed ${key}`);
    } catch (e) {
      console.error('clearThrottle', e);
      Alert.alert('Error', String(e));
    }
  };
  const forceSendDigest = async () => {
    try {
      const childId = activeChildId;
      if (!childId) { Alert.alert('No active child', 'Select an active child first.'); return; }
      const id = await NotificationService.sendDigestNotificationForChild(childId, { force: true });
      if (id) {
        Alert.alert('Notification scheduled', `id=${id}`);
      } else {
        Alert.alert('No notification sent', 'Throttled or no data available for digest');
      }
    } catch (e) {
      console.error('forceSendDigest', e);
      Alert.alert('Error', String(e));
    }
  };

  const currentTheme = darkMode ? appTheme.dark : appTheme.light;

  return (
    <ThemedBackground>
      {/* [FIXED] prop is barStyle (not barstyle) */}
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <LinearGradient
              colors={darkMode ? neonGradients.button2 : ['#fff', '#f5f5f5']}
              style={styles.headerButtonGradient}
            >
              <ArrowLeft size={20} color={darkMode ? '#fff' : '#2E3A59'} />
            </LinearGradient>
          </TouchableOpacity>

          <Image source={require('../assets/logo.png')} style={styles.logo} />

          <TouchableOpacity style={styles.signOutButton} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.titleWrapper, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }]}>
          <SettingsIcon size={20} color={currentTheme.textPrimary} />
          <Text style={[styles.title, { color: currentTheme.textPrimary }]}>Settings</Text>
        </View>


        {/* Dark Mode (incoming card style) */}
        <LinearGradient
          colors={darkMode ? neonGradients.card : ['#fbd687ee', '#f9f9ff']}
          style={styles.settingCard}
        >
          <Text style={[styles.settingText, { color: currentTheme.textPrimary }]}>Dark Mode</Text>
          <Switch value={darkMode} onValueChange={setDarkMode} />
        </LinearGradient>

        {/* MFA (simple toggle only) */}
        <LinearGradient
          colors={darkMode ? neonGradients.card : ['#fbd687ee', '#f9f9ff']}
          style={styles.settingCard}
        >
          <Text style={[styles.settingText, { color: currentTheme.textPrimary }]}>
            Multi-Factor Authentication
          </Text>
          <Switch
            value={mfa}
            onValueChange={async (val) => {
              setMfa(val);
              const currentUser = auth.currentUser;
              if (!currentUser) return;
              try {
                // Keep only a simple flag; deeper MFA/TOTP wiring intentionally commented out.
                await updateDoc(doc(db, 'users', currentUser.uid), { MFAEnabled: val });
              } catch (e) {
                console.error('save MFAEnabled', e);
              }
            }}
          />
        </LinearGradient>

        {/* Weekly Digest (incoming) */}
        <LinearGradient
          colors={darkMode ? neonGradients.card : ['#fbd687ee', '#f9f9ff']}
          style={styles.settingCard}
        >
          <Text style={[styles.settingText, { color: currentTheme.textPrimary }]}>
            Weekly Digest Notifications
          </Text>
          <Switch
            value={weeklyDigest}
            onValueChange={async (val) => {
              setWeeklyDigest(val);
              const currentUser = auth.currentUser;
              if (!currentUser) return;
              const docRef = doc(db, 'users', currentUser.uid);
              try {
                const snap = await getDoc(docRef);
                if (!snap.exists()) {
                  await setDoc(docRef, { settings: { notifications: { weeklyDigest: val } } });
                } else {
                  await updateDoc(docRef, { 'settings.notifications.weeklyDigest': val });
                }
                if (val) {
                  const granted = await NotificationService.requestNotificationPermission();
                  if (!granted) return;
                  let body = 'Your weekly summary is ready.';
                  try {
                    let childToUse = activeChildId || null;
                    if (!childToUse) {
                      const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
                      const childIds = userSnap.exists() ? userSnap.data()?.children || [] : [];
                      if (Array.isArray(childIds) && childIds.length) childToUse = childIds[0];
                    }
                    if (childToUse) {
                      const s = await summaryRepository.getLatestSummary(childToUse);
                      if (s?.text) body = s.text;
                    }
                  } catch {}
                  const id = await NotificationService.scheduleWeeklyDigestNotification(body);
                  await updateDoc(docRef, { 'settings.notifications.weeklyNotificationId': id });
                } else {
                  const data = snap.exists() ? snap.data() : {};
                  const id = data?.settings?.notifications?.weeklyNotificationId;
                  if (id) {
                    await NotificationService.cancelScheduledNotification(id);
                    await updateDoc(docRef, { 'settings.notifications.weeklyNotificationId': null });
                  }
                }
              } catch (e) {
                console.error('save weeklyDigest', e);
              }
            }}
          />
        </LinearGradient>

        {/* [ADDED] Caregiver actions (your feature) */}
        {role !== 'parent' && (
          <TouchableOpacity
            style={styles.inviteCaregiverButton}
            onPress={() => navigation.navigate('AcceptInvite')}
          >
            <Text style={styles.inviteText}>Enter caregiver invite code</Text>
          </TouchableOpacity>
        )}

        {role === 'parent' && (
          <TouchableOpacity
            style={styles.inviteCaregiverButton}
            onPress={() => navigation.navigate('ManageCaregivers')}
          >
            <Text style={styles.inviteText}>Manage Caregivers</Text>
          </TouchableOpacity>
        )}

        {/* Test Notification (incoming) */}
        <LinearGradient
          colors={darkMode ? neonGradients.card : ['#ffffffee', '#f9f9ff']}
          style={styles.settingCard}
        >
          <TouchableOpacity onPress={testNotifId ? cancelTestNotification : sendTestNotification}>
            <Text style={{ fontWeight: '600', color: currentTheme.textPrimary }}>
              {testNotifId ? 'Cancel Test Notification' : 'Send Test Notification (2m)'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Debug Controls (incoming) */}
        <LinearGradient colors={darkMode ? neonGradients.card : ['#ffffffee', '#f9f9ff']} style={styles.settingItem}>
          <TouchableOpacity onPress={showThrottle} style={styles.settingRow}>
            <Text style={[styles.settingText, { color: currentTheme.textPrimary }]}>Show Digest Throttle</Text>
          </TouchableOpacity>
        </LinearGradient>

        <LinearGradient colors={darkMode ? neonGradients.card : ['#ffffffee', '#f9f9ff']} style={styles.settingItem}>
          <TouchableOpacity onPress={clearThrottle} style={styles.settingRow}>
            <Text style={[styles.settingText, { color: currentTheme.textPrimary }]}>Clear Digest Throttle</Text>
          </TouchableOpacity>
        </LinearGradient>

        <LinearGradient colors={darkMode ? neonGradients.card : ['#ffffffee', '#f9f9ff']} style={styles.settingItem}>
          <TouchableOpacity onPress={forceSendDigest} style={styles.settingRow}>
            <Text style={[styles.settingText, { color: currentTheme.textPrimary }]}>Force Send Digest Now</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Reminders CTA (incoming styling) */}
        <TouchableOpacity style={styles.remindersWrapper}>
          <LinearGradient colors={darkMode ? neonGradients.warn : ['#FFD1FF', '#FAD0C4']} style={styles.remindersButton}>
            <Text style={styles.remindersText}>Set Reminders</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Change Password (incoming) */}
        <LinearGradient colors={darkMode ? neonGradients.card : ['#ffffffee', '#f9f9ff']} style={styles.passwordSection}>
          <Text style={[styles.sectionTitle, { color: currentTheme.textPrimary }]}>Change Password</Text>
          {['Current Password', 'New Password', 'Confirm New Password'].map((ph, i) => (
            <LinearGradient key={i} colors={darkMode ? neonGradients.input : ['#f0f0f0', '#fff']} style={styles.input}>
              <TextInput
                placeholder={ph}
                placeholderTextColor={darkMode ? '#ccc' : '#7C8B9A'}
                secureTextEntry
                style={styles.inputText}
              />
            </LinearGradient>
          ))}
          <TouchableOpacity style={styles.resetWrapper}>
            <LinearGradient colors={darkMode ? neonGradients.button : ['#FFCDD2', '#dcbbc5ff']} style={styles.resetButton}>
              <Text style={styles.resetText}>Reset Password</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </ScrollView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerButton: { borderRadius: 12, overflow: 'hidden' },
  headerButtonGradient: { padding: 8, borderRadius: 12 },
  titleWrapper: { width: '100%', alignItems: 'center', marginVertical: 15 },
  title: { fontSize: 28, fontWeight: 'bold' },

  settingItem: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    borderRadius: 20,
    marginVertical: 10,
  },
  settingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  settingRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%' },
  settingText: { fontSize: 16, fontWeight: '600' },

  remindersWrapper: { width: '100%', marginVertical: 15 },
  remindersButton: { borderRadius: 20, paddingVertical: 14, alignItems: 'center' },
  remindersText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },

  passwordSection: {
    marginTop: 25,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  input: { borderRadius: 15, marginVertical: 8, paddingHorizontal: 1 },
  inputText: { paddingHorizontal: 15, paddingVertical: 10, color: '#fff' },
  resetWrapper: { marginTop: 15, borderRadius: 20 },
  resetButton: { borderRadius: 20, paddingVertical: 12, paddingHorizontal: 20 },
  resetText: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },

  logo: { width: 65, height: 65, resizeMode: 'contain', marginTop: 10 },
  signOutButton: { backgroundColor: '#ffffffff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 15 },
  signOutText: { color: '#000000ff', fontSize: 14, fontWeight: 'bold' },

  // [ADDED] shared styling for caregiver buttons
  inviteCaregiverButton: {
    backgroundColor: '#81D4FA',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginVertical: 10,
    alignItems: 'center',
    width: '100%',
  },
  inviteText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
