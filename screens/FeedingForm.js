import React, { useEffect, useState } from 'react';

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
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRoute } from '@react-navigation/native';
import { collection, addDoc, serverTimestamp, doc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig'; 
import { LinearGradient } from 'expo-linear-gradient';
import { useDarkMode } from '../screens/DarkMode';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { ArrowLeft } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// bring in role hook for caregiver gating
import useUserRole from './useUserRole';

// helper used for per-day filtering/logging
const getTodayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function FeedingForm({ navigation }) {
  const route = useRoute();
  const { childId, name } = route.params || {};

  // caregiver gating state
  const { role } = useUserRole(); // 'parent' | 'caregiver' | 'unassigned'
  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  const [canLog, setCanLog] = useState(role === 'parent');

  const { darkMode } = useDarkMode();
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;

  // watch caregiverPerms live; parents always true
  useEffect(() => {
    if (role === 'parent') {
      setCanLog(true);
      return;
    }
    if (!childId || !uid) {
      setCanLog(false);
      return;
    }
    const ref = doc(db, 'children', childId);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() || {};
      const v = (data.caregiverPerms || {})[uid];
      setCanLog(data.userId === uid || v === 'on' || v === 'log');
    });
    return () => unsub();
  }, [role, childId, uid]);

    const [hasAIConsent, setHasAIConsent] = useState(false);
  
  // Load AI consent status
  useEffect(() => {
    const loadAIConsent = async () => {
      try {
        if (childId) {
          const consent = await AsyncStorage.getItem(`ai_consent_${childId}`);
          setHasAIConsent(consent === 'true');
        }
      } catch (error) {
        console.error('Error loading AI consent:', error);
      }
    };
    
    loadAIConsent();
  }, [childId]);

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

  const scrollViewRef = React.useRef(null);
  const notesInputRef = React.useRef(null);

  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const handleCompleteLog = async () => {
    if (!canLog) { 
      Alert.alert('Access is off', 'Parent has turned off access for this child.'); 
      return; 
    }
    
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user || !childId) {
      alert('Missing user or child info');
      return;
    }

    if (!mealType || mealType === 'default' || (!foodType && !customFoodType) || foodType === 'default' || !amount || !amountUnit || amountUnit === 'default') {
      alert('Please fill in all required fields before saving the log');
      return;
    }

    // Check for future time
    const now = new Date();
    if (selectedTime > now) {
      Alert.alert(
        'Future Time Detected',
        'The selected time is in the future. Are you sure you want to continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => validateAmount() }
        ]
      );
      return;
    }

    validateAmount();
  };

