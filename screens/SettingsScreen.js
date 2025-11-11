// SettingsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Switch, TextInput, StyleSheet, ScrollView, Image, Alert, StatusBar, ActivityIndicator, LayoutAnimation, Platform, UIManager, KeyboardAvoidingView, } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db, app } from '../firebaseConfig';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import NotificationService from '../src/notifications/notificationService';
import { summaryRepository } from '../src/data/summaryRepository';
import { useActiveChild } from '../src/contexts/ActiveChildContext';
import { Moon, Handshake, ArrowLeft, ChevronDown, ChevronRight, ShieldCheck, Users, Bell, Lock } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { startTotpEnrollment, finishTotpEnrollment } from '../auth/mfa';
import { getAuth, sendEmailVerification, multiFactor } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import useUserRole from './useUserRole';
import * as Clipboard from 'expo-clipboard';
import { RefreshCcw } from 'lucide-react-native';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import * as Network from 'expo-network';
import { Keyboard, InputAccessoryView, Button } from 'react-native'; // iOS accessory



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
const Card = React.memo(function Card({ children, darkMode }) {
  return (
    <LinearGradient
      colors={darkMode ? ['#2b2e34', '#1f2126'] : ['#f9fbff', '#ffffff']}
      style={styles.card}
    >
      {children}
    </LinearGradient>
  );
});

