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
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  Baby, 
  Camera, 
  TrendingUp, 
  ChevronRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles
} from 'lucide-react-native';
import '../firebaseConfig';
import LogoImage from '../assets/logo.png';

const { width, height } = Dimensions.get('window');

// Welcome Screen Component
function WelcomeScreen({ onComplete }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const welcomeSlides = [
    {
      icon: Baby,
      title: "Welcome to Baby Tracker",
      subtitle: "Your parenting companion",
      description: "Track your little one's precious moments, growth, and milestones all in one beautiful place.",
      gradient: ['#E1F5FE', '#FCE4EC']
    },
    {
      icon: Camera,
      title: "Capture Every Moment",
      subtitle: "Create lasting memories",
      description: "From first smiles to first steps, keep a beautiful record of your baby's incredible journey.",
      gradient: ['#FCE4EC', '#F3E5F5']
    },
    {
      icon: TrendingUp,
      title: "Smart Insights",
      subtitle: "Data-driven parenting",
      description: "Get helpful insights about feeding, sleeping, and growth patterns to support your baby's health.",
      gradient: ['#F3E5F5', '#E1F5FE']
    }
  ];

  useEffect(() => {
    Animated.spring(slideAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 20,
      friction: 7,
    }).start();
  }, [currentSlide]);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const handleSkip = () => {
    Animated.sequence([
      Animated.spring(buttonScale, {
        toValue: 0.95,
        useNativeDriver: true,
        duration: 100,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        useNativeDriver: true,
        duration: 100,
      })
    ]).start(() => onComplete());
  };

  const handleNext = () => {
    if (currentSlide < welcomeSlides.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: width * (currentSlide + 1),
        animated: true
      });
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const handleMomentumScrollEnd = (event) => {
    const newSlide = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentSlide(newSlide);
  };

  return (
    <View style={styles.welcomeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Skip Button */}
      <TouchableOpacity 
        style={styles.skipButton} 
        onPress={handleSkip}
        activeOpacity={0.7}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
      >
        {welcomeSlides.map((slide, index) => {
          const Icon = slide.icon;
          const inputRange = [
            (index - 1) * width,
            index * width,
            (index + 1) * width,
          ];
          
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.8, 1, 0.8],
            extrapolate: 'clamp',
          });
          
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <LinearGradient
              key={index}
              colors={slide.gradient}
              style={styles.slide}
            >
              <Animated.View 
                style={[
                  styles.slideContent,
                  {
                    transform: [{ scale }],
                    opacity,
                  }
                ]}
              >
                <View style={styles.iconContainer}>
                  <LinearGradient
                    colors={['#81D4FA', '#F8BBD9']}
                    style={styles.iconGradient}
                  >
                    <Icon size={60} color="white" strokeWidth={1.5} />
                  </LinearGradient>
                  <Animated.View style={[styles.sparkleIcon, { opacity }]}>
                    <Sparkles size={24} color="#F8BBD9" />
                  </Animated.View>
                </View>
                
                <Text style={styles.slideTitle}>{slide.title}</Text>
                <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
                <Text style={styles.slideDescription}>{slide.description}</Text>
              </Animated.View>
            </LinearGradient>
          );
        })}
      </ScrollView>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {/* Dots Indicator */}
        <View style={styles.dotsContainer}>
          {welcomeSlides.map((_, index) => {
            const inputRange = [
              (index - 1) * width,
              index * width,
              (index + 1) * width,
            ];
            
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [10, 30, 10],
              extrapolate: 'clamp',
            });
            
            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor: currentSlide === index ? '#81D4FA' : '#E0E0E0',
                  }
                ]}
              />
            );
          })}
        </View>

        {/* Continue/Get Started Button */}
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity 
            style={styles.continueButton} 
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#81D4FA', '#F8BBD9']}
              style={styles.continueGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.continueText}>
                {currentSlide === welcomeSlides.length - 1 ? "Get Started" : "Continue"}
              </Text>
              <ChevronRight size={20} color="white" strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
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
  const [isFocused, setIsFocused] = useState({ email: false, password: false });

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

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

  const animateButton = () => {
    Animated.sequence([
      Animated.spring(buttonScale, {
        toValue: 0.95,
        useNativeDriver: true,
        duration: 100,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        useNativeDriver: true,
        duration: 100,
      })
    ]).start();
  };

  const checkIfNewUser = async (user) => {
    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: user.email,
          createdAt: new Date(),
          isNewUser: false
        });
        return true;
      }
      
      const userData = userDoc.data();
      return userData.isNewUser !== false;
    } catch (error) {
      console.error('Error checking user status:', error);
      return false;
    }
  };

  const handleLogin = async () => {
    animateButton();
    
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
            <Animated.View 
              style={[
                styles.innerContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              {/* Logo Section */}
              <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
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
                </LinearGradient>
                <View style={styles.logoSparkle}>
                  <Sparkles size={20} color="#F8BBD9" />
                </View>
              </Animated.View>

              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to continue your journey</Text>

              {/* Form Section */}
              <View style={styles.formContainer}>
                {/* Email Input */}
                <View style={[
                  styles.inputContainer,
                  isFocused.email && styles.inputContainerFocused
                ]}>
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

                {/* Password Input */}
                <View style={[
                  styles.inputContainer,
                  isFocused.password && styles.inputContainerFocused
                ]}>
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
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.showButton}
                  >
                    {showPassword ? 
                      <EyeOff size={20} color="#81D4FA" strokeWidth={1.5} /> : 
                      <Eye size={20} color="#B0BEC5" strokeWidth={1.5} />
                    }
                  </TouchableOpacity>
                </View>

                {/* Forgot Password */}
                <TouchableOpacity 
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={styles.forgotButton}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                {/* Login Button */}
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity 
                    style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} 
                    onPress={handleLogin}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#81D4FA', '#81D4FA']}
                      style={styles.loginGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.loginText}>
                        {isLoading ? 'Signing In...' : 'Sign In'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>

                {/* Sign Up Link */}
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
    backgroundColor: '#FFFFFF',
  },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 30,
    zIndex: 100,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
  },
  skipText: {
    fontSize: 16,
    color: '#7C8B9A',
    fontWeight: '600',
  },
  slide: {
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  slideContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 50,
  },
  iconGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 15,
  },
  sparkleIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  slideTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2E3A59',
    textAlign: 'center',
    marginBottom: 12,
  },
  slideSubtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#5C6B7D',
    textAlign: 'center',
    marginBottom: 25,
  },
  slideDescription: {
    fontSize: 16,
    color: '#7C8B9A',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: '85%',
  },
  bottomSection: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    width: '100%',
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  dot: {
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    backgroundColor: '#E0E0E0',
  },
  continueButton: {
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 50,
    borderRadius: 30,
  },
  continueText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginRight: 8,
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
  logoSparkle: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#2E3A59',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7C8B9A',
    marginBottom: 45,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    maxWidth: 340,
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
    marginLeft: 12,
    fontSize: 16,
    color: '#2E3A59',
  },
  showButton: {
    padding: 10,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotText: {
    color: '#81D4FA',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    marginBottom: 25,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginGradient: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.5,
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
    fontWeight: '700',
  },
  logoImage: {
    width: 80,
    height: 80,
  },  
});