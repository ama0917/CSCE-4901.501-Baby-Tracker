import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image, Platform, ScrollView, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../firebaseConfig';
import { addDoc, collection, serverTimestamp, doc, onSnapshot } from 'firebase/firestore'; 
import { useRoute } from '@react-navigation/native';

import { ArrowLeft } from 'lucide-react-native';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';

// caregiver/role gating imports
import useUserRole from './useUserRole';
import { getAuth } from 'firebase/auth';

//helper for per-day key
const getTodayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const SleepingForm = ({ navigation }) => {
  const route = useRoute();
  const { childId, name } = route.params || {};

  // caregiver gating state
  const { role } = useUserRole();
  const uid = getAuth().currentUser?.uid;
  const [canLog, setCanLog] = useState(role === 'parent');

  //live permission watch; parents always true
  useEffect(() => {
    if (role === 'parent') { setCanLog(true); return; }
    if (!childId || !uid) { setCanLog(false); return; }
    const ref = doc(db, 'children', childId);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() || {};
      const v = (data.caregiverPerms || {})[uid];
      setCanLog(data.userId === uid || v === 'on' || v === 'log');
    });
    return () => unsub();
  }, [role, childId, uid]);

  const { darkMode } = useDarkMode();
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;

  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [sleepType, setSleepType] = useState('');
  const [showSleepTypePicker, setShowSleepTypePicker] = useState(false);

const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const calculateDuration = () => {
    const diffMs = endTime - startTime;
    const adjustedDiffMs = diffMs < 0 ? diffMs + 24 * 60 * 60 * 1000 : diffMs;
    return Math.floor(adjustedDiffMs / (1000 * 60));
  };

  const formatDuration = () => {
    const minutes = calculateDuration();
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} hr ${mins} min`;
  };

  const handleCompleteLog = async () => {
    if (!canLog) { alert('Access is off. The parent has disabled access for this child.'); return; }
    if (!childId) {
      Alert.alert('Error', 'No child selected');
      return;
    }
    if (!sleepType) {
      Alert.alert('Error', 'Please select a sleep type');
      return;
    }
    try {
      const logData = {
        timestamp: startTime,
        duration: calculateDuration(),
        childId,
        sleepType,
        endTime,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'sleepLogs'), logData);
      Alert.alert('Success', 'Sleep log saved!');
      navigation.goBack();
    } catch (error) {
      console.error('Error adding sleep log:', error);
      Alert.alert('Error', 'Failed to save log. Please try again.');
    }
  };

  if (!canLog) {
    return (
      <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ margin: 20, backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
          <Text style={{ color: '#2E3A59', marginBottom: 12 }}>
            View-only access. Ask the parent for logging permission.
          </Text>
          <TouchableOpacity
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
            style={{ padding: 12, backgroundColor: '#CFD8DC', borderRadius: 10, alignItems: 'center' }}
          >
            <Text style={{ color: '#2E3A59', fontWeight: '700' }}>Back</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }


  return (
    <ThemedBackground>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
              <LinearGradient
                colors={darkMode ? currentTheme.card : ['#fff', '#f5f5f5']}
                style={styles.headerButtonGradient}
              >
                <ArrowLeft size={20} color={darkMode ? '#fff' : '#2E3A59'} />
              </LinearGradient>
            </TouchableOpacity>
            <Image source={require('../assets/logo.png')} style={styles.logo} />
            <View style={{ width: 44 }} />
          </View>

          <Text style={[styles.title, { color: currentTheme.textPrimary }]}>Sleeping Log</Text>

          {/* Start Time */}
          <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
            <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Start Time</Text>
            <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.fieldButton}>
              <Text style={{ color: currentTheme.textPrimary }}>{formatTime(startTime)}</Text>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={startTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(e, time) => time && setStartTime(time)}
              />
            )}
          </LinearGradient>

          {/* End Time */}
          <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
            <Text style={[styles.label, { color: currentTheme.textPrimary }]}>End Time</Text>
            <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.fieldButton}>
              <Text style={{ color: currentTheme.textPrimary }}>{formatTime(endTime)}</Text>
            </TouchableOpacity>
            {showEndPicker && (
              <DateTimePicker
                value={endTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(e, time) => time && setEndTime(time)}
              />
            )}
          </LinearGradient>

          {/* Duration */}
          <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
            <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Duration</Text>
            <View style={styles.durationBox}>
              <Text style={{ color: currentTheme.textPrimary, fontWeight: '600' }}>
                {formatDuration()}
              </Text>
            </View>
          </LinearGradient>

          {/* Sleep Type */}
          <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
            <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Sleep Type</Text>
            <TouchableOpacity onPress={() => setShowSleepTypePicker(!showSleepTypePicker)} style={styles.fieldButton}>
              <Text style={{ color: currentTheme.textPrimary }}>
                {sleepType || 'Select Sleep Type'}
              </Text>
            </TouchableOpacity>
            {showSleepTypePicker && (
              <View style={styles.pickerContainer}>
                <Picker selectedValue={sleepType} onValueChange={(val) => setSleepType(val)}>
                  <Picker.Item label="Nap" value="Nap" />
                  <Picker.Item label="Sleep" value="Sleep" />
                </Picker>
              </View>
            )}
          </LinearGradient>

          {/* Submit */}
          <TouchableOpacity onPress={handleCompleteLog} style={{ marginTop: 20 }}>
            <LinearGradient
              colors={darkMode ? ['#8e2de2', '#4a00e0'] : ['#A5D6A7', '#81D4FA']}
              style={styles.submitButton}
            >
              <Text style={styles.submitText}>Complete Log</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
};

const styles = StyleSheet.create({
  container: 
  {
     flex: 1
     },
  scrollContent: 
  {
     padding: 20,
      paddingBottom: 40,
     },
  header:
   {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerButton:
   { 
    borderRadius: 16
   },
  headerButtonGradient: 
  {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: 
  {
     width: 50, 
     height: 50, 
     resizeMode: 'contain' 
    },
  title: 
  { 
    fontSize: 26, 
    fontWeight: '700', 
    textAlign: 'center',
     marginBottom: 20 
    },
  inputCard: 
  {
    borderRadius: 20,
    padding: 15,
    marginVertical: 10,
    elevation: 3,
  },
  label: 
  { 
    fontSize: 16,
     fontWeight: '600',
      marginBottom: 8 
    },
  fieldButton: 
  {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  durationBox: 
  {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pickerContainer:
   {
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  submitButton:
   { 
    borderRadius: 20, 
    paddingVertical: 16, 
    alignItems: 'center' 
  },
  submitText: 
  { color: '#fff', 
    fontWeight: '700', 
    fontSize: 16 
  },
});

export default SleepingForm;