import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  View,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';


import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';



export default function SignUpScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // isFocused, MFA enrollment UI/state, icons, etc.

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match!');
      return;
    }

    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);

      await setDoc(doc(db, 'Users', user.uid), {
        Email: email.trim(),
        Password: '',          // never store plaintext
        MFAEnabled: false,     // false for now; TOTP is commented out
        UserType: 'parent',
        Name: '',
      });

      // Send verification email
      try {
        await sendEmailVerification(user);
        Alert.alert(
          'Verify your email',
          'We sent a verification link to your inbox. Please verify your email, then log in.'
        );
      } catch (e) {
        // Not fatal for signup; user can verify later from Settings
        console.warn('sendEmailVerification failed:', e);
      }

      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Sign Up Error', error?.message || 'Could not create account.');
    }
  };

  return (
    <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={styles.scrollViewContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.innerContainer}>
                <Image source={require('../assets/logo.png')} style={styles.logoImage} />
                <Text style={styles.title}>SIGN UP</Text>

                {/* Email */}
                <TextInput
                  style={styles.input}
                  placeholder="Enter Email"
                  placeholderTextColor="#aaa"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                {/* Password + Show/Hide (text-based, matches incoming style) */}
                <TouchableOpacity style={styles.passwordContainer} activeOpacity={1}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter Password"
                    placeholderTextColor="#aaa"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <Text style={styles.showText} onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>

                {/* Confirm Password */}
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#aaa"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />

                {/* Submit */}
                <TouchableOpacity style={styles.signupButton} onPress={handleSignUp}>
                  <Text style={styles.signupText}>Sign-up</Text>
                </TouchableOpacity>

                {/* Go to Login */}
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.loginText}>Already have an account? Login.</Text>
                </TouchableOpacity>

                {/* ---------------- COMMENTED OUT: TOTP UI block ----------------
                {enrollingMfa && (
                  <View style={{ marginTop: 24, width: '100%' }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#2E3A59', marginBottom: 8 }}>
                      Set up Authenticator (TOTP)
                    </Text>
                    <Text style={{ color: '#7C8B9A', marginBottom: 8 }}>
                      Copy this into your authenticator app (Google Authenticator, Authy), or scan as a QR:
                    </Text>
                    {mfaUri ? (
                      <View style={{ marginBottom: 12, alignItems: 'center' }}>
                        <QRCode value={mfaUri} size={180} />
                      </View>
                    ) : null}
                    <Text selectable style={{ color: '#2E3A59', fontSize: 12, marginBottom: 12 }}>
                      {mfaUri}
                    </Text>

                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor="#B0BEC5"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={mfaCode}
                      onChangeText={setMfaCode}
                    />

                    <TouchableOpacity style={styles.signupButton} onPress={async () => {
                      try {
                        if (!mfaCode || mfaCode.length !== 6) {
                          Alert.alert('MFA', 'Enter the 6-digit code from your authenticator app');
                          return;
                        }
                        await finishTotpEnrollment(auth.currentUser, mfaCode);
                        Alert.alert('Success', 'Two-factor authentication enabled.');
                        navigation.navigate('Login');
                      } catch (e) {
                        Alert.alert('MFA Error', e.message);
                      }
                    }}>
                      <Text style={styles.signupText}>Verify & Enable MFA</Text>
                    </TouchableOpacity>
                  </View>
                )}
                --------------------------------------------------------------- */}
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  innerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logoImage: {
    width: 90,
    height: 90,
    resizeMode: 'contain',
    marginBottom: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '80%',
    height: 40,
    backgroundColor: 'white',
    marginBottom: 15,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 5,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  passwordInput: {
    flex: 1,
    height: 40,
  },
  showText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  signupButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 5,
    marginTop: 20,
  },
  signupText: {
    fontSize: 18,
  },
  loginText: {
    marginTop: 20,
    color: '#007AFF',
  },
});