import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Dimensions,
  StatusBar
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { ScrollView } from 'react-native';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import '../firebaseConfig';

const { width, height } = Dimensions.get('window');

// Welcome Screen Component
function WelcomeScreen({ onComplete }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const [currentSlide, setCurrentSlide] = useState(0);

  const welcomeSlides = [
    {
      title: "Welcome to Baby Tracker! 👶",
      subtitle: "Your journey starts here",
      description: "Track your little one's precious moments, growth, and milestones all in one place."
    },
    {
      title: "Never Miss a Moment 📸",
      subtitle: "Capture every milestone",
      description: "From first smiles to first steps, keep a beautiful record of your baby's development."
    },
    {
      title: "Smart Insights 📊",
      subtitle: "Understand patterns",
      description: "Get helpful insights about feeding, sleeping, and growth patterns to support your baby's health."
    }
  ];

  useEffect(() => {
    const animateSlide = () => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        })
      ]).start();
    };

    animateSlide();

    const timer = setTimeout(() => {
      if (currentSlide < welcomeSlides.length - 1) {
        // Reset animations for next slide
        fadeAnim.setValue(0);
        slideAnim.setValue(50);
        scaleAnim.setValue(0.8);
        setCurrentSlide(currentSlide + 1);
      } else {
        setTimeout(onComplete, 1000);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [currentSlide]);

  return (
    <LinearGradient colors={['#E1F5FE', '#FCE4EC', '#F3E5F5']} style={styles.welcomeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <Animated.View 
        style={[
          styles.welcomeContent,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}
      >
        <View style={styles.welcomeIcon}>
          <Text style={styles.welcomeEmoji}>👶</Text>
        </View>
        
        <Text style={styles.welcomeTitle}>
          {welcomeSlides[currentSlide].title}
        </Text>
        
        <Text style={styles.welcomeSubtitle}>
          {welcomeSlides[currentSlide].subtitle}
        </Text>
        
        <Text style={styles.welcomeDescription}>
          {welcomeSlides[currentSlide].description}
        </Text>

        <View style={styles.dotsContainer}>
          {welcomeSlides.map((_, index) => (
            <View 
              key={index} 
              style={[
                styles.dot, 
                currentSlide === index ? styles.activeDot : styles.inactiveDot
              ]} 
            />
          ))}
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

// Main Login Screen Component
export default function LoginScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Animate login screen entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const checkIfNewUser = async (user) => {
    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // New user - show welcome screen and create user document
        await setDoc(userDocRef, {
          email: user.email,
          createdAt: new Date(),
          isNewUser: false // Set to false after welcome is shown
        });
        return true;
      }
      
      // Check if user has seen welcome before
      const userData = userDoc.data();
      return userData.isNewUser !== false;
    } catch (error) {
      console.error('Error checking user status:', error);
      return false;
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);
    const auth = getAuth();
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const isNewUser = await checkIfNewUser(userCredential.user);
      
      if (isNewUser) {
        setShowWelcome(true);
      } else {
        navigation.navigate('Home');
      }
    } catch (error) {
      console.error(error);
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      }
      
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
    navigation.navigate('Home');
  };

  if (showWelcome) {
    return <WelcomeScreen onComplete={handleWelcomeComplete} />;
  }

  return (
    <LinearGradient colors={['#E3F2FD', '#FCE4EC', '#F8BBD9']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollViewContent} showsVerticalScrollIndicator={false}>
            <Animated.View 
              style={[
                styles.innerContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
                <LinearGradient
                  colors={['#81D4FA', '#F8BBD9']}
                  style={styles.logoGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Image source={require('../assets/logo.png')} style={styles.logoImage} />
                </LinearGradient>
              </Animated.View>

              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to continue your journey</Text>

              <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#B0BEC5"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Password"
                      placeholderTextColor="#B0BEC5"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.showButton}
                    >
                      <Text style={styles.showText}>
                        {showPassword ? 'Hide' : 'Show'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={styles.forgotButton}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} 
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={['#81D4FA', '#F8BBD9']}
                    style={styles.loginGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.loginText}>
                      {isLoading ? 'Signing In...' : 'Sign In'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => navigation.navigate('SignUp')}
                  style={styles.signupButton}
                >
                  <Text style={styles.signupText}>
                    Don't have an account? <Text style={styles.signupLink}>Sign up</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // Welcome Screen Styles
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  welcomeContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  welcomeEmoji: {
    fontSize: 60,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2E3A59',
    textAlign: 'center',
    marginBottom: 10,
  },
  welcomeSubtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#5C6B7D',
    textAlign: 'center',
    marginBottom: 20,
  },
  welcomeDescription: {
    fontSize: 16,
    color: '#7C8B9A',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '90%',
    marginBottom: 40,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: '#81D4FA',
  },
  inactiveDot: {
    backgroundColor: 'rgba(129, 212, 250, 0.3)',
  },

  // Login Screen Styles
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
    minHeight: height - (Platform.OS === 'android' ? StatusBar.currentHeight : 0),
  },
  logoContainer: {
    marginBottom: 40,
  },
  logoGradient: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 15,
  },
  logoImage: {
    width: 70,
    height: 70,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2E3A59',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7C8B9A',
    marginBottom: 40,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    maxWidth: 320,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    height: 55,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#2E3A59',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(129, 212, 250, 0.2)',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(129, 212, 250, 0.2)',
  },
  passwordInput: {
    flex: 1,
    height: 55,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#2E3A59',
  },
  showButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  showText: {
    color: '#81D4FA',
    fontWeight: '600',
    fontSize: 14,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotText: {
    color: '#81D4FA',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    marginBottom: 25,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginGradient: {
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  signupButton: {
    alignItems: 'center',
  },
  signupText: {
    fontSize: 16,
    color: '#7C8B9A',
  },
  signupLink: {
    color: '#81D4FA',
    fontWeight: '600',
  },
});