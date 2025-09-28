// SettingsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Switch, TextInput, StyleSheet, ScrollView, Image, Alert, StatusBar, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db, app } from '../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import NotificationService from '../src/notifications/notificationService';
import { summaryRepository } from '../src/data/summaryRepository';
import { useActiveChild } from '../src/contexts/ActiveChildContext';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { startTotpEnrollment, finishTotpEnrollment } from '../auth/mfa';
import { getAuth, sendEmailVerification, multiFactor } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import useUserRole from './useUserRole';

 
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

  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [testNotifId, setTestNotifId] = useState(null);
  const [throttleInfo, setThrottleInfo] = useState(null);

  const [mfa, setMfa] = useState(false);
  // MFA (TOTP) enrollment local state
  const [mfaEnrollOpen, setMfaEnrollOpen] = useState(false);
  const [otpauthUrl, setOtpauthUrl] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [manualKey, setManualKey] = useState(null);


  // Start TOTP enrollment: gets a QR code URL (requires verified email)
const handleStartTotp = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    Alert.alert('Not signed in', 'Please sign in again and try enabling MFA.');
    return;
  }
  try {
    setMfaBusy(true);

    // Refresh and check emailVerified first
    await user.reload();
    if (!user.emailVerified) {
      Alert.alert(
        'Verify your email first',
        'You need to verify your email before enabling two-step verification.',
        [
          { text: 'Not now' },
          {
            text: 'Resend verification email',
            onPress: async () => {
              try {
                await sendEmailVerification(user);
                Alert.alert('Sent', 'Verification email sent. Check your inbox, then try again.');
              } catch (e) {
                Alert.alert('Error', e?.message ?? 'Could not send verification email.');
              }
            },
          },
        ]
      );
      return;
    }

    // Start enrollment -> returns otpauth:// URL
    const { otpauthUrl } = await startTotpEnrollment(user, {
      issuer: 'BabyTracker',
      displayName: 'Authenticator app',
    });
    setOtpauthUrl(otpauthUrl);

    // Parse manual Base32 secret for users without QR scanning
    try {
      let secret = null;
      // Prefer URL API if available
      try {
        const u = new URL(otpauthUrl);
        secret = u.searchParams.get('secret');
      } catch {
        // Fallback regex
        const m = otpauthUrl.match(/[?&]secret=([^&]+)/i);
        if (m) secret = decodeURIComponent(m[1]);
      }
      setManualKey(secret);
    } catch {
      setManualKey(null);
    }

    setMfaEnrollOpen(true);
  } catch (err) {
    if (err?.code === 'auth/requires-recent-login') {
      Alert.alert('Re-authentication needed', 'Sign out and sign back in, then try again.');
    } else {
      Alert.alert('Could not start MFA', err?.message ?? 'Unknown error');
    }
  } finally {
    setMfaBusy(false);
  }
};


