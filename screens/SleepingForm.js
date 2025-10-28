import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image, Platform, ScrollView, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../firebaseConfig';
import { addDoc, collection, serverTimestamp, doc, onSnapshot, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useRoute } from '@react-navigation/native';

import { ArrowLeft, AlarmClock, Pencil } from 'lucide-react-native';
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

  // Fetch incomplete logs
useEffect(() => {
  if (!childId) return;
  
  const { query, where, getDocs, orderBy } = require('firebase/firestore');
  const logsRef = collection(db, 'sleepLogs');
  
  const fetchIncompleteLogs = async () => {
    try {
      const q = query(
        logsRef,
        where('childId', '==', childId),
        where('incomplete', '==', true)
      );
      
      const snapshot = await getDocs(q);
      const logs = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate()
        });
      });
      
      // Sort by timestamp descending (newest first)
      logs.sort((a, b) => b.timestamp - a.timestamp);
      setIncompleteLogs(logs);
    } catch (error) {
      console.error('Error fetching incomplete logs:', error);
    }
  };
  
  fetchIncompleteLogs();
  
  // Set up real-time listener
  const q = query(
    logsRef,
    where('childId', '==', childId),
    where('incomplete', '==', true)
  );
  
  const unsub = onSnapshot(q, (snapshot) => {
    const logs = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate()
      });
    });
    logs.sort((a, b) => b.timestamp - a.timestamp);
    setIncompleteLogs(logs);
  });
  
  return () => unsub();
}, [childId]);

  const { darkMode } = useDarkMode();
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;

  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [sleepType, setSleepType] = useState('');
  const [showSleepTypePicker, setShowSleepTypePicker] = useState(false);
  const [isIncompleteLog, setIsIncompleteLog] = useState(false);
  const [incompleteLogs, setIncompleteLogs] = useState([]);
  const [editingLogId, setEditingLogId] = useState(null);

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

  const loadIncompleteLog = (log) => {
    setEditingLogId(log.id);
    setStartTime(log.timestamp);
    setSleepType(log.sleepType);
    setEndTime(new Date()); // Set to current time
    setIsIncompleteLog(false); // Allow them to set end time
    setShowEndPicker(true); // Auto-open the end time picker
  };

  const handleCompleteLog = async () => {
    if (!canLog) { 
      alert('Access is off. The parent has disabled access for this child.'); 
      return; 
    }
    if (!childId) {
      Alert.alert('Error', 'No child selected');
      return;
    }
    if (!sleepType || sleepType === 'default') {
      Alert.alert('Error', 'Please select a sleep type');
      return;
    }

    // Check for future times and show disclaimer
    const now = new Date();
    if (startTime > now) {
      Alert.alert(
        'Future Time Detected',
        'The start time is in the future. Are you sure you want to continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            onPress: () => checkEndTime() 
          }
        ]
      );
      return;
    }

    checkEndTime();
  };

const checkEndTime = () => {
  const now = new Date();
  if (endTime > now && !isIncompleteLog) {
    Alert.alert(
      'Future Time Detected',
      'The end time is in the future. Are you sure you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue', 
          onPress: () => checkForDuplicates() 
        }
      ]
    );
    return;
  }

  checkForDuplicates();
};

