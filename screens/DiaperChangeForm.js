import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';
import {
  addDoc,
  collection,
  Timestamp,
  doc,
  onSnapshot,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import NotificationService from '../src/notifications/notificationService';
import { useDarkMode } from '../screens/DarkMode';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { ArrowLeft } from 'lucide-react-native';

// add role hook so we can gate logging for caregivers
import useUserRole from './useUserRole';

const getTodayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const DiaperChangeForm = ({ navigation, route }) => {
  const { childId } = route.params || {};
  const { darkMode } = useDarkMode();
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;

  // caregiver role + permission gate
  const { role } = useUserRole();
  const uid = getAuth().currentUser?.uid;
  const [canLog, setCanLog] = useState(role === 'parent');

  // verify we received childId correctly
  console.log('Received childId in DiaperChangeForm:', childId);

  // live permission check — parents always true; caregivers only if parent has allowed
  useEffect(() => {
    if (role === 'parent') {
      setCanLog(true);
      return;
    }
    if (!childId || !uid) {
      setCanLog(false);
      return;
    }
    const ref = doc(db, 'children', childId);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() || {};
      const v = (data.caregiverPerms || {})[uid];
      // allow if owner or caregiver permission is 'on' or 'log'
      setCanLog(data.userId === uid || v === 'on' || v === 'log');
    });
    return () => unsub();
  }, [role, childId, uid]);

  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [bathroomType, setBathroomType] = useState('Diaper Change');
  const [stoolType, setStoolType] = useState('');
  const [showStoolPicker, setShowStoolPicker] = useState(false);

  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const handleCompleteLog = async () => {
    if (!canLog) { 
      Alert.alert('Access is off', 'Parent has turned off access for this child.'); 
      return; 
    }

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Authentication Error', 'You must be logged in to save logs.');
      return;
    }
    if (!stoolType || stoolType === 'default') {
      Alert.alert('Missing Info', 'Please select a stool type.');
      return;
    }
    if (!childId) {
      Alert.alert('Error', 'Child ID is missing. Please go back and try again.');
      return;
    }

    // Check for future time
    const now = new Date();
    if (selectedTime > now) {
      Alert.alert(
        'Future Time Detected',
        'The selected time is in the future. Are you sure you want to continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => checkForDuplicates() }
        ]
      );
      return;
    }

    checkForDuplicates();
  };

const checkForDuplicates = async () => {
  try {
    // Query recent logs for this child today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const logsRef = collection(db, 'diaperLogs');
    const q = query(
      logsRef,
      where('childId', '==', childId),
      where('time', '>=', Timestamp.fromDate(todayStart))
    );

    const snapshot = await getDocs(q);
    const selectedMinutes = selectedTime.getHours() * 60 + selectedTime.getMinutes();
    let hasDuplicate = false;

    snapshot.forEach((docSnap) => {
      const log = docSnap.data();
      const logTime = log.time?.toDate();
      if (logTime) {
        const logMinutes = logTime.getHours() * 60 + logTime.getMinutes();
        // Check if times are within 5 minutes
        if (Math.abs(logMinutes - selectedMinutes) < 5) {
          hasDuplicate = true;
        }
      }
    });

    if (hasDuplicate) {
      Alert.alert(
        'Duplicate Entry',
        'A similar diaper log already exists for this time. Do you want to add it anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Anyway', onPress: () => saveLog() }
        ]
      );
      return;
    }

    await saveLog();
  } catch (error) {
    console.error('Error checking duplicates:', error);
    await saveLog();
  }
};

