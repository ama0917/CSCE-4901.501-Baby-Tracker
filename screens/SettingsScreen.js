// SettingsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Switch, TextInput, StyleSheet, ScrollView, Image, Alert, StatusBar, ActivityIndicator, LayoutAnimation, Platform, UIManager } from 'react-native';
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
import { ArrowLeft, ChevronDown, ChevronRight, ShieldCheck, Users, Bell, Fingerprint } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { startTotpEnrollment, finishTotpEnrollment } from '../auth/mfa';
import { getAuth, sendEmailVerification, multiFactor } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import useUserRole from './useUserRole';
import * as Clipboard from 'expo-clipboard';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const neonGradients = {
  card: ['#6491ebff', '#7676dbff'],
  button: ['#5aececff', '#62a8e5ff'],
  button2: ['#000001ff', '#000004ff'],
  warn: ['#faaa72ff', '#f68dc0ff'],
  input: ['#fad0c43f', '#ffd1ff4a'],
};

const gradients = {
  cardLight: ['#f9fbff', '#ffffff'],
  cardDark: ['#2b2e34', '#1f2126'],
  actionLight: ['#81D4FA', '#F8BBD9'],
  actionDark: ['#00c6ff', '#8E2DE2'],
  primaryLight: ['#90CAF9', '#81D4FA'],
  primaryDark: ['#00c6ff', '#0072ff'],
  warnLight: ['#FFCDD2', '#F8BBD9'],
  warnDark: ['#ff80ab', '#ff4081'],
  inputLight: ['#f0f2f5', '#ffffff'],
  inputDark: ['#3a3d44', '#2d3036'],
};

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { darkMode, setDarkMode } = useDarkMode();
  const { role } = useUserRole();
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;

  // ---------- STATE ----------
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [testNotifId, setTestNotifId] =  useState(null);

  const [mfa, setMfa] = useState(false);
  const [mfaEnrollOpen, setMfaEnrollOpen] = useState(false);
  const [otpauthUrl, setOtpauthUrl] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [manualKey, setManualKey] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const [digestOpen, setDigestOpen] = useState(false);

  const { activeChildId, activeChildName } = (() => {
    try {
      return useActiveChild();
    } catch {
      return { activeChildId: null, activeChildName: null };
    }
  })();

  // ---------- MFA: Start ----------
  const handleStartTotp = async () => {
    const user = getAuth().currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in again and try enabling MFA.');
      return;
    }
    try {
      setMfaBusy(true);
      await user.reload();
      if (!user.emailVerified) {
        Alert.alert(
          'Verify your email',
          'You need to verify your email before enabling two-step verification.',
          [
            { text: 'Not now' },
            {
              text: 'Resend email',
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

      const res = await startTotpEnrollment(user, {
        issuer: 'BabyTracker',
        displayName: 'Authenticator app',
      });
      setOtpauthUrl(res.otpauthUrl);

      // Try to extract manual key for users without QR scan
      try {
        const u = new URL(res.otpauthUrl);
        setManualKey(u.searchParams.get('secret'));
      } catch {
        const m = res.otpauthUrl.match(/[?&]secret=([^&]+)/i);
        setManualKey(m ? decodeURIComponent(m[1]) : null);
      }

      setMfaEnrollOpen(true);
    } catch (err) {
      console.warn('startTotpEnrollment error', err);
      Alert.alert('Couldn’t start two-step verification', 'Please try again.');
    } finally {
      setMfaBusy(false);
    }
  };

  // ---------- MFA: Finish ----------
  const handleFinishTotp = async () => {
    const user = getAuth().currentUser;
    if (!user) return;
    if (!/^\d{6}$/.test(totpCode.trim())) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your authenticator app.');
      return;
    }
    try {
      setMfaBusy(true);
      await finishTotpEnrollment(user, totpCode.trim());
      await user.reload();

      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, { MFAEnabled: true }, { merge: true });
      } else {
        await updateDoc(userRef, { MFAEnabled: true });
      }

      setMfa(true);
      setMfaEnrollOpen(false);
      setOtpauthUrl(null);
      setTotpCode('');
      Alert.alert('Two-step verification is on', 'Your authenticator app is now linked to your account.');
    } catch (err) {
      console.warn('finishTotpEnrollment error', err);
      Alert.alert('That code didn’t work', 'Enter the current 6-digit code and try again.');
    } finally {
      setMfaBusy(false);
    }
  };

  // ---------- MFA: Disable ----------
  const disableTotpServerSide = async () => {
    const u = auth.currentUser;
    if (!u) throw new Error('Not signed in');
    await u.getIdToken(true);
    const fns = getFunctions(app, 'us-central1');
    const unenroll = httpsCallable(fns, 'authUnenrollAllTotp');
    const res = await unenroll({});
    await u.reload();
    return res?.data;
  };

  const handleDisableTotp = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in again and try disabling MFA.');
      return;
    }
    try {
      setMfaBusy(true);
      await user.reload();

      const before = multiFactor(user).enrolledFactors || [];
      const totpFactors = before.filter(f => f.factorId === 'totp');

      if (totpFactors.length === 0) {
        await disableTotpServerSide();
      } else {
        for (const f of totpFactors) {
          await multiFactor(user).unenroll(f.uid);
        }
      }

      await updateDoc(doc(db, 'users', user.uid), { MFAEnabled: false });
      setMfa(false);
      setMfaEnrollOpen(false);
      setOtpauthUrl(null);
      setTotpCode('');
      Alert.alert('MFA disabled', 'Authenticator removed from your account.');
    } catch (e) {
      if (e?.code === 'auth/requires-recent-login') {
        Alert.alert('Please sign in again', 'For your security, sign out and back in to make this change.');
      } else {
        Alert.alert('Couldn’t turn off two-step verification', 'Please try again in a moment.');
      }
      setMfa(true);
    } finally {
      setMfaBusy(false);
    }
  };

  // ---------- Notifications helpers ----------
  const sendTestNotification = async () => {
    const granted = await NotificationService.requestNotificationPermission();
    if (!granted) return;
    const name = activeChildName || 'your child';
    const body = `Test digest for ${name}: this message arrives in ~2 minutes.`;
    const id = await NotificationService.scheduleImmediateTestNotification(body, 2);
    if (id) setTestNotifId(String(id));
  };

  const cancelTestNotification = async () => {
    if (!testNotifId) return;
    await NotificationService.cancelScheduledNotification(testNotifId);
    setTestNotifId(null);
  };

  const showThrottle = async () => {
    try {
      if (!activeChildId) {
        Alert.alert('No active child', 'Set an active child before checking throttle.');
        return;
      }
      const key = `digestNotifiedTimes:${activeChildId}`;
      const val = await AsyncStorage.getItem(key);
      if (!val) {
        Alert.alert('Throttle', 'No throttle entry found for child');
        return;
      }
      let arr = [];
      try { arr = JSON.parse(val) || []; } catch { arr = []; }
      if (!arr.length) {
        Alert.alert('Throttle', 'No timestamps stored');
        return;
      }
      const when = new Date(arr[arr.length - 1]).toLocaleString();
      Alert.alert('Throttle', `Last notified: ${when} (count=${arr.length})`);
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  };

  const clearThrottle = async () => {
    try {
      if (!activeChildId) {
        Alert.alert('No active child', 'Set an active child before clearing throttle.');
        return;
      }
      const key = `digestNotifiedTimes:${activeChildId}`;
      await AsyncStorage.removeItem(key);
      Alert.alert('Throttle cleared', `Removed ${key}`);
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  };

  const forceSendDigest = async () => {
    try {
      if (!activeChildId) {
        Alert.alert('No active child', 'Select an active child first.');
        return;
      }
      const id = await NotificationService.sendDigestNotificationForChild(activeChildId, { force: true });
      if (id) Alert.alert('Notification scheduled', `id=${id}`);
      else Alert.alert('No notification sent', 'Throttled or no data available for digest');
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  };

  // ---------- Load saved settings ----------
  useEffect(() => {
    (async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setWeeklyDigest(!!data?.settings?.notifications?.weeklyDigest);
          setMfa(!!data?.MFAEnabled);
        }
      } catch (e) {
        console.error('load settings', e);
      }
    })();
  }, []);

  // ---------- UI helpers ----------
  const Card = ({ children }) => (
    <LinearGradient
      colors={darkMode ? gradients.cardDark : gradients.cardLight}
      style={styles.card}
    >
      {children}
    </LinearGradient>
  );

  const SectionTitle = ({ icon, text }) => (
    <View style={styles.sectionTitleRow}>
      {icon}
      <Text style={[styles.sectionTitle, { color: currentTheme.textPrimary }]}>{text}</Text>
    </View>
  );

  const toggleDigestOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDigestOpen(v => !v);
  };
  
    // --- Restore Backup Handler ---
  const handleRestoreBackup = async () => {
  setRestoreLoading(true);
  try {
    const response = await fetch('http://10.73.180.149:5001/restore-backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: "test_user" }) // send a user_id to match Flask route
    });

    if (!response.ok) {
      throw new Error('Backup restore failed.');
    }

    const data = await response.json();
    if (data.success) {
      Alert.alert('Backup restored', data.message || 'Your local data has been restored.');
    } else {
      throw new Error(data.error || 'Backup restore failed.');
    }
  } catch (e) {
    Alert.alert('Error', e.message || 'Could not restore backup.');
  } finally {
    setRestoreLoading(false);
  }
};

  return (
    <ThemedBackground>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <LinearGradient
            colors={darkMode ? ['#1f1e1eff', '#323233ff'] : gradients.cardLight}
            style={styles.headerButtonGradient}
          >
            <ArrowLeft size={20} color={darkMode ? '#fff' : '#2E3A59'} />
          </LinearGradient>
          </TouchableOpacity>

          <View style={styles.logoWrapper}>
            <Image source={require('../assets/logo.png')} style={styles.logo} />
          </View>

          <TouchableOpacity style={styles.signOutButton} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* ---------- 1) Dark Mode ---------- */}
        <SectionTitle icon={<Fingerprint size={18} color={currentTheme.textPrimary} />} text="App Preferences" />
        <Card>
          <View style={styles.row}>
            <Text style={[styles.rowText, { color: currentTheme.textPrimary }]}>Dark Mode</Text>
            <Switch value={darkMode} onValueChange={setDarkMode} />
          </View>
        </Card>

        {/* ---------- 2) MFA ---------- */}
        <SectionTitle icon={<ShieldCheck size={18} color={currentTheme.textPrimary} />} text="Security" />
        <Card>
          <View style={styles.row}>
            <Text style={[styles.rowText, { color: currentTheme.textPrimary }]}>Multi-Factor Authentication</Text>
            <Switch
              value={mfa}
              onValueChange={async (val) => {
                setMfa(val);
                const user = auth.currentUser;
                if (!user) return;
                if (!val) {
                  await handleDisableTotp();
                } else {
                  // mark flag; actual enrollment below
                  try { await updateDoc(doc(db, 'users', user.uid), { MFAEnabled: true }); } catch {}
                }
              }}
            />
          </View>

          {/* MFA Enrollment block */}
          {mfa && !mfaEnrollOpen && (
            <TouchableOpacity
              onPress={handleStartTotp}
              disabled={mfaBusy}
              activeOpacity={0.9}
              style={styles.fullWidthButton}
            >
              <LinearGradient
                colors={darkMode ? gradients.primaryDark : gradients.primaryLight}
                style={styles.fullWidthGradient}
              >
                {mfaBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.fullWidthText}>Set up Authenticator (TOTP)</Text>}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {mfa && mfaEnrollOpen && (
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={[styles.helperText, { color: currentTheme.textSecondary }]}>
                Scan this QR code with your authenticator app, then enter the 6-digit code below.
              </Text>

              {otpauthUrl ? (
                <View style={styles.qrBox}>
                  <QRCode value={otpauthUrl} size={180} />
                </View>
              ) : (
                <Text style={[styles.helperText, { color: currentTheme.textSecondary }]}>Generating QR…</Text>
              )}

              {!!manualKey && (
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      await Clipboard.setStringAsync(manualKey);
                      Alert.alert('Copied', 'Setup key copied to clipboard.');
                    } catch (e) {
                      Alert.alert('Copy failed', e?.message || 'Please try again.');
                    }
                  }}
                  style={styles.copyKey}
                  activeOpacity={0.9}
                >
                  <Text style={styles.copyKeyText}>Copy setup key</Text>
                </TouchableOpacity>
              )}

              <TextInput
                placeholder="123456"
                placeholderTextColor={currentTheme.textSecondary}
                keyboardType="number-pad"
                maxLength={6}
                value={totpCode}
                onChangeText={(t) => setTotpCode(t.replace(/\D/g, ''))}
                style={[
                  styles.codeInput,
                  { borderColor: darkMode ? '#5b5f66' : '#e6d6ef' }
                ]}
              />

              <View style={styles.dualRow}>
                <TouchableOpacity
                  onPress={handleFinishTotp}
                  disabled={mfaBusy || !/^\d{6}$/.test(totpCode)}
                  style={[styles.dualBtn, { opacity: mfaBusy || !/^\d{6}$/.test(totpCode) ? 0.6 : 1 }]}
                  activeOpacity={0.9}
                >
                  <LinearGradient colors={darkMode ? gradients.warnDark : gradients.warnLight} style={styles.dualGrad}>
                    {mfaBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.dualText}>Confirm</Text>}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { setMfaEnrollOpen(false); setOtpauthUrl(null); setTotpCode(''); }}
                  disabled={mfaBusy}
                  style={[styles.dualBtn, { opacity: mfaBusy ? 0.6 : 1 }]}
                  activeOpacity={0.9}
                >
                  <LinearGradient colors={darkMode ? gradients.primaryDark : gradients.primaryLight} style={styles.dualGrad}>
                    <Text style={styles.dualText}>Cancel</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>

        {/* ---------- 3) Caregiver ---------- */}
        <SectionTitle icon={<Users size={18} color={currentTheme.textPrimary} />} text="Caregiver" />
        <Card>
          {role === 'parent' ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('ManageCaregivers')}
              style={styles.rowNav}
              activeOpacity={0.8}
            >
              <Text style={[styles.rowText, { color: currentTheme.textPrimary }]}>Manage Caregivers</Text>
              <ChevronRight size={18} color={currentTheme.textSecondary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate('AcceptInvite')}
              style={styles.rowNav}
              activeOpacity={0.8}
            >
              <Text style={[styles.rowText, { color: currentTheme.textPrimary }]}>Enter Invite Code</Text>
              <ChevronRight size={18} color={currentTheme.textSecondary} />
            </TouchableOpacity>
          )}
        </Card>

        {/* ---------- 4) Weekly Digest ---------- */}
        <SectionTitle icon={<Bell size={18} color={currentTheme.textPrimary} />} text="Notifications" />
        <Card>
          <View style={styles.row}>
            <Text style={[styles.rowText, { color: currentTheme.textPrimary }]}>Weekly Digest Notifications</Text>
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
                    setTestNotifId(null);
                  }
                } catch (e) {
                  console.error('save weeklyDigest', e);
                }
              }}
            />
          </View>

          {/* Inline test button when enabled */}
          {weeklyDigest && (
            <TouchableOpacity
              onPress={testNotifId ? cancelTestNotification : sendTestNotification}
              activeOpacity={0.9}
              style={styles.inlineBtn}
            >
              <LinearGradient
                colors={darkMode ? gradients.primaryDark : gradients.primaryLight}
                style={styles.inlineGrad}
              >
                <Text style={styles.inlineText}>
                  {testNotifId ? 'Cancel Test Notification' : 'Send Test Notification (2m)'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </Card>

        {/* ---------- 5) Digest Controls (Collapsible) ---------- */}
        <Card>
          <TouchableOpacity onPress={toggleDigestOpen} style={styles.rowNav} activeOpacity={0.8}>
            <Text style={[styles.rowText, { color: currentTheme.textPrimary }]}>Digest Controls</Text>
            {digestOpen ? (
              <ChevronDown size={18} color={currentTheme.textSecondary} />
            ) : (
              <ChevronRight size={18} color={currentTheme.textSecondary} />
            )}
          </TouchableOpacity>

          {digestOpen && (
            <View style={{ marginTop: 10, gap: 10 }}>
              <TouchableOpacity onPress={showThrottle} activeOpacity={0.9} style={styles.inlineBtn}>
                <LinearGradient colors={darkMode ? gradients.primaryDark : gradients.primaryLight} style={styles.inlineGrad}>
                  <Text style={styles.inlineText}>Show Digest Throttle</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={clearThrottle} activeOpacity={0.9} style={styles.inlineBtn}>
                <LinearGradient colors={darkMode ? gradients.warnDark : gradients.warnLight} style={styles.inlineGrad}>
                  <Text style={styles.inlineText}>Clear Digest Throttle</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={forceSendDigest} activeOpacity={0.9} style={styles.inlineBtn}>
                <LinearGradient colors={darkMode ? gradients.primaryDark : gradients.primaryLight} style={styles.inlineGrad}>
                  <Text style={styles.inlineText}>Force Send Digest</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </Card>

		{/* ---------- 0) Restore Backup ---------- */}
			  <LinearGradient colors={neonGradients.card} style={styles.settingCard}>
				<Text style={[styles.settingTitle, { color: currentTheme.text }]}>Restore Backup</Text>
				<TouchableOpacity
				  style={[styles.button, restoreLoading && { opacity: 0.6 }]}
				  onPress={handleRestoreBackup}
				  disabled={restoreLoading}
				>
				  {restoreLoading ? (
					<ActivityIndicator color="#fff" />
				  ) : (
					<Text style={styles.buttonText}>Restore Backup</Text>
				  )}
				</TouchableOpacity>
			  </LinearGradient>

        {/* ---------- 6) Change Password ---------- */}
        <SectionTitle icon={<Fingerprint size={18} color={currentTheme.textPrimary} />} text="Change Password" />
        <Card>
          {['Current Password', 'New Password', 'Confirm New Password'].map((ph, i) => (
            <LinearGradient
              key={i}
              colors={darkMode ? gradients.inputDark : gradients.inputLight}
              style={styles.inputWrap}
            >
              <TextInput
                placeholder={ph}
                placeholderTextColor={darkMode ? '#b5b8bf' : '#7C8B9A'}
                secureTextEntry
                style={styles.input}
              />
            </LinearGradient>
          ))}

          <TouchableOpacity activeOpacity={0.9} style={styles.fullWidthButton}>
            <LinearGradient colors={darkMode ? gradients.warnDark : gradients.warnLight} style={styles.fullWidthGradient}>
              <Text style={styles.fullWidthText}>Reset Password</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </ThemedBackground>
	
      

  );
}

const styles = StyleSheet.create({
  container: {
     flexGrow: 1,
      padding: 18, 
      gap: 14, 
      paddingTop: 12
    },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 40,
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  headerButton: { 
    borderRadius: 14, 
    overflow: 'hidden' 
  },
  headerButtonGradient: {
    paddingHorizontal: 12,
     paddingVertical: 10, 
     borderRadius: 14, 
     alignItems: 'center', 
     justifyContent: 'center',
  },
  logoWrapper: { 
    position: 'absolute',
     left: 0, 
     right: 0, 
     alignItems: 'center',
     },
  logo: { 
    width: 60, 
    height: 60, 
    resizeMode: 'contain', 
  },
  signOutButton: {
    backgroundColor: '#ffffffdd',
     paddingVertical: 8,
      paddingHorizontal: 14,
       borderRadius: 12,
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 4, 
    elevation: 2,
  },
  signOutText: { 
    color: '#333',
     fontSize: 14,
      fontWeight: '700',
     },

  sectionTitleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
     marginTop: 4,
      marginBottom: 6, 
      paddingHorizontal: 2,
     },
  sectionTitle: {
     fontSize: 16, 
     fontWeight: '800', 
     letterSpacing: 0.2,
     },

  card: {
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
 row: { 
    flexDirection: 'row',          
    alignItems: 'center',            
    justifyContent: 'space-between',
    paddingVertical: 6,              
    },
  rowNav: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
   },
rowText: {
  fontSize: 16,
  fontWeight: '600',
  lineHeight: 20,  
  flexShrink: 1,    
  marginRight: 10,  
},
  helperText: {
    fontSize: 13,
     textAlign: 'center',
     marginBottom: 10,
     },
  qrBox: { 
    padding: 12,
     backgroundColor: '#fff', 
     borderRadius: 12,
      marginBottom: 8, 
      elevation: 2,
     },
  copyKey: {
     backgroundColor: '#81D4FA',
      borderRadius: 8,
       paddingVertical: 8, 
       paddingHorizontal: 12,
        marginTop: 6,
       },
  copyKeyText: { 
    color: '#fff', 
    fontWeight: '700',
   },

  codeInput: {
    width: '100%',
    backgroundColor: '#f8d6f8ff',
    color: '#000',
    borderRadius: 10,
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 4,
    marginTop: 6,
    borderWidth: 1,
  },

  dualRow: { 
    flexDirection: 'row',
    gap: 10, 
    marginTop: 10,
   },
  dualBtn: { 
    flex: 1, 
    borderRadius: 12,
     overflow: 'hidden',
     },
  dualGrad: { 
    paddingVertical: 12, 
    alignItems: 'center',
     borderRadius: 12,
     },
  dualText: { 
    color: '#fff', 
    fontWeight: '800',
   },

  fullWidthButton: {
     borderRadius: 14, 
     overflow: 'hidden', 
     marginTop: 12,
     },
  fullWidthGradient: {
     paddingVertical: 14,
      alignItems: 'center',
     borderRadius: 14,
     },
  fullWidthText: {
     color: '#fff', 
     fontWeight: '800',
     },

  inlineBtn: { 
    borderRadius: 12, 
    overflow: 'hidden',
     marginTop: 10,
  },
  inlineGrad: { 
    paddingVertical: 12,
     alignItems: 'center', 
     borderRadius: 12,
     },
  inlineText: { 
    color: '#fff', 
    fontWeight: '700',
   },

  inputWrap: { 
    borderRadius: 14, 
    paddingHorizontal: 1, 
    marginVertical: 6 },
  input: { 
    paddingHorizontal: 14, 
    paddingVertical: 12, 
    fontSize: 15, 
    color: '#333',
   },
});
