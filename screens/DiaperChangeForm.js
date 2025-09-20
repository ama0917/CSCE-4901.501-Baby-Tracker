import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image, Platform, ScrollView, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient} from 'expo-linear-gradient';
import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import useUserRole from './useUserRole';
import { doc, onSnapshot } from 'firebase/firestore';

const getTodayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`; // e.g., "2025-09-20"
};


const DiaperChangeForm = ({ navigation, route }) => {
  const { childId } = route.params || {};
  const { role } = useUserRole();
  const uid = getAuth().currentUser?.uid;
  const [canLog, setCanLog] = useState(role === 'parent');
  
  // Add console logging to verify childId is received correctly
  console.log('Received childId in DiaperChangeForm:', childId);

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

  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [bathroomType, setBathroomType] = useState('Diaper Change');
  const [stoolType, setStoolType] = useState('');
  const [showStoolPicker, setShowStoolPicker] = useState(false);

  const handleTimeChange = (event, selected) => {
    if (Platform.OS === 'android') {
      if (selected) setSelectedTime(selected);
      if (event.type === 'set') setShowTimePicker(false);
    } else {
      if (selected) setSelectedTime(selected);
    }
  };

  const confirmTimePicker = () => {
    setShowTimePicker(false);
  };

  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const handleCompleteLog = async () => {
    if (!canLog) { Alert.alert('Access is off', 'Parent has turned off access for this child.'); return; }
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        Alert.alert('Authentication Error', 'You must be logged in to save logs.');
        return;
      }

      if (!stoolType) {
        Alert.alert('Missing Info', 'Please select a stool type.');
        return;
      }
      
      if (!childId) {
        Alert.alert('Error', 'Child ID is missing. Please go back and try again.');
        return;
      }

      const logData = {
        childId: childId,
        stoolType: stoolType,
        bathroomType: bathroomType,
        time: Timestamp.fromDate(selectedTime),
        timestamp: Timestamp.now(),
        createdBy: user.uid,
        logDate: getTodayStr(),
      };
      

      console.log('Saving diaper log with data:', logData);

      await addDoc(collection(db, 'diaperLogs'), logData);

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
     <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={styles.gradient}>
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.formContainer}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Dashboard</Text>
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <Image source={require('../assets/logo.png')} style={styles.logo} />
            </View>
            <View style={styles.headerRightSpace} />
          </View>

          <Text style={styles.title}>Diaper Change/Potty Log</Text>

          {/* Time Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Time</Text>
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.timeButton}>
              <Text style={styles.timeButtonText}>{formatTime(selectedTime)}</Text>
            </TouchableOpacity>

            {showTimePicker && (
              <View style={styles.timePickerContainer}>
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleTimeChange}
                  style={[styles.timePicker, { width: '100%' }]}
                />

                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={styles.confirmTimeButton} onPress={confirmTimePicker}>
                    <Text style={styles.confirmTimeText}>Confirm Time</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Bathroom Type Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Select Bathroom Type</Text>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, bathroomType === 'Diaper Change' && styles.selectedButton]}
                onPress={() => setBathroomType('Diaper Change')}
              >
                <Text style={[styles.toggleText, bathroomType === 'Diaper Change' && styles.selectedText]}>
                  Diaper Change
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, bathroomType === 'Potty' && styles.selectedButton]}
                onPress={() => setBathroomType('Potty')}
              >
                <Text style={[styles.toggleText, bathroomType === 'Potty' && styles.selectedText]}>Potty</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stool Type Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Stool Type</Text>
            <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowStoolPicker(!showStoolPicker)}>
              <Text style={styles.dropdownButtonText}>{stoolType || 'Select Stool Type'}</Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>

            {showStoolPicker && (
              <View style={styles.pickerContainer}>
                <Picker selectedValue={stoolType} onValueChange={(itemValue) => setStoolType(itemValue)}>
                  <Picker.Item label="Select Stool Type" value="" />
                  <Picker.Item label="Wet" value="Wet" />
                  <Picker.Item label="BM" value="BM" />
                  <Picker.Item label="Dry" value="Dry" />
                  <Picker.Item label="Wet + BM" value="Wet+BM" />
                </Picker>
                <TouchableOpacity style={styles.confirmPickerButton} onPress={() => setShowStoolPicker(false)}>
                  <Text style={styles.confirmPickerText}>Confirm Selection</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity style={styles.completeButton} onPress={handleCompleteLog}>
            <Text style={styles.completeButtonText}>Complete Log</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
    </LinearGradient>
  );
};

// Styles (same as your original, unchanged)
const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  formContainer: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 50,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#007bff',
    fontSize: 12,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -20,
  },
  logo: {
    width: 60,
    height: 60,
  },
  headerRightSpace: {
    width: 70,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 10,
    fontWeight: '500',
  },
  timeButton: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timeButtonText: {
    fontSize: 16,
    color: '#333',
  },
  timePickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 5,
    marginTop: 5,
    padding: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timePicker: {
    backgroundColor: Platform.OS === 'ios' ? '#fff' : 'transparent',
    borderRadius: 5,
  },
  confirmTimeButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  confirmTimeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toggleButton: {
    flex: 1,
    padding: 15,
    backgroundColor: '#fff',
    alignItems: 'center',
    marginHorizontal: 5,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedButton: {
    backgroundColor: '#4CAF50',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  selectedText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dropdownButton: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownIcon: {
    fontSize: 16,
    color: '#333',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 5,
    marginTop: 5,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  confirmPickerButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  confirmPickerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completeButton: {
    backgroundColor: '#fcfcd4',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default DiaperChangeForm;
