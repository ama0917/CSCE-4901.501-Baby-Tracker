import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

const SleepingLogScreen = ({ navigation }) => {
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [sleepType, setSleepType] = useState('');
  const [showSleepTypePicker, setShowSleepTypePicker] = useState(false);

  // Handle Time Change with improved UX
  const handleTimeChange = (event, selectedTime, isStart) => {
    // Only for Android we immediately update the time as user scrolls
    if (Platform.OS === 'android') {
      if (selectedTime) {
        isStart ? setStartTime(selectedTime) : setEndTime(selectedTime);
      }
      // Don't close the picker on Android until user presses "OK"
      if (event.type === 'set') { // User pressed "OK"
        isStart ? setShowStartPicker(false) : setShowEndPicker(false);
      }
    } else {
      // iOS behavior
      if (selectedTime) {
        isStart ? setStartTime(selectedTime) : setEndTime(selectedTime);
      }
      // Don't close picker automatically on iOS
    }
  };

  // Function to close the time picker (for iOS and manual close)
  const confirmTimePicker = (isStart) => {
    isStart ? setShowStartPicker(false) : setShowEndPicker(false);
  };

  // Format time to hours:minutes AM/PM
  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return `${hours}:${minutes} ${ampm}`;
  };

  // Calculate duration between start and end times
  const calculateDuration = () => {
    const diffMs = endTime - startTime;
    
    // If end time is earlier than start time, assume it's the next day
    const adjustedDiffMs = diffMs < 0 ? diffMs + (24 * 60 * 60 * 1000) : diffMs;
    
    const hours = Math.floor(adjustedDiffMs / (1000 * 60 * 60));
    const minutes = Math.floor((adjustedDiffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours} hr ${minutes} min`;
  };

  const handleCompleteLog = () => {
    // Save the data
    const logData = {
      startTime: startTime,
      endTime: endTime,
      duration: calculateDuration(),
      sleepType: sleepType,
    };
    console.log('Log saved:', logData);
    alert('Log saved successfully!');
    // Navigate back or clear form
    // navigation.navigate('Dashboard');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.formContainer}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>← Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
        
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/logo.png')} 
            style={styles.logo}
          />
        </View>

        <Text style={styles.title}>Sleeping Log</Text>

        {/* Start Time */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Start Time</Text>
          <TouchableOpacity 
            onPress={() => setShowStartPicker(true)} 
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
              
              {/* Only show confirm button on iOS since Android has built-in OK/Cancel */}
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

        {/* End Time */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>End Time</Text>
          <TouchableOpacity 
            onPress={() => setShowEndPicker(true)} 
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
              
              {/* Only show confirm button on iOS since Android has built-in OK/Cancel */}
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

        {/* Duration (calculated) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Duration</Text>
          <View style={styles.durationDisplay}>
            <Text style={styles.durationText}>{calculateDuration()}</Text>
          </View>
        </View>

        {/* Sleep Type Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Type</Text>
          <TouchableOpacity 
            style={styles.dropdownButton}
            onPress={() => setShowSleepTypePicker(!showSleepTypePicker)}
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
                onValueChange={(itemValue) => {
                  setSleepType(itemValue);
                  setShowSleepTypePicker(false);
                }}
              >
                <Picker.Item label="Select Type" value="" />
                <Picker.Item label="Nap" value="nap" />
                <Picker.Item label="Sleep" value="sleep" />
              </Picker>
            </View>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={styles.completeButton}
          onPress={handleCompleteLog}
        >
          <Text style={styles.completeButtonText}>Complete Log</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#d4f1fc',
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#d4f1fc',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  backButton: {
    padding: 5,
  },
  backText: {
    color: '#007bff',
    fontSize: 12,
  },
  logoContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
  },
  logo: {
    width: 30,
    height: 30,
    marginRight: 5,
  },
  logoText: {
    fontSize: 18,
    color: '#007bff',
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
  },
  completeButton: {
    backgroundColor: '#fcfcd4', // Light yellow like in other forms
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SleepingLogScreen;