const checkForDuplicates = async () => {
  // Skip duplicate check if editing existing log
  if (!editingLogId) {
    // Check for duplicate entries (same child, similar times on same day)
    const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();

    try {
      // Query recent logs for this child today
      const logsRef = collection(db, 'sleepLogs');
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const q = query(
        logsRef,
        where('childId', '==', childId),
        where('timestamp', '>=', todayStart)
      );
      
      const snapshot = await getDocs(q);
      let hasDuplicate = false;
      
      snapshot.forEach((docSnap) => {
        const log = docSnap.data();
        const logStart = log.timestamp?.toDate();
        if (logStart) {
          const logStartMin = logStart.getHours() * 60 + logStart.getMinutes();
          // Check if times are within 5 minutes
          if (Math.abs(logStartMin - startMinutes) < 5) {
            hasDuplicate = true;
          }
        }
      });

      if (hasDuplicate) {
        Alert.alert(
          'Duplicate Entry',
          'A similar sleep log already exists for this time. Do you want to add it anyway?',
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
      await saveLog(); // Proceed anyway if check fails
    }
  } else {
    await saveLog();
  }
};

  const saveLog = async () => {
    try {
      if (editingLogId) {
        // Update existing log - only include fields we want to update
        const updateData = {
          timestamp: startTime,
          duration: isIncompleteLog ? null : calculateDuration(),
          sleepType,
          endTime: isIncompleteLog ? null : endTime,
          incomplete: isIncompleteLog,
          updatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, 'sleepLogs', editingLogId), updateData);
        Alert.alert('Success', 'Sleep log updated!');
      } else {
        // Create new log
        const logData = {
          timestamp: startTime,
          duration: isIncompleteLog ? null : calculateDuration(),
          childId,
          sleepType,
          endTime: isIncompleteLog ? null : endTime,
          incomplete: isIncompleteLog,
          createdAt: serverTimestamp()
        };
        
        await addDoc(collection(db, 'sleepLogs'), logData);
        Alert.alert('Success', 'Sleep log saved!');
      }
      
      navigation.goBack();
    } catch (error) {
      console.error('Error saving sleep log:', error);
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

          {/* Incomplete Logs Section */}
          {incompleteLogs.length > 0 && (
            <View style={styles.incompleteLogsContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AlarmClock 
                  size={20} 
                  color={currentTheme.textPrimary} 
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.incompleteLogsTitle, { color: currentTheme.textPrimary }]}>
                  Still Sleeping ({incompleteLogs.length})
                </Text>
              </View>
              {incompleteLogs.map((log) => (
                <TouchableOpacity
                  key={log.id}
                  onPress={() => loadIncompleteLog(log)}
                  style={[
                    styles.incompleteLogCard,
                    editingLogId === log.id && styles.incompleteLogCardActive
                  ]}
                >
                  <LinearGradient
                    colors={editingLogId === log.id 
                      ? ['#4CAF50', '#45a049'] 
                      : darkMode ? ['#424242', '#303030'] : ['#fff3e0', '#ffe0b2']
                    }
                    style={styles.incompleteLogGradient}
                  >
                    <View style={styles.incompleteLogContent}>
                      <View>
                        <Text style={[styles.incompleteLogType, { 
                          color: editingLogId === log.id ? '#fff' : currentTheme.textPrimary 
                        }]}>
                          {log.sleepType}
                        </Text>
                        <Text style={[styles.incompleteLogTime, { 
                          color: editingLogId === log.id ? '#fff' : currentTheme.textSecondary 
                        }]}>
                          Started: {formatTime(log.timestamp)}
                        </Text>
                      </View>
                      <View style={styles.incompleteLogBadge}>
                        <Text
                          style={[
                            styles.incompleteLogBadgeText,
                            {
                              color:
                                editingLogId === log.id
                                  ? '#fff'
                                  : '#ecececff',
                            },
                          ]}
                        >
                          {editingLogId === log.id ? '✓ Editing' : 'Tap to Complete'}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {editingLogId && (
            <View style={styles.editingBanner}>
              <LinearGradient
                colors={['#4CAF50', '#45a049']}
                style={styles.editingBannerGradient}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pencil 
                    size={18} 
                    color='#fafafaff'
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.editingBannerText}>
                    Editing incomplete log - Set the end time below
                  </Text>
                </View>
                  <TouchableOpacity 
                  onPress={() => {
                    setEditingLogId(null);
                    setStartTime(new Date());
                    setEndTime(new Date());
                    setSleepType('');
                    setIsIncompleteLog(false);
                  }}
                  style={styles.cancelEditButton}
                >
                  <Text style={styles.cancelEditText}>Cancel</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}

          {/* Start Time */}
          <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
            <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Start Time</Text>
            <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.fieldButton}>
              <Text style={{ color: currentTheme.textPrimary }}>{formatTime(startTime)}</Text>
            </TouchableOpacity>
            {showStartPicker && (
              <View>
                <DateTimePicker
                  value={startTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, time) => {
                    if (time) setStartTime(time);
                    if (Platform.OS === 'android') setShowStartPicker(false);
                  }}
                  textColor={darkMode ? '#fff' : '#2E3A59'}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity 
                    onPress={() => setShowStartPicker(false)} 
                    style={styles.enterButton}
                  >
                    <Text style={styles.enterButtonText}>Enter</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </LinearGradient>

          {/* End Time */}
          <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[styles.label, { marginBottom: 0, color: currentTheme.textPrimary }]}>End Time</Text>
              <TouchableOpacity 
                onPress={() => setIsIncompleteLog(!isIncompleteLog)}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={[styles.checkbox, { borderColor: currentTheme.textPrimary }]}>
                  {isIncompleteLog && <View style={styles.checkboxInner} />}
                </View>
                <Text style={{ color: currentTheme.textSecondary, fontSize: 12, marginLeft: 6 }}>
                  Still sleeping
                </Text>
              </TouchableOpacity>
            </View>
            {!isIncompleteLog ? (
              <>
                <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.fieldButton}>
                  <Text style={{ color: currentTheme.textPrimary }}>{formatTime(endTime)}</Text>
                </TouchableOpacity>
                {showEndPicker && (
                  <View>
                    <DateTimePicker
                      value={endTime}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(e, time) => {
                        if (time) setEndTime(time);
                        if (Platform.OS === 'android') setShowEndPicker(false);
                      }}
                      textColor={darkMode ? '#fff' : '#2E3A59'}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity 
                        onPress={() => setShowEndPicker(false)} 
                        style={styles.enterButton}
                      >
                        <Text style={styles.enterButtonText}>Enter</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.fieldButton}>
                <Text style={{ color: currentTheme.textSecondary, fontStyle: 'italic' }}>
                  To be completed later
                </Text>
              </View>
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
                {sleepType && sleepType !== 'default' ? sleepType : 'Select Sleep Type'}
              </Text>
            </TouchableOpacity>
            {showSleepTypePicker && (
              <View style={styles.pickerContainer}>
                <Picker 
                  selectedValue={sleepType || 'default'} 
                  onValueChange={(val) => setSleepType(val)}
                  style={{ color: darkMode ? '#fff' : '#2E3A59' }}
                  dropdownIconColor={darkMode ? '#fff' : '#2E3A59'}
                >
                  <Picker.Item label="-- Select Sleep Type --" value="default" color={darkMode ? '#888' : '#999'} />
                  <Picker.Item label="Nap" value="Nap" color={darkMode ? '#fff' : '#2E3A59'} />
                  <Picker.Item label="Sleep" value="Sleep" color={darkMode ? '#fff' : '#2E3A59'} />
                </Picker>
                <TouchableOpacity 
                  onPress={() => setShowSleepTypePicker(false)} 
                  style={styles.enterButton}
                >
                  <Text style={styles.enterButtonText}>Enter</Text>
                </TouchableOpacity>
              </View>
            )}
          </LinearGradient>

          {/* Submit */}
          <TouchableOpacity onPress={handleCompleteLog} style={{ marginTop: 20 }}>
            <LinearGradient
              colors={darkMode ? ['#8e2de2', '#4a00e0'] : ['#A5D6A7', '#81D4FA']}
              style={styles.submitButton}
            >
              <Text style={styles.submitText}>
                {editingLogId ? 'Update Log' : 'Complete Log'}
              </Text>
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
    container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerButton: { borderRadius: 16 },
  headerButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: { width: 50, height: 50, resizeMode: 'contain' },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  inputCard: {
    borderRadius: 20,
    padding: 15,
    marginVertical: 10,
    elevation: 3,
  },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  fieldButton: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  durationBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pickerContainer: {
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
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
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxInner: {
    width: 12,
    height: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  submitButton: { borderRadius: 20, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  incompleteLogsContainer: {
  marginBottom: 20,
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  borderRadius: 16,
  padding: 12,
},
incompleteLogsTitle: {
  fontSize: 18,
  fontWeight: '700',
  marginBottom: 12,
},
incompleteLogCard: {
  marginBottom: 10,
  borderRadius: 12,
  overflow: 'hidden',
  elevation: 2,
},
incompleteLogCardActive: {
  borderWidth: 2,
  borderColor: '#4CAF50',
},
incompleteLogGradient: {
  borderRadius: 12,
},
incompleteLogContent: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 14,
},
incompleteLogType: {
  fontSize: 16,
  fontWeight: '700',
  marginBottom: 4,
},
incompleteLogTime: {
  fontSize: 13,
},
incompleteLogBadge: {
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 12,
},
incompleteLogBadgeText: {
  color: '#fff',
  fontSize: 11,
  fontWeight: '600',
},
editingBanner: {
  marginBottom: 16,
  borderRadius: 12,
  overflow: 'hidden',
},
editingBannerGradient: {
  padding: 14,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
editingBannerText: {
  color: '#fff',
  fontWeight: '600',
  fontSize: 14,
  flex: 1,
},
cancelEditButton: {
  backgroundColor: 'rgba(255, 255, 255, 0.3)',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 8,
},
cancelEditText: {
  color: '#fff',
  fontWeight: '600',
  fontSize: 12,
},
});

export default SleepingForm;