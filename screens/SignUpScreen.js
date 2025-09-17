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
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react-native';
import { StatusBar } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import LogoImage from '../assets/logo.png';

export default function SignUpScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState({ email: false, password: false, confirm: false });

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Input Required', 'Please fill in all fields.');
      return;
    }
  
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match!');
      return;
    }
  
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
  
      await setDoc(doc(db, 'Users', user.uid), {
        Email: email,
        Password: '',
        MFAEnabled: false,
        UserType: 'parent',
        Name: '',
      });
  
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Sign Up Error', error.message);
    }
  };
    
  return (
    <LinearGradient colors={['#B2EBF2', '#FCE4EC', '#F3E5F5']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollViewContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.innerContainer}>
              {/* Circular Logo */}
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={['#81D4FA', '#F8BBD9']}
                  style={styles.logoGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Image source={LogoImage} style={styles.logoImage} resizeMode="contain" />
                </LinearGradient>
                <View style={styles.logoSparkle}>
                  <Sparkles size={20} color="#F8BBD9" />
                </View>
              </View>

              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join us and start your journey</Text>

              {/* Email */}
              <View style={[styles.inputContainer, isFocused.email && styles.inputContainerFocused]}>
                <Mail size={20} color={isFocused.email ? '#81D4FA' : '#B0BEC5'} strokeWidth={1.5} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#B0BEC5"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setIsFocused({ ...isFocused, email: true })}
                  onBlur={() => setIsFocused({ ...isFocused, email: false })}
                />
              </View>

              {/* Password */}
              <View style={[styles.inputContainer, isFocused.password && styles.inputContainerFocused]}>
                <Lock size={20} color={isFocused.password ? '#81D4FA' : '#B0BEC5'} strokeWidth={1.5} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#B0BEC5"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCorrect={false}
                  onFocus={() => setIsFocused({ ...isFocused, password: true })}
                  onBlur={() => setIsFocused({ ...isFocused, password: false })}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.showButton}>
                  {showPassword ? (
                    <EyeOff size={20} color="#81D4FA" strokeWidth={1.5} />
                  ) : (
                    <Eye size={20} color="#B0BEC5" strokeWidth={1.5} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Confirm Password */}
              <View style={[styles.inputContainer, isFocused.confirm && styles.inputContainerFocused]}>
                <Lock size={20} color={isFocused.confirm ? '#81D4FA' : '#B0BEC5'} strokeWidth={1.5} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#B0BEC5"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  onFocus={() => setIsFocused({ ...isFocused, confirm: true })}
                  onBlur={() => setIsFocused({ ...isFocused, confirm: false })}
                />
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity style={styles.signupButton} onPress={handleSignUp} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#81D4FA', '#81D4FA']}
                  style={styles.signupGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.signupButtonText}>Sign Up</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Go to Login */}
              <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 20 }}>
                <Text style={styles.loginText}>
                  Already have an account? <Text style={styles.loginLink}>Log In</Text>
                </Text>
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  innerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 40,
  },
  logoGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 15,
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  logoSparkle: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2E3A59',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7C8B9A',
    marginBottom: 40,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    marginBottom: 20,
    paddingHorizontal: 20,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(129, 212, 250, 0.1)',
  },
  inputContainerFocused: {
    borderColor: '#81D4FA',
    shadowOpacity: 0.08,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    height: 50,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  showButton: {
    paddingLeft: 10,
  },
  signupButton: {
    width: '100%',
    marginTop: 10,
  },
  signupGradient: {
    borderRadius: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginText: {
    fontSize: 14,
    color: '#7C8B9A',
  },
  loginLink: {
    color: '#81D4FA',
    fontWeight: '600',
  },
});
