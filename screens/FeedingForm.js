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
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRoute } from '@react-navigation/native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { useDarkMode } from '../screens/DarkMode';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { ArrowLeft } from 'lucide-react-native';

export default function FeedingForm({ navigation }) {
  const route = useRoute();
  const { childId, name } = route.params || {};
  const { darkMode } = useDarkMode();
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;

  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [foodType, setFoodType] = useState('');
  const [customFoodType, setCustomFoodType] = useState('');

  const [amount, setAmount] = useState('');
  const [amountUnit, setAmountUnit] = useState('');
  const [mealType, setMealType] = useState('');

  const [notes, setNotes] = useState('');
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [showFoodPicker, setShowFoodPicker] = useState(false);

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

    if (!user || !childId) {
      alert('Missing user or child info');
      return;
    }

    if (!mealType || (!foodType && !customFoodType) || !amount || !amountUnit) {
      alert('Please fill in all required fields before saving the log');
      return;
    }

    try {
      const logData = {
        timestamp: selectedTime,
        feedType: foodType === 'Other' ? customFoodType : foodType,
        amount,
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
    <ThemedBackground>
      <SafeAreaView style={styles.container}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={styles.scrollViewContent}>
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

              <Text style={[styles.title, { color: currentTheme.textPrimary }]}>
                Feeding Log
              </Text>

              {/* Time Picker */}
              <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
                <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Time</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.fieldButton}>
                  <Text style={{ color: currentTheme.textPrimary }}>{formatTime(selectedTime)}</Text>
                </TouchableOpacity>
                {showTimePicker && (
                  <DateTimePicker
                    value={selectedTime}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, date) => date && setSelectedTime(date)}
                  />
                )}
              </LinearGradient>

              {/* Food Type */}
              <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
                <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Food Type</Text>
                <TouchableOpacity
                  onPress={() => setShowFoodPicker(!showFoodPicker)}
                  style={styles.fieldButton}
                >
                  <Text style={{ color: currentTheme.textPrimary }}>
                    {foodType || 'Select Food Type'}
                  </Text>
                </TouchableOpacity>
                {showFoodPicker && (
                  <View style={styles.pickerContainer}>
                    <Picker selectedValue={foodType} onValueChange={(val) => setFoodType(val)}>
                      <Picker.Item label="Formula" value="Formula" />
                      <Picker.Item label="Breastmilk" value="Breastmilk" />
                      <Picker.Item label="Solids/Other" value="Solids/Other" />
                      <Picker.Item label="Fruits" value="Fruits" />
                      <Picker.Item label="Vegetables" value="Vegetables" />
                      <Picker.Item label="Grains" value="Grains" />
                      <Picker.Item label="Protein" value="Protein" />
                      <Picker.Item label="Dairy" value="Dairy" />
                      <Picker.Item label="Snacks / Treats" value="Snacks" />
                      <Picker.Item label="Other" value="Other" />
                    </Picker>
                  </View>
                )}
                {foodType === 'Other' && (
                  <TextInput
                    placeholder="Enter custom food name"
                    placeholderTextColor={darkMode ? '#777' : '#aaa'}
                    style={[styles.textInput, { color: currentTheme.textPrimary }]}
                    value={customFoodType}
                    onChangeText={setCustomFoodType}
                  />
                )}
              </LinearGradient>

              {/* Amount + Unit */}
              <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
                <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Amount</Text>
                <TextInput
                  placeholder="Enter amount"
                  placeholderTextColor={darkMode ? '#777' : '#aaa'}
                  style={[styles.textInput, { color: currentTheme.textPrimary }]}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  onPress={() => setShowUnitPicker(!showUnitPicker)}
                  style={styles.fieldButton}
                >
                  <Text style={{ color: currentTheme.textPrimary }}>
                    {amountUnit || 'Select Unit'}
                  </Text>
                </TouchableOpacity>
                {showUnitPicker && (
                  <View style={styles.pickerContainer}>
                    <Picker selectedValue={amountUnit} onValueChange={(val) => setAmountUnit(val)}>
                      <Picker.Item label="mL" value="mL" />
                      <Picker.Item label="oz" value="oz" />
                      <Picker.Item label="Cups" value="Cups" />
                      <Picker.Item label="Pieces" value="Pieces" />
                      <Picker.Item label="None/Refused" value="None" />
                    </Picker>
                  </View>
                )}
              </LinearGradient>

              {/* Meal Type */}
              <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
                <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Meal Type</Text>
                <TouchableOpacity
                  onPress={() => setShowMealPicker(!showMealPicker)}
                  style={styles.fieldButton}
                >
                  <Text style={{ color: currentTheme.textPrimary }}>
                    {mealType || 'Select Meal Type'}
                  </Text>
                </TouchableOpacity>
                {showMealPicker && (
                  <View style={styles.pickerContainer}>
                    <Picker selectedValue={mealType} onValueChange={(val) => setMealType(val)}>
                      <Picker.Item label="Breakfast" value="Breakfast" />
                      <Picker.Item label="Lunch" value="Lunch" />
                      <Picker.Item label="Dinner" value="Dinner" />
                      <Picker.Item label="Snack" value="Snack" />
                    </Picker>
                  </View>
                )}
              </LinearGradient>

              {/* Notes */}
              <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
                <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Notes</Text>
                <TextInput
                  placeholder="Any additional notes..."
                  placeholderTextColor={darkMode ? '#777' : '#aaa'}
                  style={[styles.textInput, { height: 80, color: currentTheme.textPrimary }]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </LinearGradient>

              {/* Submit */}
              <TouchableOpacity onPress={handleCompleteLog} style={{ marginTop: 20 }}>
                <LinearGradient
                  colors={darkMode ? ['#00c6ff', '#0072ff'] : ['#81D4FA', '#B39DDB']}
                  style={styles.submitButton}
                >
                  <Text style={styles.submitText}>Complete Log</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollViewContent: { padding: 20 },
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
  textInput: {
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  pickerContainer: {
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  submitButton: {
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});