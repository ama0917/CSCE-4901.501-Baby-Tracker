import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Alert,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Play, Pause, RotateCcw, CheckCircle } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDarkMode } from './DarkMode';
import { appTheme } from './ThemedBackground';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';

const getTodayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function BreastfeedingTimer() {
  const navigation = useNavigation();
  const route = useRoute();
  const { childId, name } = route.params || {};
  const { darkMode } = useDarkMode();
  const theme = darkMode ? appTheme.dark : appTheme.light;

  // Timer states
  const [leftTime, setLeftTime] = useState(0);
  const [rightTime, setRightTime] = useState(0);
  const [activeBreast, setActiveBreast] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionStart, setSessionStart] = useState(null);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef(null);

  useEffect(() => {
    let pulseLoop;
    let glowLoop;

    if (isRunning && activeBreast) {
      // Pulsing animation
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      // Glow animation (non-native driven because of opacity interpolation)
      glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      );
      glowLoop.start();

      intervalRef.current = setInterval(() => {
        if (activeBreast === 'left') {
          setLeftTime((prev) => prev + 1);
        } else {
          setRightTime((prev) => prev + 1);
        }
      }, 1000);
    } else {
      // stop loops & interval safely
      if (pulseLoop) pulseLoop.stop();
      pulseAnim.setValue(1);
      if (glowLoop) glowLoop.stop();
      glowAnim.setValue(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (pulseLoop) pulseLoop.stop();
      if (glowLoop) glowLoop.stop();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, activeBreast]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = (breast) => {
    if (!sessionStart) {
      setSessionStart(new Date());
    }
    setActiveBreast(breast);
    setIsRunning(true);
  };

  const pauseTimer = () => {
    setIsRunning(false);
  };

  const switchBreast = () => {
    const newBreast = activeBreast === 'left' ? 'right' : 'left';
    setActiveBreast(newBreast);
  };

  const resetTimer = () => {
    Alert.alert(
      'Reset Timer',
      'Are you sure you want to reset? This will clear all times.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setLeftTime(0);
            setRightTime(0);
            setActiveBreast(null);
            setIsRunning(false);
            setSessionStart(null);
          },
        },
      ]
    );
  };

  const completeSession = async () => {
    if (leftTime === 0 && rightTime === 0) {
      Alert.alert('No Data', 'Please time at least one side before completing.');
      return;
    }

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user || !childId) {
        Alert.alert('Error', 'Missing user or child info');
        return;
      }

      let breastSide = 'both';
      if (leftTime > 0 && rightTime === 0) breastSide = 'left';
      if (rightTime > 0 && leftTime === 0) breastSide = 'right';

      const totalMinutes = Math.round((leftTime + rightTime) / 60);

      const logData = {
        timestamp: sessionStart || new Date(),
        feedType: 'Breastmilk',
        amount: totalMinutes,
        amountUnit: 'min',
        mealType: 'Snack',
        notes: `Left: ${formatTime(leftTime)}, Right: ${formatTime(rightTime)}`,
        childId,
        createdAt: serverTimestamp(),
        createdBy: user?.uid,
        logDate: getTodayStr(),
        breastSide,
        leftDuration: leftTime,
        rightDuration: rightTime,
      };

      await addDoc(collection(db, 'feedLogs'), logData);

      Alert.alert(
        'Success',
        `Breastfeeding session logged!\nTotal: ${totalMinutes} minutes`,
        [
          {
            text: 'OK',
            onPress: () => {
                navigation.navigate('FeedingForm', {
                    childId,
                    name,
                    prefillData: {
                    foodType: 'Breastmilk',
                    amount: totalMinutes.toString(),
                    amountUnit: 'min',
                    breastSide: breastSide,
                    notes: `Left: ${formatTime(leftTime)}, Right: ${formatTime(rightTime)}`
                    }
                });
                },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving breastfeeding session:', error);
      Alert.alert('Error', 'Failed to save session. Please try again.');
    }
  };

  const totalTime = leftTime + rightTime;

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.8],
  });

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <LinearGradient
              colors={darkMode ? ['#2a2a2a', '#1f1f1f'] : ['#ffffff', '#f8f9fa']}
              style={styles.headerButtonGradient}
            >
              <ArrowLeft size={22} color={darkMode ? '#fff' : '#2E3A59'} strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>

          <Image source={require('../assets/logo.png')} style={styles.logo} />

          {/* spacer to center the logo */}
          <View style={styles.headerSpacer} />
        </View>

        {/* Title Section */}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Breastfeeding Timer</Text>
          <View style={[styles.nameBadge, { backgroundColor: darkMode ? '#1f2937' : '#EDE7F6' }]}>
            <Text style={[styles.nameText, { color: darkMode ? '#C4B5FD' : '#7C4DFF' }]}>
              {name ? `${name}'s Session` : 'Session'}
            </Text>
          </View>
        </View>

        {/* Total Time Display */}
        <LinearGradient
          colors={darkMode ? ['#0b1220', '#071026'] : ['#E3F2FD', '#BBDEFB']}
          style={[styles.totalTimeCard, { borderWidth: 0 }]}
        >
          <Text style={[styles.totalTimeLabel, { color: darkMode ? '#93C5FD' : '#1565C0' }]}>
            Total Session
          </Text>
          <Text style={[styles.totalTime, { color: darkMode ? '#60A5FA' : '#0D47A1' }]}>
            {formatTime(totalTime)}
          </Text>

          <View style={styles.timeIndicators}>
            <View style={styles.miniIndicator}>
              <View style={[styles.miniDot, { backgroundColor: '#E91E63' }]} />
              <Text style={[styles.miniTime, { color: theme.textSecondary }]}>{formatTime(leftTime)}</Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.miniIndicator}>
              <View style={[styles.miniDot, { backgroundColor: '#9C27B0' }]} />
              <Text style={[styles.miniTime, { color: theme.textSecondary }]}>{formatTime(rightTime)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Breast Timers */}
        <View style={styles.breastsContainer}>
          {/* Left */}
          <View style={styles.breastWrapper}>
            {/* glow behind card */}
            {activeBreast === 'left' && isRunning && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.glowEffect,
                  {
                    opacity: glowOpacity,
                    backgroundColor: darkMode ? '#EC4899' : '#F8BBD0',
                  },
                ]}
              />
            )}

            <Animated.View
              style={[
                styles.breastCard,
                {
                  backgroundColor: darkMode ? '#121212' : '#fff',
                  transform: [{ scale: activeBreast === 'left' && isRunning ? pulseAnim : 1 }],
                },
              ]}
            >
              <LinearGradient colors={['#FCE4EC', '#F8BBD0']} style={styles.breastIndicator}>
                <View style={styles.breastIconInner} />
              </LinearGradient>

              <Text style={[styles.breastLabel, { color: theme.textPrimary }]}>Left</Text>

              <Text style={[styles.breastTime, { color: darkMode ? '#EC4899' : '#E91E63' }]}>
                {formatTime(leftTime)}
              </Text>

              <TouchableOpacity
                onPress={() => (isRunning && activeBreast === 'left' ? pauseTimer() : startTimer('left'))}
                style={styles.breastButton}
              >
                <LinearGradient
                  colors={activeBreast === 'left' && isRunning ? ['#EF5350', '#E53935'] : ['#66BB6A', '#4CAF50']}
                  style={styles.breastButtonGradient}
                >
                  {activeBreast === 'left' && isRunning ? (
                    <Pause size={20} color="#fff" fill="#fff" />
                  ) : (
                    <Play size={20} color="#fff" fill="#fff" />
                  )}
                  <Text style={styles.breastButtonText}>
                    {activeBreast === 'left' && isRunning ? 'Pause' : 'Start'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Right */}
          <View style={styles.breastWrapper}>
            {activeBreast === 'right' && isRunning && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.glowEffect,
                  {
                    opacity: glowOpacity,
                    backgroundColor: darkMode ? '#A78BFA' : '#E1BEE7',
                  },
                ]}
              />
            )}

            <Animated.View
              style={[
                styles.breastCard,
                {
                  backgroundColor: darkMode ? '#121212' : '#fff',
                  transform: [{ scale: activeBreast === 'right' && isRunning ? pulseAnim : 1 }],
                },
              ]}
            >
              <LinearGradient colors={['#F3E5F5', '#E1BEE7']} style={styles.breastIndicator}>
                <View style={styles.breastIconInner} />
              </LinearGradient>

              <Text style={[styles.breastLabel, { color: theme.textPrimary }]}>Right</Text>

              <Text style={[styles.breastTime, { color: darkMode ? '#A78BFA' : '#9C27B0' }]}>
                {formatTime(rightTime)}
              </Text>

              <TouchableOpacity
                onPress={() => (isRunning && activeBreast === 'right' ? pauseTimer() : startTimer('right'))}
                style={styles.breastButton}
              >
                <LinearGradient
                  colors={activeBreast === 'right' && isRunning ? ['#EF5350', '#E53935'] : ['#66BB6A', '#4CAF50']}
                  style={styles.breastButtonGradient}
                >
                  {activeBreast === 'right' && isRunning ? (
                    <Pause size={20} color="#fff" fill="#fff" />
                  ) : (
                    <Play size={20} color="#fff" fill="#fff" />
                  )}
                  <Text style={styles.breastButtonText}>
                    {activeBreast === 'right' && isRunning ? 'Pause' : 'Start'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          {isRunning && (
            <TouchableOpacity onPress={switchBreast} style={styles.actionButton}>
              <LinearGradient
                colors={darkMode ? ['#7C3AED', '#6D28D9'] : ['#BA68C8', '#AB47BC']}
                style={styles.actionButtonGradient}
              >
                <RotateCcw size={18} color="#fff" strokeWidth={2.5} />
                <Text style={styles.actionButtonText}>Switch Side</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={resetTimer} style={styles.actionButton}>
            <LinearGradient
              colors={darkMode ? ['#374151', '#1f2937'] : ['#F5F5F5', '#E0E0E0']}
              style={styles.actionButtonGradient}
            >
              <RotateCcw size={18} color={darkMode ? '#9CA3AF' : '#616161'} strokeWidth={2.5} />
              <Text style={[styles.actionButtonText, { color: darkMode ? '#D1D5DB' : '#616161' }]}>Reset</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Complete Button */}
        <TouchableOpacity onPress={completeSession} style={styles.completeButton} disabled={leftTime === 0 && rightTime === 0}>
          <LinearGradient
            colors={
              leftTime === 0 && rightTime === 0
                ? ['#9E9E9E', '#757575']
                : darkMode
                ? ['#10B981', '#059669']
                : ['#66BB6A', '#4CAF50']
            }
            style={styles.completeButtonGradient}
          >
            <CheckCircle size={22} color="#fff" strokeWidth={2.5} />
            <Text style={styles.completeButtonText}>Complete & Save</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Helpful Tips */}
        <LinearGradient colors={darkMode ? ['#0b2741', '#071f34'] : ['#E3F2FD', '#BBDEFB']} style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Text style={[styles.tipsTitle, { color: darkMode ? '#60A5FA' : '#1976D2' }]}>Helpful Tips</Text>
          </View>

          <View style={styles.tipsList}>
            <View style={styles.tipItem}>
              <View style={[styles.tipBullet, { backgroundColor: darkMode ? '#3B82F6' : '#42A5F5' }]} />
              <Text style={[styles.tipsText, { color: darkMode ? '#BFDBFE' : '#1565C0' }]}>
                Sessions typically last 10-20 minutes per breast
              </Text>
            </View>

            <View style={styles.tipItem}>
              <View style={[styles.tipBullet, { backgroundColor: darkMode ? '#3B82F6' : '#42A5F5' }]} />
              <Text style={[styles.tipsText, { color: darkMode ? '#BFDBFE' : '#1565C0' }]}>
                Switch when baby slows down or becomes drowsy
              </Text>
            </View>

            <View style={styles.tipItem}>
              <View style={[styles.tipBullet, { backgroundColor: darkMode ? '#3B82F6' : '#42A5F5' }]} />
              <Text style={[styles.tipsText, { color: darkMode ? '#BFDBFE' : '#1565C0' }]}>
                Alternate starting breast each feeding
              </Text>
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  // simplified container — rely on SafeAreaView and small top padding
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 16 : 12,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  headerButton: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
  },
  headerSpacer: {
    width: 44, // matches headerButton width so logo stays centered
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  nameBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  nameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  totalTimeCard: {
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  totalTimeLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  totalTime: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  timeIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  miniIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  miniTime: {
    fontSize: 13,
    fontWeight: '600',
  },
  separator: {
    width: 1,
    height: 20,
    opacity: 0.25,
    backgroundColor: '#000',
  },
  breastsContainer: {
    flexDirection: 'row',
    // replaced gap with spacing via marginHorizontal below
    marginBottom: 18,
  },
  breastWrapper: {
    flex: 1,
    position: 'relative',
    marginHorizontal: 8, // creates spacing between left & right
    overflow: 'visible', // allow glow to render outside bounds
    alignItems: 'center',
  },
  glowEffect: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 26,
    zIndex: 0,
    // no shadow here; color/opacity controlled by Animated
  },
  breastCard: {
    width: '100%',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 1, // ensure this renders above glow
  },
  breastIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  breastIconInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  breastLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  breastTime: {
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: -1,
  },
  breastButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  breastButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  breastButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  completeButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  completeButtonGradient: {
    flexDirection: 'row',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
  },
  tipsCard: {
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  tipsIcon: { fontSize: 18, marginRight: 8 },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  tipsList: {
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: 10,
  },
  tipsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
});
