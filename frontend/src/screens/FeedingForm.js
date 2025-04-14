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
  Alert
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthContext } from '../contexts/useAuthContext';
import { getFreshToken } from '../services/auth';

const FeedingForm = ({ navigation }) => {
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [foodType, setFoodType] = useState('');
  const [amount, setAmount] = useState('');
  const [mealType, setMealType] = useState('');
  const [showMealPicker, setShowMealPicker] = useState(false);
  const { childId } = useAuthContext();

  // Handle Time Selection with improved UX
  const handleTimeChange = (event, selected) => {
  // Only for Android we immediately update the time as user scrolls
    if (Platform.OS === 'android') {
      if (selected) setSelectedTime(selected);
      if (event.type === 'set') {
        setShowTimePicker(false);
      }
    } else {
      // iOS behavior
      if (selected) setSelectedTime(selected);
      // Don't close picker automatically on iOS
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

  const handleCompleteLog = async () => {
    try {
      const token = await getFreshToken();
      const res = await fetch(`http://<backend_url>/log?child_id=${childId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activity: 'Feeding',
          timestamp: new Date().toISOString(),
          type: `${foodType} ${amount} ${mealType}`.trim(),
        }),
      });

      if (res.ok) {
        Alert.alert("Success", "Feeding log submitted!");
        navigation.goBack(); // Navigate back to the previous screen
      } else {
        Alert.alert("Error", "Failed to submit feeding log.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "An error occurred while submitting the feeding log.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.formContainer}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>← Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/logo.png')} 
            style={styles.logo}
          />
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Type</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter type of food..."
            value={foodType}
            onChangeText={setFoodType}
          />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            style={styles.textInput}
            placeholder="Enter amount of food (if applicable)..."
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        <View style={styles.inputGroup}>
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
                  setShowMealPicker(false);
                }}
              >
                <Picker.Item label="Select Meal Type" value="" />
                <Picker.Item label="Breakfast" value="Breakfast" />
                <Picker.Item label="Lunch" value="Lunch" />
                <Picker.Item label="Dinner" value="Dinner" />
                <Picker.Item label="Snack" value="Snack" />
              </Picker>
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
    </SafeAreaView>
  );
};

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
    fontSize: 16,
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
    color: '#000000',
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
    color: '#000',
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
  textInput: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 5,
    fontSize: 16,
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
    marginBottom: 10,
  },
  completeButton: {
    backgroundColor: '#fcfcd4',
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

export default FeedingForm;