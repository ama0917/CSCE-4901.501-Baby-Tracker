import React, { useState } from 'react';
import { View, Text, Button, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

const SleepingLogScreen = ({ navigation }) => {
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [sleepType, setSleepType] = useState('');

  // Handle Time Change
  const handleTimeChange = (event, selectedTime, isStart) => {
    if (selectedTime) {
      isStart ? setStartTime(selectedTime) : setEndTime(selectedTime);
    }
    isStart ? setShowStartPicker(false) : setShowEndPicker(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>← Back to Dashboard</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Sleeping Log</Text>

      {/* Start Time */}
      <Text style={styles.label}>Start Time</Text>
      <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.timeButton}>
        <Text>{startTime.toLocaleTimeString()}</Text>
      </TouchableOpacity>
      {showStartPicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          display="spinner"
          onChange={(event, selectedTime) => handleTimeChange(event, selectedTime, true)}
        />
      )}

      {/* End Time */}
      <Text style={styles.label}>End Time</Text>
      <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.timeButton}>
        <Text>{endTime.toLocaleTimeString()}</Text>
      </TouchableOpacity>
      {showEndPicker && (
        <DateTimePicker
          value={endTime}
          mode="time"
          display="spinner"
          onChange={(event, selectedTime) => handleTimeChange(event, selectedTime, false)}
        />
      )}

      {/* Sleep Type Picker */}
      <Text style={styles.label}>Type</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={sleepType} onValueChange={(itemValue) => setSleepType(itemValue)}>
          <Picker.Item label="Select Type" value="" />
          <Picker.Item label="Nap" value="nap" />
          <Picker.Item label="Sleep" value="sleep" />
        </Picker>
      </View>

      {/* Submit Button */}
      <TouchableOpacity style={styles.submitButton} onPress={() => alert('Log saved!')}>
        <Text style={styles.submitText}>Complete Log</Text>
      </TouchableOpacity>
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#E3F2FD' },
  backButton: { marginBottom: 20 },
  backText: { fontSize: 16, color: '#007AFF' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 18, marginBottom: 5 },
  timeButton: { padding: 10, backgroundColor: '#FFF', borderRadius: 5, marginBottom: 10, alignItems: 'center' },
  pickerContainer: { backgroundColor: '#FFF', borderRadius: 5, marginBottom: 10 },
  submitButton: { backgroundColor: '#FFD700', padding: 15, borderRadius: 5, alignItems: 'center' },
  submitText: { fontSize: 18, fontWeight: 'bold' },
});

export default SleepingLogScreen;
