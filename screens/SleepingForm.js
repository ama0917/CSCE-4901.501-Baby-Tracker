import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image, Platform, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { db } from '../firebaseConfig';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useRoute } from '@react-navigation/native';

const SleepingForm = ({ navigation }) => {
  const route = useRoute();
  const { childId, name } = route.params || {};

  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [sleepType, setSleepType] = useState('');
  const [showSleepTypePicker, setShowSleepTypePicker] = useState(false);

  const handleTimeChange = (event, selectedTime, isStart) => {
    if (Platform.OS === 'android') {
      if (selectedTime) {
        isStart ? setStartTime(selectedTime) : setEndTime(selectedTime);
      }
      if (event.type === 'set') { 
        isStart ? setShowStartPicker(false) : setShowEndPicker(false);
      }
    } else {
      if (selectedTime) {
        isStart ? setStartTime(selectedTime) : setEndTime(selectedTime);
      }
    }
  };

  const confirmTimePicker = (isStart) => {
    isStart ? setShowStartPicker(false) : setShowEndPicker(false);
  };

  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const calculateDuration = () => {
    const diffMs = endTime - startTime;
    const adjustedDiffMs = diffMs < 0 ? diffMs + (24 * 60 * 60 * 1000) : diffMs;
    const minutes = Math.floor(adjustedDiffMs / (1000 * 60));
    return minutes;
  };

  const formatDuration = () => {
    const minutes = calculateDuration();
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} hr ${remainingMinutes} min`;
  };

  const handleSleepTypeChange = (itemValue) => {
    setSleepType(itemValue);
  };

  const closeSleepTypePicker = () => {
    setShowSleepTypePicker(false);
  };

  const handleCompleteLog = async () => {
    if (!childId) {
      alert('No child selected');
      return;
    }

    if (!sleepType) {
      alert('Please select a sleep type');
      return;
    }

    try {
      const logData = {
        timestamp: startTime,
        duration: calculateDuration(), // Store as minutes for easier calculations
        childId, // Match the field name in ChildDashboard.js
        sleepType,
        endTime,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'sleepLogs'), logData);
      console.log('Sleep log saved:', logData);
      alert('Log saved successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error adding document: ', error);
      alert('Failed to save log. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backText}>← Back to Dashboard</Text>
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../assets/logo.png')} 
                style={styles.logo}
              />
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.title}>Sleeping Log</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Start Time</Text>
            <TouchableOpacity 
              onPress={() => {
                setShowStartPicker(true);
                setShowEndPicker(false);
                setShowSleepTypePicker(false);
              }} 
              style={styles.timeButton}
            >
              <Text style={styles.timeButtonText}>{formatTime(startTime)}</Text>
            </TouchableOpacity>
            
            {showStartPicker && (
              <>
                <DateTimePicker 
                  value={startTime} 
                  mode="time" 
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedTime) => handleTimeChange(event, selectedTime, true)}
                  style={styles.timePicker}
                />
                
                {Platform.OS === 'ios' && (
                  <TouchableOpacity 
                    style={styles.confirmTimeButton}
                    onPress={() => confirmTimePicker(true)}
                  >
                    <Text style={styles.confirmTimeText}>Confirm Start Time</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>End Time</Text>
            <TouchableOpacity 
              onPress={() => {
                setShowEndPicker(true);
                setShowStartPicker(false);
                setShowSleepTypePicker(false);
              }} 
              style={styles.timeButton}
            >
              <Text style={styles.timeButtonText}>{formatTime(endTime)}</Text>
            </TouchableOpacity>
            
            {showEndPicker && (
              <>
                <DateTimePicker 
                  value={endTime} 
                  mode="time" 
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedTime) => handleTimeChange(event, selectedTime, false)}
                  style={styles.timePicker}
                />
                
                {Platform.OS === 'ios' && (
                  <TouchableOpacity 
                    style={styles.confirmTimeButton}
                    onPress={() => confirmTimePicker(false)}
                  >
                    <Text style={styles.confirmTimeText}>Confirm End Time</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Duration</Text>
            <View style={styles.durationDisplay}>
              <Text style={styles.durationText}>{formatDuration()}</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Type</Text>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => {
                setShowSleepTypePicker(!showSleepTypePicker);
                setShowStartPicker(false);
                setShowEndPicker(false);
              }}
            >
              <Text style={styles.dropdownButtonText}>
                {sleepType || 'Select Sleep Type'}
              </Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>

            {showSleepTypePicker && (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={sleepType}
                  onValueChange={handleSleepTypeChange}
                >
                  <Picker.Item label="Select Type" value="" />
                  <Picker.Item label="Nap" value="Nap" />
                  <Picker.Item label="Sleep" value="Sleep" />
                </Picker>
                
                <TouchableOpacity 
                  style={styles.doneButton}
                  onPress={closeSleepTypePicker}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity 
            style={styles.completeButton}
            onPress={handleCompleteLog}
          >
            <Text style={styles.completeButtonText}>Complete Log</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#d4f1fc',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#d4f1fc',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 50,
    position: 'relative',
  },
  backButton: {
    padding: 8,
    zIndex: 1,
  },
  backText: {
    color: '#007bff',
    fontSize: 12,
  },
  logoContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 60,
    height: 60,
  },
  headerSpacer: {
    width: 80, 
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
  },
  timeButton: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 16,
  },
  timePicker: {
    backgroundColor: Platform.OS === 'ios' ? '#fff' : 'transparent',
    borderRadius: 5,
    marginTop: 5,
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
  durationDisplay: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  durationText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  dropdownButton: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#555',
  },
  dropdownIcon: {
    fontSize: 16,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 5,
    marginTop: 5,
    zIndex: 999,
  },
  doneButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginVertical: 10,
    marginHorizontal: 20,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completeButton: {
    backgroundColor: '#fcfcd4',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SleepingForm;