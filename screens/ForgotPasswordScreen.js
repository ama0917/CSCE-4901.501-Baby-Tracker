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
  StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { Mail, Sparkles } from 'lucide-react-native';
import LogoImage from '../assets/logo.png';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const navigation = useNavigation();

  const handleResetPassword = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      Alert.alert('Input Required', 'Please enter your email address.');
      return;
    }
  
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
  
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      Alert.alert('Password Reset Sent', 'Check your email for a reset link.');
      navigation.goBack();
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        Alert.alert('Email Not Found', 'No account is associated with this email.');
      } else if (error.code === 'auth/invalid-email') {
        Alert.alert('Invalid Email', 'The email address is not valid.');
      } else {
        Alert.alert('Error', error.message);
      }
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
              {/* Logo with gradient and sparkle */}
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

              <Text style={styles.title}>RESET PASSWORD</Text>
              <Text style={styles.subtitle}>Enter your email to receive a reset link</Text>

              {/* Email Input */}
              <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
                <Mail size={20} color={isFocused ? '#81D4FA' : '#B0BEC5'} strokeWidth={1.5} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#B0BEC5"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
              </View>

              {/* Reset Button */}
              <TouchableOpacity style={styles.resetButton} onPress={handleResetPassword} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#81D4FA', '#81D4FA']}
                  style={styles.resetGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.resetText}>Send Reset Link</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Go Back */}
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                <Text style={styles.backText}>Go back to Login</Text>
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
  resetButton: {
    width: '100%',
    marginTop: 10,
  },
  resetGradient: {
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
  resetText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backText: {
    fontSize: 14,
    color: '#7C8B9A',
    textDecorationLine: 'underline',
  },
});
