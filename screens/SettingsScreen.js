import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Switch, TextInput, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient} from 'expo-linear-gradient';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import NotificationService from '../src/notifications/notificationService';
import { summaryRepository } from '../src/data/summaryRepository';
import { useActiveChild } from '../src/contexts/ActiveChildContext';


export default function SettingsScreen() {
  const navigation = useNavigation();
  const [darkMode, setDarkMode] = useState(false);
  const [mfa, setMfa] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

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
      } catch (e) { console.error('load settings', e); }
    };
    load();
  }, []);

  const { activeChildId, activeChildName } = (() => {
    try {
      return useActiveChild();
    } catch (e) {
      return { activeChildId: null, activeChildName: null };
    }
  })();

  const [testNotifId, setTestNotifId] = useState(null);
  const [throttleInfo, setThrottleInfo] = useState(null);

  const sendTestNotification = async () => {
    const granted = await NotificationService.requestNotificationPermission();
    if (!granted) { console.warn('test notif permission denied'); return; }
    // Prefer active child name for message
    const name = activeChildName || 'your child';
    const body = `Test digest for ${name}: this message arrives in ~2 minutes.`;
    const id = await NotificationService.scheduleImmediateTestNotification(body, 2);
    if (id) {
      setTestNotifId(id);
      console.log('Scheduled test notification id=', id);
    }
  };

  const cancelTestNotification = async () => {
    if (!testNotifId) return;
    await NotificationService.cancelScheduledNotification(testNotifId);
    setTestNotifId(null);
  };

  // Debug helpers for throttle key
  const showThrottle = async () => {
    try {
      const childId = activeChildId;
      if (!childId) { Alert.alert('No active child', 'Set an active child before checking throttle.'); return; }
        const key = `digestNotifiedTimes:${childId}`;
        const val = await AsyncStorage.getItem(key);
        if (!val) {
          setThrottleInfo(null);
          Alert.alert('Throttle', 'No throttle entry found for child');
          return;
        }
        let arr = [];
        try { arr = JSON.parse(val) || []; } catch (e) { arr = []; }
        if (!arr.length) {
          Alert.alert('Throttle', 'No timestamps stored');
          setThrottleInfo(null);
          return;
        }
        const when = new Date(arr[arr.length-1]).toLocaleString();
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

  return (
     <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={styles.gradient}>
    <ScrollView contentContainerStyle={styles.container}>
        {/* Header Section */}
    <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
         <Text style={styles.backButton}>← Home</Text>
        </TouchableOpacity>
  
        <Image source={require('../assets/logo.png')} style={styles.logo} />
        <TouchableOpacity style ={styles.signOutButton} onPress={() => navigation.navigate('Login')}>
         <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
        </View>

      <Text style={styles.title}>Settings</Text>
      <View style={styles.settingItem}>
        <Text style={styles.settingText}>Dark Mode 🌙</Text>
        <Switch value={darkMode} onValueChange={setDarkMode} />
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingText}>Multi-Factor Authentication 🔐</Text>
        <Switch value={mfa} onValueChange={setMfa} />
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingText}>Notifications & Reminders 🔔</Text>
        <Switch value={notifications} onValueChange={setNotifications} />
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingText}>Weekly Digest Notifications</Text>
        <Switch value={weeklyDigest} onValueChange={async (val) => {
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
            // If enabling, request permission and schedule. Save notificationId.
            if (val) {
              const granted = await NotificationService.requestNotificationPermission();
              if (!granted) {
                console.warn('Notification permission not granted');
                return;
              }
              // fetch latest summary for body
              let body = 'Your weekly summary is ready.';
              try {
                // Prefer the active child from context if available
                let childToUse = activeChildId || null;
                if (!childToUse) {
                  console.warn('No activeChildId available in Settings — falling back to first child in user doc');
                  const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
                  const childIds = userSnap.exists() ? userSnap.data()?.children || [] : [];
                  if (Array.isArray(childIds) && childIds.length) childToUse = childIds[0];
                }

                if (childToUse) {
                  const s = await summaryRepository.getLatestSummary(childToUse);
                  if (s && s.text) body = s.text;
                }
              } catch (e) { console.error('fetch latest summary for notification', e); }

              const id = await NotificationService.scheduleWeeklyDigestNotification(body);
              await updateDoc(docRef, { 'settings.notifications.weeklyNotificationId': id });
            } else {
              // Cancel scheduled notification if id exists
              try {
                const data = snap.exists() ? snap.data() : {};
                const id = data?.settings?.notifications?.weeklyNotificationId;
                if (id) {
                  await NotificationService.cancelScheduledNotification(id);
                  await updateDoc(docRef, { 'settings.notifications.weeklyNotificationId': null });
                }
              } catch (e) { console.error('cancel notification', e); }
            }
          } catch (e) { console.error('save weeklyDigest', e); }
        }} />
      </View>

      <View style={[styles.settingItem, { justifyContent: 'center' }]}>
        <TouchableOpacity style={{ padding: 10, backgroundColor: '#D1E8FF', borderRadius: 12 }} onPress={testNotifId ? cancelTestNotification : sendTestNotification}>
          <Text style={{ fontWeight: '600' }}>{testNotifId ? 'Cancel Test Notification' : 'Send Test Notification (2m)'}</Text>
        </TouchableOpacity>
      </View>

      {/* Debug controls for throttle */}
      <View style={[styles.settingItem, { flexDirection: 'column', alignItems: 'stretch' }]}>
        <TouchableOpacity style={{ padding: 10, backgroundColor: '#FFF1C6', borderRadius: 12, marginBottom: 8 }} onPress={showThrottle}>
          <Text style={{ fontWeight: '600' }}>Show Digest Throttle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ padding: 10, backgroundColor: '#FFE6E6', borderRadius: 12, marginBottom: 8 }} onPress={clearThrottle}>
          <Text style={{ fontWeight: '600' }}>Clear Digest Throttle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ padding: 10, backgroundColor: '#D6F5D6', borderRadius: 12 }} onPress={forceSendDigest}>
          <Text style={{ fontWeight: '600' }}>Force Send Digest Now</Text>
        </TouchableOpacity>
      </View>

      {/* Dev immediate raw notification */}
      <View style={[styles.settingItem, { justifyContent: 'center' }]}>
        <TouchableOpacity style={{ padding: 10, backgroundColor: '#E8F4FF', borderRadius: 12 }} onPress={async () => {
          const id = await NotificationService.scheduleImmediateTestNotification('Immediate test notification (3s)', 0.05);
          if (id) Alert.alert('Scheduled', `id=${id}`);
          else Alert.alert('Failed', 'No id returned');
        }}>
          <Text style={{ fontWeight: '600' }}>Immediate Raw Notification (3s)</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.remindersButton}>
        <Text style={styles.remindersText}>Set Reminders</Text>
      </TouchableOpacity>

      <View style={styles.passwordSection}>
        <Text style={styles.sectionTitle}>Change Password 🔑</Text>

        <TextInput placeholder="Current Password" style={styles.input} secureTextEntry />
        <TextInput placeholder="New Password" style={styles.input} secureTextEntry />
        <TextInput placeholder="Confirm New Password" style={styles.input} secureTextEntry />

        <TouchableOpacity style={styles.resetButton}>
          <Text style={styles.resetText}>Reset Password</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 30,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  backButton: {
    alignSelf: 'flex-start',
    color: '#007AFF',
    fontSize: 14,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 15,
  },
  settingItem: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF9B0',
    padding: 15,
    borderRadius: 20,
    marginVertical: 10,
  },
  settingText: {
    fontSize: 16,
  },
  remindersButton: {
    backgroundColor: '#C6F6D5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginVertical: 15,
  },
  remindersText: {
    fontSize: 16,
    color: '#333',
  },
  passwordSection: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 30,
    padding: 20,
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#F0F8FF',
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginVertical: 8,
  },
  resetButton: {
    backgroundColor: '#FFCDD2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 15,
  },
  resetText: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  logo: {
    width:65,
    height: 65,
    resizeMode: 'contain',
    marginTop: 10,
   },
   signOutButton:{
    backgroundColor: '#FFCDD2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
   },
   signOutText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: 'bold',
  },
});