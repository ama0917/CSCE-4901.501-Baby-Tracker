// screens/AcceptInvite.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { doc, getDoc, setDoc, updateDoc, writeBatch, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';

export default function AcceptInvite({ navigation }) {
  const auth = getAuth();
  const { darkMode } = useDarkMode();
  const theme = typeof appTheme === 'function'
    ? appTheme(darkMode)
    : darkMode
      ? appTheme.dark
      : appTheme.light;

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAccept = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in first.');
      return;
    }
    const trimmed = code.trim();
    if (!trimmed) {
      Alert.alert('Missing code', 'Enter the invite code.');
      return;
    }

    try {
      setSubmitting(true);

      const inviteRef = doc(db, 'invites', trimmed);
      const snap = await getDoc(inviteRef);
      if (!snap.exists()) {
        Alert.alert('Invalid code', 'No invite found for that code.');
        return;
      }

      const invite = snap.data() || {};
      if (invite.status !== 'pending') {
        Alert.alert('Unavailable', `Invite is ${invite.status || 'not pending'}.`);
        return;
      }

      const childIds = Array.isArray(invite.childIds)
        ? invite.childIds
        : invite.childId
        ? [invite.childId]
        : [];

      if (childIds.length === 0) {
        Alert.alert('No children on invite', 'Ask the parent to resend the invite.');
        return;
      }

      const caregiverUid = user.uid;
      const batch = writeBatch(db);

      // link caregiver to each child (default OFF; parent must toggle ON)
      for (const cid of childIds) {
        const childRef = doc(db, 'children', cid);
        batch.update(childRef, {
          caregivers: arrayUnion(caregiverUid),
          [`caregiverPerms.${caregiverUid}`]: 'off',
        });
      }

      // mark invite accepted
      batch.update(inviteRef, {
        status: 'accepted',
        acceptedBy: caregiverUid,
        acceptedAt: serverTimestamp(),
      });

      await batch.commit();

      // non-destructive user role update
      try {
        const u = auth.currentUser;
        const userRef = doc(db, 'Users', u.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(
            userRef,
            { UserType: 'caregiver', email: u.email || null },
            { merge: true }
          );
        } else {
          const data = userSnap.data() || {};
          const updates = {};
          if (!data.UserType) updates.UserType = 'caregiver';
          if (!data.email && u.email) updates.email = u.email;
          if (Object.keys(updates).length) await updateDoc(userRef, updates);
        }
      } catch (_) {}

      Alert.alert('Success', 'Invite accepted.');
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to accept invite.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };

  const gradients = {
    cardLight: ['#f9fbff', '#ffffff'],
    cardDark: ['#020617', '#020617'],
    buttonLight: ['#81D4FA', '#81D4FA'],
    buttonDark: ['#38BDF8', '#6366F1'],
    headerPillLight: ['#ffffff', '#f3f4ff'],
    headerPillDark: ['#020617', '#0b1220'],
  };

  const isDark = darkMode;
  const textPrimary = theme.textPrimary || (isDark ? '#FFFFFF' : '#2E3A59');
  const textSecondary = theme.textSecondary || (isDark ? '#9CA3AF' : '#7C8B9A');

  return (
    <ThemedBackground>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={{ flex: 1 }}>
          {/* “Modal” style layout */}
          <View style={styles.screenPadding}>
            {/* Header row like other screens */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.headerButton}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={isDark ? gradients.headerPillDark : gradients.headerPillLight}
                  style={styles.headerButtonGradient}
                >
                  <ArrowLeft size={20} color={isDark ? '#FFFFFF' : '#2E3A59'} />
                </LinearGradient>
              </TouchableOpacity>

              <Text style={[styles.headerTitle, { color: textPrimary }]}>
                Accept Invite
              </Text>

              {/* spacer */}
              <View style={{ width: 44 }} />
            </View>

            {/* Centered “pop” card */}
            <View style={styles.centerWrap}>
              <LinearGradient
                colors={isDark ? gradients.cardDark : gradients.cardLight}
                style={styles.card}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={[styles.title, { color: textPrimary }]}>
                  Enter invite code
                </Text>
                <Text style={[styles.subtitle, { color: textSecondary }]}>
                  Your parent or guardian shared a code with you. Paste it below to connect
                  to your baby’s dashboard.
                </Text>

                <View style={styles.inputWrapper}>
                  <Text style={[styles.label, { color: textSecondary }]}>Invite code</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        borderColor: isDark ? '#1F2937' : '#CFD8DC',
                        backgroundColor: isDark ? 'rgba(15,23,42,0.9)' : '#FFFFFF',
                      },
                    ]}
                  >
                    <TextInput
                      value={code}
                      onChangeText={setCode}
                      placeholder="e.g. ABC123xyz"
                      placeholderTextColor={isDark ? '#6B7280' : '#B0BEC5'}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[styles.input, { color: textPrimary }]}
                      editable={!submitting}
                    />
                  </View>
                </View>

                {/* Primary button */}
                <TouchableOpacity
                  onPress={handleAccept}
                  disabled={submitting}
                  activeOpacity={0.9}
                  style={[styles.buttonWrapper, submitting && { opacity: 0.7 }]}
                >
                  <LinearGradient
                    colors={isDark ? gradients.buttonDark : gradients.buttonLight}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.buttonText}>
                      {submitting ? 'Accepting…' : 'Accept invite'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Ghost “Cancel” */}
                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.cancelButton}
                  activeOpacity={0.8}
                  disabled={submitting}
                >
                  <Text style={[styles.cancelText, { color: textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  screenPadding: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },

  header: {
    marginTop: 20,
    marginBottom: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },

  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 26,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },

  inputWrapper: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputContainer: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: {
    fontSize: 16,
  },

  buttonWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 4,
  },
  buttonGradient: {
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.4,
  },

  cancelButton: {
    marginTop: 10,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
});