const saveLog = async () => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    const logData = {
      childId,
      stoolType,
      bathroomType,
      time: Timestamp.fromDate(selectedTime),
      timestamp: Timestamp.now(),
      createdBy: user.uid,
      logDate: getTodayStr(),
    };

    await addDoc(collection(db, 'diaperLogs'), logData);

    try {
      NotificationService.sendDigestNotificationForChild(childId).catch(() => {});
    } catch (e) {}

    Alert.alert('Success', 'Log saved successfully!');
    navigation.goBack();
  } catch (error) {
    console.error('Error saving diaper log:', error);
    Alert.alert('Error', 'Something went wrong. Please try again.');
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

          <Text style={[styles.title, { color: currentTheme.textPrimary }]}>
            Diaper Change / Potty Log
          </Text>

          {/* Time Picker */}
          <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
            <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Time</Text>
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.fieldButton}>
              <Text style={{ color: currentTheme.textPrimary }}>{formatTime(selectedTime)}</Text>
            </TouchableOpacity>
            {showTimePicker && (
              <View>
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, date) => {
                    if (date) setSelectedTime(date);
                    if (Platform.OS === 'android') setShowTimePicker(false);
                  }}
                  textColor={darkMode ? '#fff' : '#2E3A59'}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity 
                    onPress={() => setShowTimePicker(false)} 
                    style={styles.enterButton}
                  >
                    <Text style={styles.enterButtonText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </LinearGradient>

          {/* Bathroom Type */}
          <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
            <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Bathroom Type</Text>
            <View style={styles.toggleContainer}>
              {['Diaper Change', 'Potty'].map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setBathroomType(type)}
                  style={[
                    styles.toggleButton,
                    bathroomType === type && { backgroundColor: darkMode ? '#0072ff' : '#81D4FA' },
                  ]}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      { color: bathroomType === type ? '#fff' : currentTheme.textPrimary },
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </LinearGradient>

          {/* Stool Type */}
          <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
            <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Stool Type</Text>
            <TouchableOpacity onPress={() => setShowStoolPicker(!showStoolPicker)} style={styles.fieldButton}>
              <Text style={{ color: currentTheme.textPrimary }}>
                {stoolType && stoolType !== 'default' ? stoolType : 'Select Stool Type'}
              </Text>
            </TouchableOpacity>
            {showStoolPicker && (
              <View style={styles.pickerContainer}>
                <Picker 
                  selectedValue={stoolType || 'default'} 
                  onValueChange={(val) => setStoolType(val)}
                  style={{ color: darkMode ? '#fff' : '#2E3A59' }}
                  dropdownIconColor={darkMode ? '#fff' : '#2E3A59'}
                >
                  <Picker.Item label="-- Select Stool Type --" value="default" color={darkMode ? '#888' : '#999'} />
                  <Picker.Item label="Wet" value="Wet" color={darkMode ? '#fff' : '#2E3A59'} />
                  <Picker.Item label="BM (Bowel Movement)" value="BM" color={darkMode ? '#fff' : '#2E3A59'} />
                  <Picker.Item label="Dry" value="Dry" color={darkMode ? '#fff' : '#2E3A59'} />
                  <Picker.Item label="Wet + BM (Bowel Movement)" value="Wet+BM" color={darkMode ? '#fff' : '#2E3A59'} />
                </Picker>
                <TouchableOpacity 
                  onPress={() => setShowStoolPicker(false)} 
                  style={styles.enterButton}
                >
                  <Text style={styles.enterButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </LinearGradient>

          {/* Submit */}
          <TouchableOpacity onPress={handleCompleteLog} style={{ marginTop: 20 }}>
            <LinearGradient
              colors={darkMode ? ['#ff6a00', '#ee0979'] : ['#F8BBD9', '#FFB74D']}
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
     paddingBottom: 40 
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
  fieldButton: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pickerContainer: {
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  toggleContainer: 
  { 
    flexDirection: 'row',
     justifyContent: 'space-between'
     },
  toggleButton:
   {
    flex: 1,
    marginHorizontal: 5,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  toggleText: 
  {
     fontSize: 16, 
     fontWeight: '600' 
    },
  submitButton:
   {
     borderRadius: 20,
      paddingVertical: 16, 
      alignItems: 'center' 
    },
  submitText: 
  { 
    color: '#fff',
     fontWeight: '700',
      fontSize: 16 
    },
  enterButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    alignItems: 'center',
    borderRadius: 10,
    marginTop: 10,
    marginHorizontal: 10,
    marginBottom: 10,
    },
  enterButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default DiaperChangeForm;