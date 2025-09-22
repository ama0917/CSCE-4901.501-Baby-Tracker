import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Switch, TextInput, StyleSheet, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import NotificationService from '../src/notifications/notificationService';
import { summaryRepository } from '../src/data/summaryRepository';
import { useActiveChild } from '../src/contexts/ActiveChildContext';

// Neon gradients for dark mode
const neonGradients = {
  card: ['#81d4fa8a', '#81D4FA'],
  button: ['#f488bebb', '#ffb84dc0'],
  input: ['#fad0c43f', '#ffd1ff4a'],
};

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { darkMode, setDarkMode } = useDarkMode();
  const [mfa, setMfa] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [testNotifId, setTestNotifId] = useState(null);

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

  const { activeChildId, activeChildName } = (() => {
    try {
      return useActiveChild();
    } catch (e) {
      return { activeChildId: null, activeChildName: null };
    }
  })();

  const sendTestNotification = async () => {
    const granted = await NotificationService.requestNotificationPermission();
    if (!granted) {
      console.warn('test notif permission denied');
      return;
    }
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

  const currentTheme = darkMode ? appTheme.dark : appTheme.light;

  return (
    <ThemedBackground>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backButton, { color: currentTheme.textPrimary }]}>← Home</Text>
          </TouchableOpacity>

          <Image source={require('../assets/logo.png')} style={styles.logo} />

          <TouchableOpacity style={styles.signOutButton} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: currentTheme.textPrimary }]}>Settings</Text>

        {/* Dark Mode */}
        <LinearGradient
          colors={darkMode ? neonGradients.card : [currentTheme.card, currentTheme.card]}
          style={styles.settingItem}
        >
          <Text style={[styles.settingText, { color: darkMode ? '#fff' : currentTheme.textPrimary }]}>Dark Mode</Text>
          <Switch value={darkMode} onValueChange={setDarkMode} />
        </LinearGradient>

        {/* MFA */}
        <LinearGradient
          colors={darkMode ? neonGradients.card : [currentTheme.card, currentTheme.card]}
          style={styles.settingItem}
        >
          <Text style={[styles.settingText, { color: darkMode ? '#fff' : currentTheme.textPrimary }]}>
            Multi-Factor Authentication
          </Text>
          <Switch value={mfa} onValueChange={setMfa} />
        </LinearGradient>

        {/* Weekly Digest Notifications */}
        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Weekly Digest Notifications</Text>
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
                  if (!granted) {
                    console.warn('Notification permission not granted');
                    return;
                  }
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
                      if (s && s.text) body = s.text;
                    }
                  } catch (e) {
                    console.error('fetch latest summary for notification', e);
                  }
                  const id = await NotificationService.scheduleWeeklyDigestNotification(body);
                  await updateDoc(docRef, { 'settings.notifications.weeklyNotificationId': id });
                } else {
                  try {
                    const data = snap.exists() ? snap.data() : {};
                    const id = data?.settings?.notifications?.weeklyNotificationId;
                    if (id) {
                      await NotificationService.cancelScheduledNotification(id);
                      await updateDoc(docRef, { 'settings.notifications.weeklyNotificationId': null });
                    }
                  } catch (e) {
                    console.error('cancel notification', e);
                  }
                }
              } catch (e) {
                console.error('save weeklyDigest', e);
              }
            }}
          />
        </View>

        {/* Test Notification */}
        <View style={[styles.settingItem, { justifyContent: 'center' }]}>
          <TouchableOpacity
            style={{ padding: 10, backgroundColor: '#D1E8FF', borderRadius: 12 }}
            onPress={testNotifId ? cancelTestNotification : sendTestNotification}
          >
            <Text style={{ fontWeight: '600' }}>
              {testNotifId ? 'Cancel Test Notification' : 'Send Test Notification (2m)'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Reminders */}
        <TouchableOpacity style={styles.remindersWrapper}>
          <LinearGradient
            colors={darkMode ? neonGradients.button : [currentTheme.card, currentTheme.card]}
            style={styles.remindersButton}
          >
            <Text style={[styles.remindersText, { color: darkMode ? '#000' : currentTheme.textPrimary }]}>
              Set Reminders
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Change Password */}
        <LinearGradient
          colors={darkMode ? neonGradients.card : [currentTheme.card, currentTheme.card]}
          style={styles.passwordSection}
        >
          <Text style={[styles.sectionTitle, { color: darkMode ? '#fff' : currentTheme.textPrimary }]}>
            Change Password
          </Text>

          <LinearGradient colors={darkMode ? neonGradients.input : [currentTheme.input, currentTheme.input]} style={styles.input}>
            <TextInput placeholder="Current Password" placeholderTextColor={darkMode ? '#ccc' : '#555'} secureTextEntry style={styles.inputText} />
          </LinearGradient>

          <LinearGradient colors={darkMode ? neonGradients.input : [currentTheme.input, currentTheme.input]} style={styles.input}>
            <TextInput placeholder="New Password" placeholderTextColor={darkMode ? '#ccc' : '#555'} secureTextEntry style={styles.inputText} />
          </LinearGradient>

          <LinearGradient colors={darkMode ? neonGradients.input : [currentTheme.input, currentTheme.input]} style={styles.input}>
            <TextInput placeholder="Confirm New Password" placeholderTextColor={darkMode ? '#ccc' : '#555'} secureTextEntry style={styles.inputText} />
          </LinearGradient>

          <TouchableOpacity style={styles.resetWrapper}>
            <LinearGradient colors={darkMode ? neonGradients.button : ['#FFCDD2', '#FFCDD2']} style={styles.resetButton}>
              <Text style={[styles.resetText, { color: darkMode ? '#000' : '#333' }]}>Reset Password</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </ScrollView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: 
  { 
    flexGrow: 1,
     padding: 30, 
     alignItems: 'center' },
  header: 
  { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
     width: '100%', 
     alignItems: 'center', 
     marginBottom: 10, 
     marginTop: 10 
    },
  backButton:
   { 
    fontSize: 14, 
    marginBottom: 20 
  },
  title: 
  {
     fontSize: 28,
     fontWeight: 'bold',
      marginVertical: 15 
    },
  settingItem: 
  { 
    width: '100%', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 15, 
    borderRadius: 20,
     marginVertical: 10 
    },
  settingText: 
  { 
    fontSize: 16
   },
  remindersWrapper: 
  {
     width: '100%',
      marginVertical: 15 
    },
  remindersButton: 
  { 
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    borderRadius: 20 
  },
  remindersText: 
  { 
    fontSize: 16,
     fontWeight: '600', 
     textAlign: 'center' 
    },
  passwordSection: 
  { 
    width: '100%', 
    borderRadius: 30,
     padding: 20,
      marginTop: 20 
    },
  sectionTitle: 
  { 
    fontSize: 20, 
    fontWeight: 'bold', 
    marginBottom: 15 
  },
  input:
   { 
    borderRadius: 15,
     marginVertical: 8,
      paddingHorizontal: 1
     },
  inputText: 
  { 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    color: '#fff' 
  },
  resetWrapper: 
  { 
    marginTop: 15, 
    borderRadius: 20
  },
  resetButton: 
  { 
    borderRadius: 20,
     paddingVertical: 12,
      paddingHorizontal: 20 
    },
  resetText: 
  { 
    fontSize: 16,
     fontWeight: 'bold', 
     textAlign: 'center'
     },
  logo: 
  { width: 65, 
    height: 65, 
    resizeMode: 'contain', 
    marginTop: 10 
  },
  signOutButton:
   { backgroundColor: '#FFCDD2',
     paddingVertical: 8,
      paddingHorizontal: 12,
       borderRadius: 15 },
  signOutText:
   { color: '#FF3B30',
    fontSize: 14, 
    fontWeight: 'bold' },
});