// Finish TOTP enrollment by verifying the 6-digit code
const handleFinishTotp = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    Alert.alert('Not signed in', 'Please sign in again and try enabling MFA.');
    return;
  }
  if (!/^\d{6}$/.test(totpCode.trim())) {
    Alert.alert('Invalid code', 'Enter the 6-digit code from your authenticator app.');
    return;
  }
  try {
    setMfaBusy(true);

    // (1) Enroll with the 6-digit code
    await finishTotpEnrollment(user, totpCode.trim());

    // DEBUG: MFA check
    console.log('[MFA] after finishTotpEnrollment, currentUser.uid =', getAuth().currentUser?.uid);

    // (2) DEBUG: refresh user and inspect factors
    await user.reload(); // <-- ADDED
    const enrolledCount = (user.multiFactor?.enrolledFactors || []).length; // <-- ADDED
    console.log('[MFA] enrolled factors after enroll =', enrolledCount);     // <-- ADDED

    // Ensure user doc exists, then mark MFAEnabled: true in *users* collection
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, { MFAEnabled: true }, { merge: true });
    } else {
      await updateDoc(userRef, { MFAEnabled: true });
    }

    // (3) If server didn’t show a factor yet, let us know (keeps UI logic intact)
    if (enrolledCount === 0) { // <-- ADDED
      Alert.alert(
        'Heads up',
        'Enrollment call returned, but no factor is visible yet. Try confirming again or re-open Settings.'
      );
    } else {
      Alert.alert('MFA enabled', 'Two-step verification is now active on your account.');
    }

    // Reset local UI
    setTotpCode('');
    setOtpauthUrl(null);
    setMfaEnrollOpen(false);
  } catch (err) {
    console.warn('finishTotpEnrollment error:', err); // <-- ADDED
    Alert.alert('Verification failed', err?.message ?? 'Please check the 6-digit code and try again.');
  } finally {
    setMfaBusy(false);
  }
};

  const disableTotpServerSide = async () => {
   const u = auth.currentUser;
   if (!u) throw new Error('Not signed in');
   // ensure fresh ID token so callable carries auth context
   await u.getIdToken(true);
   const fns = getFunctions(app, 'us-central1'); // bind to SAME app + region
   const unenroll = httpsCallable(fns, 'authUnenrollAllTotp');
   const res = await unenroll({});
   console.log('[MFA] server unenroll result =', res?.data);
   await u.reload();
   return res?.data;
 };

  // Disable TOTP: removes the factor and clears MFAEnabled flag
  // ensure at top you have:  import { multiFactor } from 'firebase/auth';

  const handleDisableTotp = async () => {
    const user = auth.currentUser; // use the SAME instance you import from firebaseConfig
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in again and try disabling MFA.');
      return;
    }
    try {
      setMfaBusy(true);
      await user.reload();

      const before = multiFactor(user).enrolledFactors || [];
      console.log('[MFA] BEFORE unenroll, factors =',
        before.map(f => ({ factorId: f.factorId, uid: f.uid })));

      const totpFactors = before.filter(f => f.factorId === 'totp');
      console.log('[MFA] disable path =', totpFactors.length === 0 ? 'SERVER' : 'CLIENT', 
            'factorsBefore=', before.map(f => ({factorId: f.factorId, uid: f.uid})));

      if (totpFactors.length === 0) {
        await disableTotpServerSide();
        await user.reload();
        const nowFactors = user.multiFactor?.enrolledFactors || [];
        console.log('[MFA] AFTER server unenroll, factors =', nowFactors.map(f => ({ factorId: f.factorId, uid: f.uid })));
        await updateDoc(doc(db, 'users', user.uid), { MFAEnabled: false });
        setMfa(false);
        Alert.alert('MFA disabled', 'Authenticator removed from your account.');
        return;
      }


      // Unenroll ALL TOTP factors (usually just one)
      for (const f of totpFactors) {
        await multiFactor(user).unenroll(f.uid);
      }

      await user.getIdToken(true);
      await user.reload();

      const after = user.multiFactor?.enrolledFactors || [];
      console.log('[MFA] AFTER unenroll, factors =',
        after.map(f => ({ factorId: f.factorId, uid: f.uid })));

      await updateDoc(doc(db, 'users', user.uid), { MFAEnabled: false });
      setMfa(false);
      setMfaEnrollOpen(false);
      setOtpauthUrl(null);
      setTotpCode('');

      Alert.alert('MFA disabled', 'Authenticator removed from your account.');
    } catch (e) {
        console.warn('[MFA] disableTotp error', e?.code, e?.message);  // <— add this line first

        if (e?.code === 'auth/requires-recent-login') {
          Alert.alert('Re-authentication needed', 'Sign out and sign back in, then try again.');
        } else {
          Alert.alert('Could not disable MFA', e?.message ?? 'Unknown error');
        }
        setMfa(true); // revert toggle on failure
      } finally {
        setMfaBusy(false);
      }
  };



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

              if (val === false) {
                // TURNING OFF → unenroll TOTP
                await handleDisableTotp();
                return;
              }

              // TURNING ON → keep your simple flag (enrollment is done via the section below)
              try {
                await updateDoc(doc(db, 'users', currentUser.uid), { MFAEnabled: true });
              } catch (e) {
                console.error('save MFAEnabled', e);
              }
            }}
          />
        </LinearGradient>

        {/* --- MFA (TOTP) Enrollment Section --- */}
        <View style={{ marginTop: 8, padding: 16, borderRadius: 12, backgroundColor: '#111827' }}>
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
            Two-Step Verification (Authenticator App)
          </Text>

          {!mfaEnrollOpen ? (
            <TouchableOpacity
              onPress={handleStartTotp}
              disabled={mfaBusy}
              style={{
                marginTop: 8,
                backgroundColor: '#3a86ff',
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
                opacity: mfaBusy ? 0.6 : 1,
              }}
            >
              {mfaBusy ? (
                <ActivityIndicator />
              ) : (
                <Text style={{ color: 'white', fontWeight: '700' }}>Set up Authenticator (TOTP)</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#cbd5e1', textAlign: 'center', marginBottom: 12 }}>
                Scan this QR code with your authenticator app (Google Authenticator, Microsoft
                Authenticator, Authy, 1Password, Bitwarden, etc.). Then enter the 6-digit code below.
              </Text>

              {otpauthUrl ? (
                <View style={{ padding: 12, backgroundColor: 'white', borderRadius: 12, marginBottom: 12 }}>
                  <QRCode value={otpauthUrl} size={180} />
                </View>
              ) : (
                <Text style={{ color: '#cbd5e1', marginBottom: 12 }}>Generating QR…</Text>
              )}

              {/* Manual key fallback (for users without QR scanning) */}
              {manualKey ? (
                <View style={{ marginTop: 4, backgroundColor: '#1c2541', padding: 8, borderRadius: 8 }}>
                  <Text style={{ color: '#cbd5e1', textAlign: 'center', fontSize: 14 }}>
                    Manual key (enter in your authenticator):
                  </Text>
                  <Text
                    selectable
                    style={{ color: 'white', textAlign: 'center', fontSize: 18, marginTop: 4, letterSpacing: 2 }}
                  >
                    {manualKey}
                  </Text>
                </View>
              ) : null}


              <TextInput
                placeholder="123456"
                placeholderTextColor="#9aa0a6"
                keyboardType="number-pad"
                maxLength={6}
                value={totpCode}
                onChangeText={(t) => setTotpCode(t.replace(/\D/g, ''))}
                style={{
                  width: '100%',
                  backgroundColor: '#0b132b',
                  color: 'white',
                  borderRadius: 10,
                  paddingVertical: 12,
                  textAlign: 'center',
                  fontSize: 20,
                  letterSpacing: 4,
                  marginBottom: 8,
                }}
              />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={handleFinishTotp}
                  disabled={mfaBusy || !/^\d{6}$/.test(totpCode)}
                  style={{
                    flex: 1,
                    backgroundColor: '#22c55e',
                    borderRadius: 10,
                    paddingVertical: 12,
                    alignItems: 'center',
                    opacity: mfaBusy || !/^\d{6}$/.test(totpCode) ? 0.6 : 1,
                  }}
                >
                  {mfaBusy ? <ActivityIndicator /> : <Text style={{ color: 'white', fontWeight: '700' }}>Confirm</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setMfaEnrollOpen(false);
                    setOtpauthUrl(null);
                    setTotpCode('');
                  }}
                  disabled={mfaBusy}
                  style={{
                    flex: 1,
                    backgroundColor: '#374151',
                    borderRadius: 10,
                    paddingVertical: 12,
                    alignItems: 'center',
                    opacity: mfaBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>


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
