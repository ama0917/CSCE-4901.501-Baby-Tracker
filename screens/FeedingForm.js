import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
  Image,
  Platform,
  ScrollView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

const FeedingForm = ({ navigation }) => {
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [foodType, setFoodType] = useState('');
  const [amount, setAmount] = useState('');
  const [mealType, setMealType] = useState('');
  const [showMealPicker, setShowMealPicker] = useState(false);

  const handleTimeChange = (event, selected) => {
    if (Platform.OS === 'android') {
      if (selected) setSelectedTime(selected);
      if (event.type === 'set') { 
        setShowTimePicker(false);
      }
    } else {
      if (selected) setSelectedTime(selected);
    }
  };
  
  const confirmTimePicker = () => {
    setShowTimePicker(false);
  };

  // Format time to hours:minutes AM/PM
  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${hours}:${minutes} ${ampm}`;
  };

  const handleCompleteLog = () => {
    // Here you would handle saving the data
    console.log({
      time: formatTime(selectedTime),
      foodType,
      amount,
      mealType
    });
    
    navigation.goBack();
    alert('Feeding log saved successfully!');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
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
            
            <View style={styles.headerRightSpace} />
          </View>

          <Text style={styles.title}>Feeding Log</Text>

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
              <View style={styles.timePickerContainer}>
                <DateTimePicker 
                  value={selectedTime} 
                  mode="time" 
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleTimeChange}
                  style={[styles.timePicker, {width: '100%'}]}
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
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Type</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter type of food..."
              placeholderTextColor="#999"
              value={foodType}
              onChangeText={setFoodType}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter amount of food (if applicable)..."
              placeholderTextColor="#999"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Meal Type</Text>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowMealPicker(!showMealPicker)}
            >
              <Text style={styles.dropdownButtonText}>
                {mealType || 'Select Meal Type'}
              </Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>

            {showMealPicker && (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={mealType}
                  onValueChange={(itemValue) => {
                    setMealType(itemValue);
                  }}
                >
                  <Picker.Item label="Select Meal Type" value="" />
                  <Picker.Item label="Breakfast" value="Breakfast" />
                  <Picker.Item label="Lunch" value="Lunch" />
                  <Picker.Item label="Dinner" value="Dinner" />
                  <Picker.Item label="Snack" value="Snack" />
                </Picker>
                
                {/* Add a confirm button to close the picker */}
                <TouchableOpacity 
                  style={styles.confirmPickerButton}
                  onPress={() => setShowMealPicker(false)}
                >
                  <Text style={styles.confirmPickerText}>Confirm Selection</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#d4f1fc',
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
    marginLeft: -70, 
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
  textInput: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 5,
    fontSize: 16,
    color: '#333', // Dark text color for better visibility
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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

export default FeedingForm;