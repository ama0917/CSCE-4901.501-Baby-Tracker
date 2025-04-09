import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

const DiaperChangeScreen = ({ navigation }) => {
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [bathroomType, setBathroomType] = useState('Diaper Change'); // Default
  const [stoolType, setStoolType] = useState('');
  const [showStoolPicker, setShowStoolPicker] = useState(false);
  
  // Handle Time Selection - modified for better UX
  const handleTimeChange = (event, selected) => {
    // Only for Android we immediately update the time as user scrolls
    if (Platform.OS === 'android') {
      if (selected) setSelectedTime(selected);
      // Don't close the picker on Android until user presses "OK"
      if (event.type === 'set') { // User pressed "OK"
        setShowTimePicker(false);
      }
    } else {
      // iOS behavior
      if (selected) setSelectedTime(selected);
      // Don't close picker automatically on iOS
    }
  };
  
  // Function to close the time picker (for iOS and manual close)
  const confirmTimePicker = () => {
    setShowTimePicker(false);
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

  const handleCompleteLog = () => {
    // Save the data
    const logData = {
      time: selectedTime,
      bathroomType: bathroomType,
      stoolType: stoolType,
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

        <Text style={styles.title}>Diaper Change/Potty Log</Text>

        {/* Time Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Time</Text>
          <TouchableOpacity 
            onPress={() => setShowTimePicker(true)} 
            style={styles.timeButton}
          >
            <Text style={styles.timeButtonText}>{formatTime(selectedTime)}</Text>
          </TouchableOpacity>
          
          {showTimePicker && (
            <>
              <DateTimePicker 
                value={selectedTime} 
                mode="time" 
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
                style={styles.timePicker}
              />
              
              {/* Only show confirm button on iOS since Android has built-in OK/Cancel */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity 
                  style={styles.confirmTimeButton}
                  onPress={confirmTimePicker}
                >
                  <Text style={styles.confirmTimeText}>Confirm Time</Text>
                </TouchableOpacity>
              )}
            </>
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
              <Text style={[styles.toggleText, bathroomType === 'Diaper Change' && styles.selectedText]}>Diaper Change</Text>
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
          <TouchableOpacity 
            style={styles.dropdownButton}
            onPress={() => setShowStoolPicker(!showStoolPicker)}
          >
            <Text style={styles.dropdownButtonText}>
              {stoolType || 'Select Stool Type'}
            </Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </TouchableOpacity>

          {showStoolPicker && (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={stoolType}
                onValueChange={(itemValue) => {
                  setStoolType(itemValue);
                  setShowStoolPicker(false);
                }}
              >
                <Picker.Item label="Select Stool Type" value="" />
                <Picker.Item label="Wet" value="wet" />
                <Picker.Item label="BM" value="bm" />
                <Picker.Item label="Dry" value="dry" />
                <Picker.Item label="Wet + BM" value="wet+bm" />
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
  },
  selectedButton: {
    backgroundColor: '#4CAF50', // Green when selected
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectedText: {
    color: '#fff', // White text when selected
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
    backgroundColor: '#fcfcd4', // Light yellow like in the feeding form
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

export default DiaperChangeScreen;