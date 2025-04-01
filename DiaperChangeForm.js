import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

const DiaperChangeScreen = ({ navigation }) => {
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [bathroomType, setBathroomType] = useState('Diaper Change'); // Default
  const [stoolType, setStoolType] = useState('');

  // Handle Time Selection
  const handleTimeChange = (event, selected) => {
    if (selected) setSelectedTime(selected);
    setShowTimePicker(false);
  };

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>← Back to Dashboard</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Diaper Change/Potty Log</Text>

      {/* Time Picker */}
      <Text style={styles.label}>Time</Text>
      <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.timeButton}>
        <Text>{selectedTime.toLocaleTimeString()}</Text>
      </TouchableOpacity>
      {showTimePicker && (
        <DateTimePicker value={selectedTime} mode="time" display="spinner" onChange={handleTimeChange} />
      )}

      {/* Bathroom Type Selection */}
      <Text style={styles.label}>Select Bathroom Type</Text>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, bathroomType === 'Diaper Change' && styles.selectedButton]}
          onPress={() => setBathroomType('Diaper Change')}
        >
          <Text style={styles.toggleText}>Diaper Change</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, bathroomType === 'Potty' && styles.selectedButton]}
          onPress={() => setBathroomType('Potty')}
        >
          <Text style={styles.toggleText}>Potty</Text>
        </TouchableOpacity>
      </View>

      {/* Stool Type Picker */}
      <Text style={styles.label}>Stool Type</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={stoolType} onValueChange={(itemValue) => setStoolType(itemValue)}>
          <Picker.Item label="Select Stool Type" value="" />
          <Picker.Item label="Wet" value="wet" />
          <Picker.Item label="BM" value="bm" />
          <Picker.Item label="Dry" value="dry" />
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
  toggleContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  toggleButton: { flex: 1, padding: 10, backgroundColor: '#DDD', alignItems: 'center', marginHorizontal: 5, borderRadius: 5 },
  selectedButton: { backgroundColor: '#4CAF50' },
  toggleText: { fontSize: 16, fontWeight: 'bold' },
  pickerContainer: { backgroundColor: '#FFF', borderRadius: 5, marginBottom: 10 },
  submitButton: { backgroundColor: '#FFD700', padding: 15, borderRadius: 5, alignItems: 'center' },
  submitText: { fontSize: 18, fontWeight: 'bold' },
});

export default DiaperChangeScreen;
