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
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Alert
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRoute } from '@react-navigation/native';

import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { LinearGradient} from 'expo-linear-gradient';

const FeedingForm = ({ navigation }) => {
  const route = useRoute();
  const { childId, name } = route.params || {};

  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [foodType, setFoodType] = useState('');
  const [customFoodType, setCustomFoodType] = useState('');
  const [amount, setAmount] = useState('');
  const [amountUnit, setAmountUnit] = useState('');
  const [mealType, setMealType] = useState('');
  const [notes, setNotes] = useState('');

  const [showMealPicker, setShowMealPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showFoodPicker, setShowFoodPicker] = useState(false);

  const handleTimeChange = (event, selected) => {
    if (Platform.OS === 'android') {
      if (selected) setSelectedTime(selected);
      if (event.type === 'set') setShowTimePicker(false);
    } else {
      if (selected) setSelectedTime(selected);
    }
  };

  const confirmTimePicker = () => setShowTimePicker(false);
  const [amountFocused, setAmountFocused] = useState(false);

  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const handleCompleteLog = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
  
    if (!user) {
      alert('User not logged in');
      return;
    }
  
    if (!mealType || (!foodType && !customFoodType) || !amount || !amountUnit) {
      alert('Please fill in all required fields before saving the log');
      return;
    }
  
    if (!childId) {
      alert('No child selected');
      return;
    }
  
    // Convert to number
    const numericAmount = parseFloat(amount);
  
    // Example thresholds (adjust as needed)
    const MAX_AMOUNT = 1000; // absolute max cap
    const WARNING_AMOUNT = 500; // show disclaimer above this
  
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert('Please enter a valid positive number for amount');
      return;
    }
  
    if (numericAmount > MAX_AMOUNT) {
      alert(
        `The entered amount (${numericAmount} ${amountUnit}) is too large to be valid. Please double-check.`
      );
      return;
    }
  
    // If over warning threshold, show alert confirmation
    if (numericAmount > WARNING_AMOUNT) {
      Alert.alert(
        "Large Amount Entered",
        `You entered ${numericAmount} ${amountUnit}. Are you sure this amount is correct?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Yes, Save", 
            onPress: async () => {
              try {
                const logData = {
                  timestamp: selectedTime,
                  feedType: foodType === 'Other' ? customFoodType : foodType,
                  amount: numericAmount,
                  amountUnit,
                  mealType,
                  notes,
                  childId,
                  createdAt: serverTimestamp(),
                };
  
                await addDoc(collection(db, 'feedLogs'), logData);
                alert('Feeding log saved successfully!');
                navigation.goBack();
              } catch (error) {
                console.error('Error saving feeding log:', error);
                alert('Failed to save feeding log. Please try again.');
              }
            }
          }
        ]
      );
      return; // stop here, saving continues only if user confirms
    }
  
    // Normal save path
    try {
      const logData = {
        timestamp: selectedTime,
        feedType: foodType === 'Other' ? customFoodType : foodType,
        amount: numericAmount,
        amountUnit,
        mealType,
        notes,
        childId,
        createdAt: serverTimestamp(),
      };
  
      await addDoc(collection(db, 'feedLogs'), logData);
      alert('Feeding log saved successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error saving feeding log:', error);
      alert('Failed to save feeding log. Please try again.');
    }
  };

  return (
    <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
          style={{ flex: 1 }}
        >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollViewContent}
              keyboardShouldPersistTaps="handled"
            >
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

                <Text style={styles.title}>Feeding Log</Text>

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
                        style={styles.timePicker}
                      />
                      {Platform.OS === 'ios' && (
                        <TouchableOpacity style={styles.confirmTimeButton} onPress={confirmTimePicker}>
                          <Text style={styles.confirmTimeText}>Confirm Time</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>

                {/* Food Type */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Food Type</Text>
                  <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowFoodPicker(!showFoodPicker)}>
                    <Text style={styles.dropdownButtonText}>{foodType || 'Select Food Type'}</Text>
                    <Text style={styles.dropdownIcon}>▼</Text>
                  </TouchableOpacity>

                  {showFoodPicker && (
                    <View style={styles.pickerContainer}>
                      <Picker selectedValue={foodType} onValueChange={(val) => setFoodType(val)}>
                        <Picker.Item label="Select Food Type" value="" />
                        <Picker.Item label="Formula" value="Formula" />
                        <Picker.Item label="Breastmilk" value="Breastmilk" />
                        <Picker.Item label="Solids/Other" value="Solids/Other" />
                        <Picker.Item label="Fruits" value="Fruits" />
                        <Picker.Item label="Vegetables" value="Vegetables" />
                        <Picker.Item label="Grains" value="Grains" />
                        <Picker.Item label="Protein" value="Protein" />
                        <Picker.Item label="Dairy" value="Dairy" />
                        <Picker.Item label="Snacks / Treats" value="Snacks" />
                      </Picker>
                      <TouchableOpacity style={styles.confirmPickerButton} onPress={() => setShowFoodPicker(false)}>
                        <Text style={styles.confirmPickerText}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {foodType === 'Other' && (
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter custom food name"
                      placeholderTextColor="#999"
                      value={customFoodType}
                      onChangeText={setCustomFoodType}
                    />
                  )}
                </View>

                {/* Amount and Unit */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Amount</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter amount"
                    placeholderTextColor="#999"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    onFocus={() => setAmountFocused(true)}
                    onBlur={() => setAmountFocused(false)}
                  />
                  <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowUnitPicker(!showUnitPicker)}>
                    <Text style={styles.dropdownButtonText}>{amountUnit || 'Select Unit'}</Text>
                    <Text style={styles.dropdownIcon}>▼</Text>
                  </TouchableOpacity>
                  {showUnitPicker && (
                    <View style={styles.pickerContainer}>
                      <Picker selectedValue={amountUnit} onValueChange={(val) => setAmountUnit(val)}>
                        <Picker.Item label="Select Unit" value="" />
                        <Picker.Item label="mL" value="mL" />
                        <Picker.Item label="oz" value="oz" />
                        <Picker.Item label="Cups" value="Cups" />
                        <Picker.Item label="Pieces" value="Pieces" />
                        <Picker.Item label="None/Refused" value="None" />
                      </Picker>
                      <TouchableOpacity style={styles.confirmPickerButton} onPress={() => setShowUnitPicker(false)}>
                        <Text style={styles.confirmPickerText}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Meal Type */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Meal Type</Text>
                  <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowMealPicker(!showMealPicker)}>
                    <Text style={styles.dropdownButtonText}>{mealType || 'Select Meal Type'}</Text>
                    <Text style={styles.dropdownIcon}>▼</Text>
                  </TouchableOpacity>
                  {showMealPicker && (
                    <View style={styles.pickerContainer}>
                      <Picker selectedValue={mealType} onValueChange={(val) => setMealType(val)}>
                        <Picker.Item label="Select Meal Type" value="" />
                        <Picker.Item label="Breakfast" value="Breakfast" />
                        <Picker.Item label="Lunch" value="Lunch" />
                        <Picker.Item label="Dinner" value="Dinner" />
                        <Picker.Item label="Snack" value="Snack" />
                      </Picker>
                      <TouchableOpacity style={styles.confirmPickerButton} onPress={() => setShowMealPicker(false)}>
                        <Text style={styles.confirmPickerText}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Notes */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Notes (optional)</Text>
                  <TextInput
                    style={[styles.textInput, { height: 80 }]}
                    placeholder="Any additional notes..."
                    placeholderTextColor="#999"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={4}
                  />
                </View>
                <TouchableOpacity style={styles.completeButton} onPress={handleCompleteLog}>
                <Text style={styles.completeButtonText}>Complete Log</Text>
                </TouchableOpacity>
                <View style={{ height: 60 }} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent', 
  },
  keyboardAvoidContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent', 
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 50,
    backgroundColor: 'transparent', 
  },
  formContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: 'transparent', 
  },
  header: {
    flexDirection: 'row',
    marginBottom: 30,
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
  textInput: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 5,
    fontSize: 16,
    color: '#333',
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
  bottomPadding: {
    height: 100,
  }
});

export default FeedingForm;