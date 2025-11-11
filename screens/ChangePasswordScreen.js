import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Lock, Eye, EyeOff, Sparkles } from 'lucide-react-native';

import { auth } from '../firebaseConfig';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, } from 'firebase/auth';

import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';
import LogoImage from '../assets/logo.png';

const gradients = {
  cardLight: ['#FFFFFF', '#F9FBFF'],
  cardDark: ['#020617', '#020617'],
  inputLight: 'rgba(255,255,255,0.95)',
  inputDark: 'rgba(15,23,42,0.95)',
  buttonLight: ['#81D4FA', '#81D4FA'],
  buttonDark: ['#ee93ccff', '#fa50e9ff'],
  backLight: ['#ffffff', '#f3f4ff'],
  backDark: ['#020617', '#111827'],
};

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const handleChangePassword = async () => {
    setErrorText('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorText('Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorText("New password and confirmation don't match.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorText('Password must be at least 6 characters long.');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorText('New password must be different from your current password.');
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
      Alert.alert('Not signed in', 'Please sign in again to change your password.');
      return;
    }

    try {
      setLoading(true);

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorText('');

      Alert.alert(
        'Password Updated',
        'Your password has been successfully changed.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Password change error:', error);

      let msg = 'Could not update password. Please try again.';
      if (error.code === 'auth/wrong-password') {
        msg = 'Current password is incorrect.';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please wait a moment and try again.';
      } else if (error.code === 'auth/requires-recent-login') {
        msg = 'For security, please sign out and back in to change your password.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'Password must be at least 6 characters long.';
      } else if (error.code === 'auth/network-request-failed') {
        msg = 'Network error. Please check your connection and try again.';
      }

      setErrorText(msg);
    } finally {
      setLoading(false);
    }
  };

  const renderPasswordRow = (
    label,
    value,
    setValue,
    visible,
    setVisible,
    placeholder
  ) => (
    <View style={styles.inputRow}>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: darkMode ? gradients.inputDark : gradients.inputLight,
            borderColor: errorText ? '#B3261E' : 'rgba(129,212,250,0.25)',
          },
        ]}
      >
        <Lock
          size={20}
          color={darkMode ? '#CBD5F5' : '#B0BEC5'}
          strokeWidth={1.6}
        />
        <TextInput
          style={[
            styles.input,
            { color: currentTheme.textPrimary,
              letterSpacing: 0,
              textTransform: 'none',
             },
          ]}
          placeholder={placeholder || label}
          placeholderTextColor={darkMode ? '#9CA3AF' : '#B0BEC5'}
          secureTextEntry={!visible}
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        <TouchableOpacity
          onPress={() => setVisible(!visible)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {visible ? (
            <EyeOff size={20} color={darkMode ? '#F9A8D4' : '#81D4FA'} strokeWidth={1.6} />
          ) : (
            <Eye size={20} color={darkMode ? '#9CA3AF' : '#B0BEC5'} strokeWidth={1.6} />
          )}
        </TouchableOpacity>
      </View>
      <Text style={[styles.labelText, { color: currentTheme.textSecondary }]}>
        {label}
      </Text>
    </View>
  );

  return (
    <ThemedBackground>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
             <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
             <LinearGradient
               colors={darkMode ? ['#1f1e1eff', '#323233ff'] : gradients.cardLight}
               style={styles.headerButtonGradient}
             >
               <ArrowLeft size={20} color={darkMode ? '#fff' :' #2E3A59'} />
             </LinearGradient>
             </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: currentTheme.textPrimary }]}>
              Change Password
            </Text>

            <View style={{ width: 56 }} />
          </View>

          {/* Logo + title */}
          <View style={styles.logoSection}>
            <LinearGradient
              colors={['#81D4FA', '#F8BBD9']}
              style={styles.logoGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Image
                source={LogoImage}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <View style={styles.logoSparkle}>
                <Sparkles size={20} color="#F9A8D4" />
              </View>
            </LinearGradient>

            <Text style={[styles.title, { color: currentTheme.textPrimary }]}>
              Keep your account secure
            </Text>
            <Text style={[styles.subtitle, { color: currentTheme.textSecondary }]}>
              Update your password to protect your baby’s data.
            </Text>
          </View>

          {/* Error banner */}
          {!!errorText && (
            <View style={styles.errorBanner}>
              <Lock size={16} color="#B3261E" />
              <Text style={styles.errorText}>{errorText}</Text>
            </View>
          )}

          {/* Card */}
          <LinearGradient
            colors={darkMode ? gradients.cardDark : gradients.cardLight}
            style={styles.card}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {renderPasswordRow(
              'Current password',
              currentPassword,
              setCurrentPassword,
              showCurrent,
              setShowCurrent,
              'Current password'
            )}

            {renderPasswordRow(
              'New password',
              newPassword,
              setNewPassword,
              showNew,
              setShowNew,
              'New password'
            )}

            {renderPasswordRow(
              'Confirm new password',
              confirmPassword,
              setConfirmPassword,
              showConfirm,
              setShowConfirm,
              'Confirm new password'
            )}

            {/* Button */}
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.buttonWrapper, loading && { opacity: 0.7 }]}
              onPress={handleChangePassword}
              disabled={loading}
            >
              <LinearGradient
                colors={darkMode ? gradients.buttonDark : gradients.buttonLight}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Change Password</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 70 : 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Logo + headline
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoGradient: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 12,
  },
  logoImage: {
    width: 70,
    height: 70,
  },
  logoSparkle: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(179,38,30,0.08)',
    borderColor: 'rgba(179,38,30,0.35)',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#B3261E',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },

  // Card
  card: {
    borderRadius: 26,
    padding: 18,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },

  inputRow: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 18,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  labelText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },

  buttonWrapper: {
    borderRadius: 22,
    overflow: 'hidden',
    marginTop: 6,
  },
  buttonGradient: {
    paddingVertical: 16,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.4,
  },
});