const validateAmount = () => {
  const numericAmount = parseFloat(amount);
  const MAX_AMOUNT = 1000;
  const WARNING_AMOUNT = 500;

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

  if (numericAmount > WARNING_AMOUNT) {
    Alert.alert(
      'Large Amount Entered',
      `You entered ${numericAmount} ${amountUnit}. Are you sure this amount is correct?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Continue', onPress: () => checkForDuplicates() }
      ]
    );
    return;
  }

  checkForDuplicates();
};

const checkForDuplicates = async () => {
  try {
    // Query recent logs for this child today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const logsRef = collection(db, 'feedLogs');
    const q = query(
      logsRef,
      where('childId', '==', childId),
      where('timestamp', '>=', todayStart)
    );

    const snapshot = await getDocs(q);
    const selectedMinutes = selectedTime.getHours() * 60 + selectedTime.getMinutes();
    let hasDuplicate = false;

    snapshot.forEach((docSnap) => {
      const log = docSnap.data();
      const logTime = log.timestamp?.toDate();
      if (logTime) {
        const logMinutes = logTime.getHours() * 60 + logTime.getMinutes();
        // Check if times are within 5 minutes
        if (Math.abs(logMinutes - selectedMinutes) < 5) {
          hasDuplicate = true;
        }
      }
    });

    if (hasDuplicate) {
      Alert.alert(
        'Duplicate Entry',
        'A similar feeding log already exists for this time. Do you want to add it anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Anyway', onPress: () => saveLog() }
        ]
      );
      return;
    }

    await saveLog();
  } catch (error) {
    console.error('Error checking duplicates:', error);
    await saveLog();
  }
};

const saveLog = async () => {
  try {
    const numericAmount = parseFloat(amount);
    const logData = {
      timestamp: selectedTime,
      feedType: foodType === 'Other' ? customFoodType : foodType,
      amount: numericAmount,
      amountUnit,
      mealType,
      notes,
      childId,
      createdAt: serverTimestamp(),
      logDate: getTodayStr(),
    };

    await addDoc(collection(db, 'feedLogs'), logData);
    Alert.alert('Success', 'Log saved successfully!');
    navigation.goBack();
  } catch (error) {
    console.error('Error saving feeding log:', error);
    alert('Failed to save feeding log. Please try again.');
  }
};
  if (!canLog) {
    return (
      <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ margin: 20, backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
          <Text style={{ color: '#2E3A59', marginBottom: 12 }}>
            Access is off. Ask the parent for logging permission.
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
    <ThemedBackground>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollViewContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
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

            {/* Time Picker - Compact */}
            <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
              <View style={styles.compactRow}>
                <Text style={[styles.label, { marginBottom: 0, color: currentTheme.textPrimary }]}>Time</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(!showTimePicker)} style={styles.compactButton}>
                  <Text style={{ color: currentTheme.textPrimary, fontWeight: '600' }}>{formatTime(selectedTime)}</Text>
                </TouchableOpacity>
              </View>
              {showTimePicker && (
                <View style={{ marginTop: 10 }}>
                  <DateTimePicker
                    value={selectedTime}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, date) => {
                      if (date) setSelectedTime(date);
                      if (Platform.OS === 'android') setShowTimePicker(false);
                    }}
                    textColor={darkMode ? '#fff' : '#2E3A59'}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity 
                      onPress={() => setShowTimePicker(false)} 
                      style={styles.enterButton}
                    >
                      <Text style={styles.enterButtonText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </LinearGradient>

            {/* Food Type - Collapsible */}
            <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
              <TouchableOpacity 
                onPress={() => {
                  setShowFoodPicker(!showFoodPicker);
                  // Close other pickers
                  setShowUnitPicker(false);
                  setShowMealPicker(false);
                }}
                style={styles.sectionHeader}
              >
                <View>
                  <Text style={[styles.label, { marginBottom: 2, color: currentTheme.textPrimary }]}>Food Type</Text>
                  <Text style={[styles.selectedValue, { color: currentTheme.textSecondary }]}>
                    {foodType && foodType !== 'default' ? foodType : 'Tap to select'}
                  </Text>
                </View>
                <Text style={{ color: currentTheme.textSecondary, fontSize: 18 }}>
                  {showFoodPicker ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
              
              {showFoodPicker && (
                <View style={{ marginTop: 10 }}>
                  <View style={styles.pickerContainer}>
                    <Picker 
                      selectedValue={foodType || 'default'} 
                      onValueChange={(val) => setFoodType(val)}
                      style={{ color: darkMode ? '#fff' : '#2E3A59' }}
                      dropdownIconColor={darkMode ? '#fff' : '#2E3A59'}
                    >
                      <Picker.Item label="-- Select Food Type --" value="default" color={darkMode ? '#888' : '#999'} />
                      <Picker.Item label="Formula" value="Formula" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="Breastmilk" value="Breastmilk" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="Solids/Other" value="Solids/Other" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="Fruits" value="Fruits" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="Vegetables" value="Vegetables" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="Grains" value="Grains" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="Protein" value="Protein" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="Dairy" value="Dairy" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="Snacks / Treats" value="Snacks" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="Other" value="Other" color={darkMode ? '#fff' : '#2E3A59'} />
                    </Picker>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setShowFoodPicker(false)} 
                    style={styles.enterButton}
                  >
                    <Text style={styles.enterButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {foodType === 'Other' && (
                <TextInput
                  placeholder="Enter custom food name"
                  placeholderTextColor={darkMode ? '#777' : '#aaa'}
                  style={[styles.textInput, { color: currentTheme.textPrimary, marginTop: 10 }]}
                  value={customFoodType}
                  onChangeText={setCustomFoodType}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              )}
            </LinearGradient>

            {/* Amount + Unit - Compact */}
            <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
              <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Amount</Text>
              <View style={styles.amountRow}>
                <TextInput
                  placeholder="0"
                  placeholderTextColor={darkMode ? '#777' : '#aaa'}
                  style={[styles.amountInput, { color: currentTheme.textPrimary }]}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowUnitPicker(!showUnitPicker);
                    setShowFoodPicker(false);
                    setShowMealPicker(false);
                  }}
                  style={[styles.unitButton, { borderColor: currentTheme.textSecondary }]}
                >
                  <Text style={{ color: currentTheme.textPrimary, fontWeight: '600' }}>
                    {amountUnit && amountUnit !== 'default' ? amountUnit : 'Unit ▼'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {showUnitPicker && (
                <View style={{ marginTop: 10 }}>
                  <View style={styles.pickerContainer}>
                    <Picker 
                      selectedValue={amountUnit || 'default'} 
                      onValueChange={(val) => setAmountUnit(val)}
                      style={{ color: darkMode ? '#fff' : '#2E3A59' }}
                      dropdownIconColor={darkMode ? '#fff' : '#2E3A59'}
                    >
                      <Picker.Item label="-- Select Unit --" value="default" color={darkMode ? '#888' : '#999'} />
                      <Picker.Item label="mL" value="mL" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="oz" value="oz" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="fl oz" value="fl oz" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="Cups" value="Cups" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="Pieces" value="Pieces" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="None/Refused" value="None" color={darkMode ? '#fff' : '#2E3A59'} />
                    </Picker>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setShowUnitPicker(false)} 
                    style={styles.enterButton}
                  >
                    <Text style={styles.enterButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </LinearGradient>

            {/* Meal Type - Collapsible */}
            <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
              <TouchableOpacity 
                onPress={() => {
                  setShowMealPicker(!showMealPicker);
                  setShowFoodPicker(false);
                  setShowUnitPicker(false);
                }}
                style={styles.sectionHeader}
              >
                <View>
                  <Text style={[styles.label, { marginBottom: 2, color: currentTheme.textPrimary }]}>Meal Type</Text>
                  <Text style={[styles.selectedValue, { color: currentTheme.textSecondary }]}>
                    {mealType && mealType !== 'default' ? mealType : 'Tap to select'}
                  </Text>
                </View>
                <Text style={{ color: currentTheme.textSecondary, fontSize: 18 }}>
                  {showMealPicker ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
              
              {showMealPicker && (
                <View style={{ marginTop: 10 }}>
                  <View style={styles.pickerContainer}>
                    <Picker 
                      selectedValue={mealType || 'default'} 
                      onValueChange={(val) => setMealType(val)}
                      style={{ color: darkMode ? '#fff' : '#2E3A59' }}
                      dropdownIconColor={darkMode ? '#fff' : '#2E3A59'}
                    >
                      <Picker.Item label="-- Select Meal Type --" value="default" color={darkMode ? '#888' : '#999'} />
                      <Picker.Item label="Breakfast" value="Breakfast" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="Lunch" value="Lunch" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="Dinner" value="Dinner" color={darkMode ? '#fff' : '#2E3A59'} />
                      <Picker.Item label="Snack" value="Snack" color={darkMode ? '#fff' : '#2E3A59'} />
                    </Picker>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setShowMealPicker(false)} 
                    style={styles.enterButton}
                  >
                    <Text style={styles.enterButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </LinearGradient>

            {/* Notes - Collapsible */}
            <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={[styles.label, { marginBottom: 0, color: currentTheme.textPrimary }]}>
                  Notes {notes ? `(${notes.length} chars)` : '(Optional)'}
                </Text>
                {hasAIConsent && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: darkMode ? '#1a3a52' : '#E3F2FD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 10, color: darkMode ? '#64b5f6' : '#1976d2', marginRight: 4 }}>✨</Text>
                    <Text style={{ fontSize: 10, color: darkMode ? '#64b5f6' : '#1976d2', fontWeight: '600' }}>AI</Text>
                  </View>
                )}
              </View>
              {hasAIConsent && (
                <Text style={{ fontSize: 11, color: darkMode ? '#64b5f6' : '#1976d2', fontStyle: 'italic', marginBottom: 8 }}>
                  💡 Be specific for better AI insights
                </Text>
              )}
              <TextInput
                ref={notesInputRef}
                placeholder={hasAIConsent ? "e.g., 'mashed sweet potato with cinnamon'" : "Any additional notes..."}
                placeholderTextColor={darkMode ? '#777' : '#aaa'}
                style={[styles.textInput, { height: 80, color: currentTheme.textPrimary, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                returnKeyType="done"
                blurOnSubmit={true}
                onFocus={() => {
                  // Auto-scroll to notes when focused
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
              />
            </LinearGradient>

            {/* Submit Button - Always visible */}
            <TouchableOpacity onPress={handleCompleteLog} style={{ marginTop: 20, marginBottom: 40 }}>
              <LinearGradient
                colors={darkMode ? ['#00c6ff', '#0072ff'] : ['#81D4FA', '#B39DDB']}
                style={styles.submitButton}
              >
                <Text style={styles.submitText}>Complete Log</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container:
   { 
    flex: 1
   },
  scrollViewContent:
   {
     padding: 20,
     paddingBottom: 60 
    },
  header: 
  {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerButton: 
  { 
    borderRadius: 16
   },
  headerButtonGradient: 
  {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: 
  { 
    width: 50,
     height: 50, 
     resizeMode: 'contain'
     },
  title: 
  { 
    fontSize: 26,
     fontWeight: '700', 
     textAlign: 'center', 
     marginBottom: 20 
    },
  inputCard:
   {
    borderRadius: 20,
    padding: 15,
    marginVertical: 8,
    elevation: 3,
  },
  label: 
  { 
    fontSize: 16,
    fontWeight: '600', 
    marginBottom: 8 
  },
  compactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    minWidth: 100,
    alignItems: 'center',
  },
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
  submitText: 
  { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 16
   },
  enterButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    alignItems: 'center',
    borderRadius: 10,
    marginTop: 10,
    marginHorizontal: 10,
    marginBottom: 10,
  },
  enterButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
   sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  selectedValue: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  amountRow: {
    flexDirection: 'row',
    gap: 10,
  },
  amountInput: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  unitButton: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  fieldButton: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  textInput: {
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pickerContainer: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  enterButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    alignItems: 'center',
    borderRadius: 10,
    marginTop: 10,
  },
  enterButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  submitButton: {
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 4,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});