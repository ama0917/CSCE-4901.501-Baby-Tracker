// [KEPT from incoming]
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
  ScrollView, // [MERGED] import here instead of separate line
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

// [KEPT from incoming] – simple password login
import { getAuth, signInWithEmailAndPassword /* , isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink */ } from 'firebase/auth';
import '../firebaseConfig'; // must initialize Firebase

/* ------------------- YOUR ADVANCED BITS (commented out) ------------------- */
// Keep these for future MFA / Email-link work, but COMMENTED so they don't affect build now.
// import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
// import * as Linking from 'expo-linking';
// import * as Crypto from 'expo-crypto';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { signInOrThrowMfa, isTotpChallenge, resolveTotpSignIn } from '../auth/mfa';

// const actionCodeSettings = {
//   url: 'https://babytracker-ab1ed.web.app/finishSignIn/',
//   handleCodeInApp: true,
// };

// const hashEmail = async (e) =>
//   Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, (e || '').toLowerCase().trim());

// const getLoginModeFor = async (email) => {
//   try {
//     const db = getFirestore();
//     const h = await hashEmail(email);
//     const snap = await getDoc(doc(db, 'loginPrefs', h));
//     return snap.exists() ? (snap.data().mode || 'password') : 'password';
//   } catch {
//     return 'password';
//   }
// };

/* ------------------------------------------------------------------------- */

export default function LoginScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // [ADDED SAFELY] basic loading state (just UX; doesn’t change flow)
  const [isLoading, setIsLoading] = useState(false);

  // [REMOVED from UI/flow] WelcomeScreen + MFA UI + deep link listeners (kept commented above)

  const handleLogin = async () => {
    // [FOLLOW THEIRS] simple password sign-in; your advanced paths are commented above
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    setIsLoading(true);
    try {
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Roles/permissions are applied AFTER login in Home/ChildDashboard (no role logic needed here)
      navigation.navigate('Home');
    } catch (error) {
      // [KEPT] friendly error messages
      let errorMessage = 'Login failed. Please try again.';
      if (error?.code === 'auth/user-not-found') errorMessage = 'No account found with this email.';
      else if (error?.code === 'auth/wrong-password') errorMessage = 'Incorrect password.';
      else if (error?.code === 'auth/invalid-email') errorMessage = 'Invalid email address.';
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollViewContent}>
            <View style={styles.innerContainer}>
              <Image source={require('../assets/logo.png')} style={styles.logoImage} />
              <Text style={styles.title}>LOGIN</Text>

              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TouchableOpacity style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Password"
                  placeholderTextColor="#aaa"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <Text style={styles.showText} onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              {/* [FOLLOW THEIRS] Simple login button */}
              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.loginText}>{isLoading ? 'Signing In...' : 'Login'}</Text>
              </TouchableOpacity>

              {/* [FOLLOW THEIRS] Single Sign Up link */}
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                <Text style={styles.signupText}>Not a member? Sign up.</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  forgotText: {
    color: '#007AFF',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 5,
  },
  loginText: {
    fontSize: 18,
  },
  signupText: {
    marginTop: 20,
    color: '#007AFF',
  },
});