const SectionTitle = React.memo(function SectionTitle({ icon, text, color }) {
  return (
    <View style={styles.sectionTitleRow}>
      {icon}
      <Text style={[styles.sectionTitle, { color }]}>{text}</Text>
    </View>
  );
});

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

  const totpInputRef = React.useRef(null);
  const [totpFocused, setTotpFocused] = useState(false);

  const [digestOpen, setDigestOpen] = useState(false);

  const accessoryId = 'totpAccessory';

  const { activeChildId, activeChildName } = (() => {
    try {
      return useActiveChild();
    } catch {
      return { activeChildId: null, activeChildName: null };
    }
  })();

    useEffect(() => {
    if (mfaEnrollOpen) {
      const t = setTimeout(() => totpInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [mfaEnrollOpen]);

      // --- App Tour handlers ---
    const handleViewTour = () => {
      navigation.navigate('WelcomeTour', { from: 'settings' });
    };

 const handleResetTour = async () => {
  Alert.alert(
    "Reset App Tour",
    "You’ll see the welcome tour again on your next login.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "default",
        onPress: async () => {
          try {
            const user = getAuth().currentUser;
            if (!user) {
              Alert.alert('Not signed in', 'Please sign in to reset the tour.');
              return;
            }
            await updateDoc(doc(db, 'users', user.uid), { hasSeenWelcome: false });
            Alert.alert("Success", "Tour will show again next time you log in!");
          } catch (e) {
            console.error(e);
            Alert.alert("Error", "Could not reset tour flag.");
          }
        }
      }
    ]
  );
};

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
                  try { await sendEmailVerification(user); Alert.alert('Sent', 'Verification email sent.'); }
                  catch (e) { Alert.alert('Error', e?.message ?? 'Could not send verification email.'); }
                },
              },
            ]
          );
          return;
        }

        // Some builds return { otpauthUrl }, others return an object with .otpauthUrl.
        const res = await startTotpEnrollment(user, { issuer: 'BabyTracker', displayName: 'Authenticator app' });
        const url = res?.otpauthUrl || res; // be robust
        setOtpauthUrl(url);

        // Parse manual key for fallback entry
        try {
          let secret = null;
          try { secret = new URL(url).searchParams.get('secret'); }
          catch {
            const m = String(url).match(/[?&]secret=([^&]+)/i);
            secret = m ? decodeURIComponent(m[1]) : null;
          }
          setManualKey(secret);
        } catch { setManualKey(null); }

        setMfaEnrollOpen(true);
      } catch (err) {
        console.warn('startTotpEnrollment error', err);
        Alert.alert('Couldn’t start two-step verification', 'Please try again. If this keeps happening, sign out and back in.');
      } finally {
        setMfaBusy(false);
      }
    };

    const hasEnrolledTotp = async (user) => {
      if (!user) return false;
      await user.reload();
      const factors = (multiFactor(user).enrolledFactors || []).filter(f => f.factorId === 'totp');
      return factors.length > 0;
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
        if (!snap.exists()) await setDoc(userRef, { MFAEnabled: true }, { merge: true });
        else await updateDoc(userRef, { MFAEnabled: true });

        setMfa(true);
        setMfaEnrollOpen(false);
        setOtpauthUrl(null);
        setTotpCode('');
        Alert.alert('Two-step verification is on', 'Your authenticator app is now linked to your account.');
      } catch (err) {
        console.warn('finishTotpEnrollment error', err);
        Alert.alert('That code didn’t work', 'Open your authenticator app and enter the current 6-digit code, then try again.');
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

const getEnrolledTotpCount = async (user) => {
  await user.reload();
  const factors = (multiFactor(user).enrolledFactors || []);
  return factors.filter(f => f.factorId === 'totp').length;
};

const cancelInProgressEnrollment = async () => {
  setMfaEnrollOpen(false);
  setOtpauthUrl(null);
  setTotpCode('');
  setManualKey(null);
  setMfa(false);
  const u = auth.currentUser;
  if (u) {
    try { await updateDoc(doc(db, 'users', u.uid), { MFAEnabled: false }); } catch {}
  }
};

// Unenroll ALL TOTP factors (no code required)
const disableTotpNoCode = async () => {
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');
  await u.reload();

  const all = (multiFactor(u).enrolledFactors || []);
  const totpFactors = all.filter(f => f.factorId === 'totp');

  if (totpFactors.length === 0) {
    try { await updateDoc(doc(db, 'users', u.uid), { MFAEnabled: false }); } catch {}
    setMfa(false);
    return;
  }

  for (const f of totpFactors) {
    await multiFactor(u).unenroll(f);
  }
  await u.reload();
  try { await updateDoc(doc(db, 'users', u.uid), { MFAEnabled: false }); } catch {}

  // reset local UI
  setMfa(false);
  setMfaEnrollOpen(false);
  setOtpauthUrl(null);
  setTotpCode('');
  setManualKey(null);
};
// Confirm → unenroll all TOTP 
// returns: 'success' | 'failed' | 'cancel'
const promptDisableMfa = async () => {
  return await new Promise((resolve) => {
    Alert.alert(
      'Turn off two-step verification?',
      'This will remove your authenticator app from this account.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: async () => {
            try {
              await disableTotpNoCode();  
              resolve('success');
            } catch (e) {
              console.warn('disableTotpNoCode error', e);
              Alert.alert('Couldn’t turn off', e?.message || 'Please try again.');
              resolve('failed');
            }
          },
        },
      ]
    );
  });
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


  const toggleDigestOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDigestOpen(v => !v);
  };
  
	// --- Restore Backup Handler (Auto-detect IP) ---
	const handleRestoreBackup = async () => {
	  console.log('Restore button pressed ');

	  const user = getAuth().currentUser;
	  if (!user?.uid) {
		Alert.alert('Error', 'User not signed in. Cannot restore backup.');
		return;
	  }

	  setRestoreLoading(true);

	  try {
		// List of possible local IPs to try
		const possibleIps = [];

		// Try to detect current IP
		try {
		  const networkState = await Network.getNetworkStateAsync();
		  const ip = await Network.getIpAddressAsync();
		  if (ip) possibleIps.push(ip);
		} catch (err) {
		  console.warn('Could not detect network IP:', err);
		}

		// Common local network ranges
		possibleIps.push('192.168.1.68'); // replace with your dev machine if known
		possibleIps.push('192.168.0.68');
		possibleIps.push('10.0.0.68');
		possibleIps.push('10.220.25.68');
		possibleIps.push('127.0.0.1'); // fallback

		console.log('Trying IPs in order:', possibleIps);

		let success = false;
		let lastError = null;

		for (const ip of possibleIps) {
		  const url = `http://${ip}:5001/restore-backup`;
		  console.log('Trying backend URL:', url);

		  try {
			// Fetch with timeout (5 seconds)
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 5000);

			const response = await fetch(url, {
			  method: 'POST',
			  headers: { 'Content-Type': 'application/json' },
			  body: JSON.stringify({ user_id: user.uid }),
			  signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
			  const data = await response.json().catch(() => ({}));
			  throw new Error(data.error || `Server returned status ${response.status}`);
			}

			const data = await response.json();
			if (!data.success) throw new Error(data.error || 'Backup restore failed.');

			console.log('Restore succeeded with IP:', ip, 'Response:', data);
			Alert.alert('Backup restored', 'Backup restored successfully.');
			success = true;
			break; // stop trying further IPs
		  } catch (err) {
			console.warn('Failed with IP', ip, err.message || err);
			lastError = err;
		  }
		}

		if (!success) {
		  throw lastError || new Error('All attempts to connect failed.');
		}
	  } catch (e) {
		console.error('Restore error:', e);
		Alert.alert('Error', e.message || 'Could not restore backup.');
	  } finally {
		setRestoreLoading(false);
	  }
	};


  return (
    <ThemedBackground>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0} 
        style={{ flex: 1 }}
      >
      <ScrollView 
        contentContainerStyle={styles.container} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        nestedScrollEnabled={true}
      >
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

            <TouchableOpacity
              style={[
                styles.signOutButton,
                darkMode && {
                  backgroundColor: '#323233ff',      
                  shadowOpacity: 0.2,
                },
              ]}
              onPress={() => navigation.navigate('Login')}
            >
              <Text
                style={[styles.signOutText, darkMode && { color: '#ffffff' } ]}>
                Sign out
              </Text>
            </TouchableOpacity>
          </View>

          {/* ---------- 1) Dark Mode ---------- */}
          <SectionTitle icon={<Moon size={18} color={currentTheme.textPrimary} />} text="App Preferences" color={currentTheme.textPrimary}/>
          <Card darkMode={darkMode}> 
            <View style={styles.row}>
              <Text style={[styles.rowText, { color: currentTheme.textPrimary }]}>Dark Mode</Text>
              <Switch value={darkMode} onValueChange={setDarkMode} />
            </View>
          </Card>
          {/* ---------- App Tour ---------- */}
          <SectionTitle icon={<Handshake size={18} color={currentTheme.textPrimary} />} text="App Tour" color={currentTheme.textPrimary}/>
          <Card darkMode={darkMode}> 
            <TouchableOpacity
              onPress={handleViewTour}
              style={styles.rowNav}
              activeOpacity={0.8}
            >
              <Text style={[styles.rowText, { color: currentTheme.textPrimary }]}>
                View App Tour
              </Text>
              <ChevronRight size={18} color={currentTheme.textSecondary} />
            </TouchableOpacity>

            <View style={{ height: 10 }} />
            <TouchableOpacity
              onPress={handleResetTour}
              activeOpacity={0.9}
              style={styles.tourButton}
            >
              <LinearGradient
                colors={darkMode ? gradients.primaryDark : gradients.primaryLight}
                style={styles.tourButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.tourButtonText}>Reset “Seen Tour”</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Card>

          {/* ---------- 2) MFA ---------- */}
          <SectionTitle icon={<ShieldCheck size={18} color={currentTheme.textPrimary} />} text="Security" color={currentTheme.textPrimary} />
          <Card darkMode={darkMode}> 
            <View style={styles.row}>
              <Text style={[styles.rowText, { color: currentTheme.textPrimary }]}>Multi-Factor Authentication</Text>
            <Switch
              value={mfa}
              onValueChange={async (val) => {
                const user = auth.currentUser;

                if (!val) {
                  if (!user) { setMfa(false); return; }

                  // If not enrolled, just cancel setup and flip OFF
                  const enrolled = await hasEnrolledTotp(user);
                  if (!enrolled) {
                    await cancelInProgressEnrollment(); // optional reuse
                    return;
                  }

                  // If enrolled, confirm and unenroll (no code)
                  const outcome = await promptDisableMfa(); // 'success' | 'failed' | 'cancel'
                  if (outcome === 'success') setMfa(false);
                  else setMfa(true); // keep ON if canceled/failed
                  return;
                }

                // Turning ON → set flag; user taps the "Set up Authenticator" button next
                setMfa(true);
                if (user) { try { await updateDoc(doc(db, 'users', user.uid), { MFAEnabled: true }); } catch {} }
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
                {Platform.OS === 'ios' && (
          <InputAccessoryView nativeID={accessoryId}>
            <View style={{ alignItems: 'flex-end', padding: 8, backgroundColor: '#EFEFF4' }}>
              <Button title="Done" onPress={() => totpInputRef.current?.blur()} />
            </View>
          </InputAccessoryView>
        )}

        {mfa && mfaEnrollOpen && (
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <Text style={[styles.helperText, { textAlign: 'center' }]}>
              Scan this QR code or enter the setup key in your authenticator app, then enter the 6-digit code below.
            </Text>

              {otpauthUrl ? (
                <View style={styles.qrBox}><QRCode value={otpauthUrl} size={180} /></View>
              ) : (
                <Text style={styles.helperText}>Generating QR…</Text>
              )}

            {!!manualKey && (
              <View style={styles.manualBox}>
                <Text style={[styles.manualLabel, { color: currentTheme.textSecondary }]}>
                  Can’t scan the QR code?
                </Text>

                <Text style={[styles.manualKeyText, { color: currentTheme.textPrimary }]}>
                  {manualKey}
                </Text>

                <TouchableOpacity
                  onPress={async () => {
                    try {
                      await Clipboard.setStringAsync(manualKey);
                      Alert.alert('Copied', 'Setup key copied to clipboard.');
                    } catch (e) {
                      Alert.alert('Copy failed', e?.message || 'Please try again.');
                    }
                  }}
                  style={styles.manualCopyBtn}
                  activeOpacity={0.9}
                >
                  <Text style={styles.manualCopyText}>Copy Setup Key</Text>
                </TouchableOpacity>
              </View>
            )}

              <TextInput
                ref={totpInputRef}
                style={styles.codeInput}
                placeholder="123456"
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChangeText={(t) => setTotpCode(t.replace(/\D/g, ''))}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                autoCorrect={false}
                autoCapitalize="none"
                secureTextEntry={false}

                // iOS toolbar
                {...(Platform.OS === 'ios' ? { inputAccessoryViewID: accessoryId } : {})}

                // Android "Done" dismiss
                returnKeyType={Platform.OS === 'android' ? 'done' : undefined}
                onSubmitEditing={() => Keyboard.dismiss()}
              />

                <View style={styles.dualRow}>
                  <TouchableOpacity
                    onPress={handleFinishTotp}
                    disabled={mfaBusy || !/^\d{6}$/.test(totpCode)}
                    style={[styles.dualBtn, { opacity: (mfaBusy || !/^\d{6}$/.test(totpCode)) ? 0.6 : 1 }]}
                    activeOpacity={0.9}
                  >
             <LinearGradient colors={darkMode ? gradients.warnDark : gradients.warnLight} style={styles.dualGrad}>
                      {mfaBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.dualText}>Confirm</Text>}
                    </LinearGradient>
                          </TouchableOpacity>

                      <TouchableOpacity
                      onPress={() => { 
                        setMfaEnrollOpen(false);
                        setOtpauthUrl(null);
                        setTotpCode(''); 
                        setManualKey(null);
                        setMfa(false);       
                      }}
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
            <SectionTitle icon={<Users size={18} color={currentTheme.textPrimary} />} text="Caregiver" color={currentTheme.textPrimary}/>
            <Card darkMode={darkMode}> 
              {role === 'parent' ? (
                <TouchableOpacity
                  onPress={() => navigation.navigate('ManageCaregivers')}
                  style={styles.rowNav}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.rowText, { color: currentTheme.textPrimary }]}>Manage Caregivers</Text>
                  <ChevronRight size={18} color={currentTheme.textPrimary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => navigation.navigate('AcceptInvite')}
                  style={styles.rowNav}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.rowText, { color: currentTheme.textPrimary }]}>Enter Invite Code</Text>
                  <ChevronRight size={18} color={currentTheme.textPrimary} />
                </TouchableOpacity>
              )}
            </Card>

          {/* ---------- 4) Weekly Digest ---------- */}
          <SectionTitle icon={<Bell size={18} color={currentTheme.textPrimary} />} text="Notifications" color={currentTheme.textPrimary}/>
          <Card darkMode={darkMode}> 
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
         <Card darkMode={darkMode}> 
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

			{/* ---------- Reminders Button (Styled) ---------- */}
			<Card darkMode={darkMode}> 
			  <TouchableOpacity
				style={styles.fullWidthButton}
				onPress={() => navigation.navigate('RegularReminders')}
			  >
				<LinearGradient
				  colors={darkMode ? gradients.primaryDark : gradients.primaryLight}
				  style={styles.fullWidthGradient}
				>
				  <Text style={styles.fullWidthText}>Reminders</Text>
				</LinearGradient>
			  </TouchableOpacity>
			</Card>

          {/* ---------- Restore Data ---------- */}
          <SectionTitle 
            icon={<RefreshCcw size={18} color={currentTheme.textPrimary} />} 
            text="Restore Data" 
            color={currentTheme.textPrimary}
          />

          <Card darkMode={darkMode}> 
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleRestoreBackup}
              disabled={restoreLoading}
              style={{ opacity: restoreLoading ? 0.7 : 1 }}
            >
              <LinearGradient
                colors={darkMode ? gradients.warnDark : gradients.warnLight}
                style={styles.fullWidthGradient}
              >
                {restoreLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.fullWidthText}>Restore Data</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Card>

          {/* ---------- 6) Change Password ---------- */}
          <SectionTitle icon={<Lock size={18} color={currentTheme.textPrimary} />} text="Password & Account" color={currentTheme.textPrimary}/>
          <Card darkMode={darkMode}> 
            <TouchableOpacity
              onPress={() => navigation.navigate('ChangePassword')}
              style={styles.rowNav}
              activeOpacity={0.8}
            >
              <Text style={[styles.rowText, { color: currentTheme.textPrimary }]}>Change Password</Text>
              <ChevronRight size={18} color={currentTheme.textSecondary} />
            </TouchableOpacity>
          </Card>

          {/* Bottom padding for scrolling */}
          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 18, 
    gap: 14, 
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 50,
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
  //manual key
  manualBox: {
  width: '100%',
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 14,
  marginTop: 10,
  alignItems: 'center',
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 2,
},

manualLabel: {
  fontSize: 14,
  marginBottom: 6,
  textAlign: 'center',
},

manualKeyText: {
  fontSize: 18,
  letterSpacing: 2,
  fontWeight: '700',
  marginBottom: 10,
  textAlign: 'center',
},

manualCopyBtn: {
  backgroundColor: '#81D4FA',
  borderRadius: 8,
  paddingVertical: 8,
  paddingHorizontal: 14,
},

manualCopyText: {
  color: '#fff',
  fontWeight: '700',
  fontSize: 14,
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
  tourButton: {
  borderRadius: 14,
  overflow: 'hidden',
  alignSelf: 'center',
  width: '100%',
  marginTop: 4,
},
tourButtonGradient: {
  paddingVertical: 14,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 14,
},
tourButtonText: {
  color: '#fff',
  fontWeight: '700',
  fontSize: 15,
  letterSpacing: 0.3,
},
});
