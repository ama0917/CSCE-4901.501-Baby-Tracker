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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../firebaseConfig';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { ArrowLeft } from 'lucide-react-native';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';

const gradients = {
  cardLight: ['#f9fbff', '#ffffff'],
  cardDark: ['#2b2e34', '#1f2126'],
  actionLight: ['#81D4FA', '#F8BBD9'],
  actionDark: ['#00c6ff', '#8E2DE2'],
  warnLight: ['#FFCDD2', '#F8BBD9'],
  warnDark: ['#ff80ab', '#ff4081'],
  inputLight: ['#f0f2f5', '#ffffff'],
  inputDark: ['#3a3d44', '#2d3036'],
};

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing Information', 'Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords Don\'t Match', 'New password and confirmation must match.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters long.');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('Same Password', 'New password must be different from your current password.');
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
      Alert.alert('Not signed in', 'Please sign in again to change your password.');
      return;
    }

    try {
      setLoading(true);

      // Reauthenticate user first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      // Clear fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      Alert.alert(
        'Password Updated',
        'Your password has been successfully changed.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Password change error:', error);

      let errorMessage = 'Could not update password. Please try again.';

      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Current password is incorrect.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please wait a moment and try again.';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'For security, please sign out and back in to change your password.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password must be at least 6 characters long.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Session expired. Please sign in again.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection and try again.';
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <LinearGradient
                colors={darkMode ? ['#1f1e1eff', '#323233ff'] : gradients.cardLight}
                style={styles.backButtonGradient}
              >
                <ArrowLeft size={20} color={darkMode ? '#fff' : '#2E3A59'} />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: currentTheme.textPrimary }]}>
              Change Password
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Card */}
          <LinearGradient
            colors={darkMode ? gradients.cardDark : gradients.cardLight}
            style={styles.card}
          >
            <Text style={[styles.instructions, { color: currentTheme.textSecondary }]}>
              Enter your current password and choose a new one.
            </Text>

            {/* Current Password */}
            <LinearGradient
              colors={darkMode ? gradients.inputDark : gradients.inputLight}
              style={styles.inputWrap}
            >
              <TextInput
                placeholder="Current Password"
                placeholderTextColor={darkMode ? '#b5b8bf' : '#7C8B9A'}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                style={[styles.input, { color: darkMode ? '#fff' : '#333' }]}
                returnKeyType="next"
                autoCorrect={false}
                autoCapitalize="none"
                editable={!loading}
              />
            </LinearGradient>

            {/* New Password */}
            <LinearGradient
              colors={darkMode ? gradients.inputDark : gradients.inputLight}
              style={styles.inputWrap}
            >
              <TextInput
                placeholder="New Password"
                placeholderTextColor={darkMode ? '#b5b8bf' : '#7C8B9A'}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                style={[styles.input, { color: darkMode ? '#fff' : '#333' }]}
                returnKeyType="next"
                autoCorrect={false}
                autoCapitalize="none"
                editable={!loading}
              />
            </LinearGradient>

            {/* Confirm New Password */}
            <LinearGradient
              colors={darkMode ? gradients.inputDark : gradients.inputLight}
              style={styles.inputWrap}
            >
              <TextInput
                placeholder="Confirm New Password"
                placeholderTextColor={darkMode ? '#b5b8bf' : '#7C8B9A'}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                style={[styles.input, { color: darkMode ? '#fff' : '#333' }]}
                returnKeyType="done"
                autoCorrect={false}
                autoCapitalize="none"
                onSubmitEditing={handleChangePassword}
                editable={!loading}
              />
            </LinearGradient>

            {/* Submit Button */}
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.submitButton, { opacity: loading ? 0.6 : 1 }]}
              onPress={handleChangePassword}
              disabled={loading}
            >
              <LinearGradient
                colors={darkMode ? gradients.warnDark : gradients.warnLight}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Change Password</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 20 : 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  backButtonGradient: {
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
  card: {
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  instructions: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  inputWrap: {
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  submitButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});