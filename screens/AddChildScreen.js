import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Image, Alert, ScrollView, Platform, Keyboard,
  Dimensions, StatusBar
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getFirestore, collection, addDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { app } from '../firebaseConfig';
import { getAuth } from 'firebase/auth';
import { KeyboardAvoidingView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AddChildScreen = () => {
  const navigation = useNavigation();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    sex: '',
    birthDate: new Date(),
    weight: '',
    height: '',
    weightUnit: 'lbs',
    heightUnit: 'in',
    notes: '',
    image: null,
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const db = getFirestore(app);

  const AGE_WARNING_YEARS = 18;
  const WEIGHT_WARNING_LBS = 200;
  const WEIGHT_WARNING_KG = 90;
  const HEIGHT_WARNING_IN = 80;
  const HEIGHT_WARNING_CM = 203;

  const sexOptions = [
    { label: 'Male', icon: 'gender-male', color: '#A5D8FF' },
    { label: 'Female', icon: 'gender-female', color: '#FFCCD5' },
    { label: 'Other', icon: 'account-question', color: '#D7BCE8' },
  ];

  const updateFormData = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleWeightUnitChange = useCallback((newUnit) => {
    if (formData.weight && !isNaN(parseFloat(formData.weight))) {
      let converted = parseFloat(formData.weight);
      if (formData.weightUnit === 'lbs' && newUnit === 'kg') {
        converted = (converted * 0.453592).toFixed(1);
      } else if (formData.weightUnit === 'kg' && newUnit === 'lbs') {
        converted = (converted / 0.453592).toFixed(1);
      }
      setFormData(prev => ({
        ...prev,
        weight: String(converted),
        weightUnit: newUnit
      }));
    } else {
      updateFormData('weightUnit', newUnit);
    }
  }, [formData.weight, formData.weightUnit, updateFormData]);

  const handleHeightUnitChange = useCallback((newUnit) => {
    if (formData.height && !isNaN(parseFloat(formData.height))) {
      let converted = parseFloat(formData.height);
      if (formData.heightUnit === 'in' && newUnit === 'cm') {
        converted = (converted * 2.54).toFixed(1);
      } else if (formData.heightUnit === 'cm' && newUnit === 'in') {
        converted = (converted / 2.54).toFixed(1);
      }
      setFormData(prev => ({
        ...prev,
        height: String(converted),
        heightUnit: newUnit
      }));
    } else {
      updateFormData('heightUnit', newUnit);
    }
  }, [formData.height, formData.heightUnit, updateFormData]);

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to add a photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.Image,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled) {
        updateFormData('image', result.assets[0].uri);
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const calculateAge = useMemo(() => {
    const today = new Date();
    const birth = new Date(formData.birthDate);
    
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();
    
    if (days < 0) {
      months -= 1;
      days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    if (years < 0) return 'Invalid date';
    
    if (years === 0 && months === 0) return `${days} day${days !== 1 ? 's' : ''}`;
    if (years === 0) return `${months} month${months !== 1 ? 's' : ''} ${days} day${days !== 1 ? 's' : ''}`;
    return `${years} year${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}`;
  }, [formData.birthDate]);

  const validateForm = useCallback(() => {
    if (!formData.firstName.trim()) {
      return 'First name is required';
    }
    if (!formData.sex) {
      return 'Please select a sex';
    }
    if (formData.birthDate > new Date()) {
      return 'Birth date cannot be in the future';
    }
    if (formData.weight && (isNaN(parseFloat(formData.weight)) || parseFloat(formData.weight) <= 0)) {
      return 'Please enter a valid weight';
    }
    if (formData.height && (isNaN(parseFloat(formData.height)) || parseFloat(formData.height) <= 0)) {
      return 'Please enter a valid height';
    }
    return null;
  }, [formData]);

  const saveProfile = async () => {
    try {
      setIsLoading(true);
      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('Authentication required');
      }

      const newProfile = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        sex: formData.sex,
        birthDate: formData.birthDate.toISOString(),
        weight: formData.weight || null,
        weightUnit: formData.weightUnit,
        height: formData.height || null,
        heightUnit: formData.heightUnit,
        notes: formData.notes.trim(),
        image: formData.image,
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'children'), newProfile);
      // Ensure role recorded for this user
      try {
        const userRef = doc(db, 'Users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, { UserType: 'parent' }, { merge: true });
        } else if (!userSnap.data()?.UserType) {
          await updateDoc(userRef, { UserType: 'parent' });
        }
      } catch (_) {}
      
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      navigation.navigate('Home', { 
        newProfile: { id: docRef.id, ...newProfile },
        message: 'Child profile added successfully!'
      });
    } catch (error) {
      console.error('Error adding child profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = useCallback(() => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }
  
    const today = new Date();
    const birth = new Date(formData.birthDate);
    let ageYears = today.getFullYear() - birth.getFullYear();
    if (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
    ) {
      ageYears--;
    }

    let weightLbs = parseFloat(formData.weight) || 0;
    if (formData.weightUnit === 'kg') weightLbs = weightLbs / 0.453592;
  
    let heightIn = parseFloat(formData.height) || 0;
    if (formData.heightUnit === 'cm') heightIn = heightIn / 2.54;
  
    if (
      ageYears > AGE_WARNING_YEARS ||
      weightLbs > WEIGHT_WARNING_LBS ||
      heightIn > HEIGHT_WARNING_IN
    ) {
      Alert.alert(
        'Confirm Large Values',
        `You have entered large values for your child:\n\n` +
        `${ageYears > AGE_WARNING_YEARS ? `Age: ${ageYears} years\n` : ''}` +
        `${weightLbs > WEIGHT_WARNING_LBS ? `Weight: ${formData.weight} ${formData.weightUnit}\n` : ''}` +
        `${heightIn > HEIGHT_WARNING_IN ? `Height: ${formData.height} ${formData.heightUnit}\n` : ''}` +
        `Are you sure you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, continue', onPress: saveProfile }
        ]
      );
    } else {
      saveProfile();
    }
  }, [formData, validateForm, saveProfile]);

  const handleDateChange = useCallback((event, selectedDate) => {
    if (selectedDate) {
      updateFormData('birthDate', selectedDate);
    }
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
  
      if (selectedDate && selectedDate > new Date()) {
        Alert.alert("Invalid Date", "Birth date cannot be in the future.");
        updateFormData('birthDate', formData.birthDate);
      }
    }
  }, [updateFormData, formData.birthDate]);

  const handleDatePickerDone = () => {
    if (formData.birthDate > new Date()) {
      Alert.alert("Invalid Date", "Birth date cannot be in the future.");
      updateFormData('birthDate', new Date());
    }
    setShowDatePicker(false);
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient 
        colors={['#AEC6CF', '#F4C2C2']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <BlurView intensity={20} tint="light" style={styles.backButtonBlur}>
                  <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
                </BlurView>
              </TouchableOpacity>
              
              <Text style={styles.headerTitle}>Add Child Profile</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Content Card */}
            <View style={styles.contentCard}>
              {/* Profile Image */}
              <TouchableOpacity onPress={pickImage} style={styles.imageContainer} activeOpacity={0.8}>
                <View style={styles.imageWrapper}>
                  {formData.image ? (
                    <Image source={{ uri: formData.image }} style={styles.profileImage} />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <MaterialCommunityIcons name="camera-plus" size={32} color="#999" />
                      <Text style={styles.imagePlaceholderText}>Add Photo</Text>
                    </View>
                  )}
                  <View style={styles.imageOverlay}>
                    <MaterialCommunityIcons name="camera" size={20} color="#fff" />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Name Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Personal Information</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>First Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter first name"
                    value={formData.firstName}
                    onChangeText={(value) => updateFormData('firstName', value)}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter last name"
                    value={formData.lastName}
                    onChangeText={(value) => updateFormData('lastName', value)}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                {/* Sex Selection */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Sex *</Text>
                  <View style={styles.sexContainer}>
                    {sexOptions.map((option) => (
                      <TouchableOpacity
                        key={option.label}
                        style={[
                          styles.sexOption,
                          formData.sex === option.label && styles.sexOptionSelected,
                          { borderColor: option.color }
                        ]}
                        onPress={() => updateFormData('sex', option.label)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons
                          name={option.icon}
                          size={24}
                          color={formData.sex === option.label ? option.color : '#999'}
                        />
                        <Text style={[
                          styles.sexLabel,
                          formData.sex === option.label && { color: option.color, fontWeight: '600' }
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Birth Date */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Birth Date *</Text>
                  <TouchableOpacity 
                    onPress={() => setShowDatePicker(true)} 
                    style={styles.dateSelector}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="calendar" size={20} color="#667eea" />
                    <Text style={styles.dateText}>
                      {formData.birthDate.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.ageText}>Age: {calculateAge}</Text>
                </View>

                {showDatePicker && (
                <View style={styles.datePickerContainer}>
                  <DateTimePicker
                    value={formData.birthDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    // Remove maximumDate prop here!
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={styles.dateConfirmButton}
                      onPress={handleDatePickerDone}
                    >
                      <Text style={styles.dateConfirmText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              </View>

              {/* Physical Information */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Physical Information</Text>
                
                {/* Weight */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Weight</Text>
                  <View style={styles.measurementRow}>
                    <TextInput
                      style={[styles.input, styles.measurementInput]}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      value={formData.weight}
                      onChangeText={(value) => updateFormData('weight', value)}
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <View style={styles.unitSelector}>
                      {['lbs', 'kg'].map((unit) => (
                        <TouchableOpacity
                          key={unit}
                          style={[
                            styles.unitButton,
                            formData.weightUnit === unit && styles.unitButtonSelected
                          ]}
                          onPress={() => handleWeightUnitChange(unit)}
                        >
                          <Text style={[
                            styles.unitText,
                            formData.weightUnit === unit && styles.unitTextSelected
                          ]}>
                            {unit}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Height */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Height</Text>
                  <View style={styles.measurementRow}>
                    <TextInput
                      style={[styles.input, styles.measurementInput]}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      value={formData.height}
                      onChangeText={(value) => updateFormData('height', value)}
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <View style={styles.unitSelector}>
                      {['in', 'cm'].map((unit) => (
                        <TouchableOpacity
                          key={unit}
                          style={[
                            styles.unitButton,
                            formData.heightUnit === unit && styles.unitButtonSelected
                          ]}
                          onPress={() => handleHeightUnitChange(unit)}
                        >
                          <Text style={[
                            styles.unitText,
                            formData.heightUnit === unit && styles.unitTextSelected
                          ]}>
                            {unit}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </View>

              {/* Notes */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Additional Notes</Text>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Add any additional notes about your child..."
                    multiline
                    numberOfLines={4}
                    value={formData.notes}
                    onChangeText={(value) => updateFormData('notes', value)}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity 
                style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
                onPress={handleSave}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isLoading ? ['#ccc', '#999'] : ['#AEC6CF', '#F4C2C2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveButtonGradient}
                >
                  {isLoading ? (
                    <Text style={styles.saveButtonText}>Adding...</Text>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="check" size={20} color="#fff" />
                      <Text style={styles.saveButtonText}>Add Child Profile</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingTop: StatusBar.currentHeight || 44,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
  },
  backButtonBlur: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 40,
    marginTop: 10,
  },
  imageContainer: {
    alignSelf: 'center',
    marginBottom: 30,
  },
  imageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontWeight: '500',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  sexContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sexOption: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  sexOptionSelected: {
    backgroundColor: '#fff',
    borderWidth: 2,
  },
  sexLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginTop: 6,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  ageText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '500',
    marginTop: 8,
  },
  datePickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  dateConfirmButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 16,
  },
  dateConfirmText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  measurementRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  measurementInput: {
    flex: 1,
    marginRight: 12,
  },
  unitSelector: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    overflow: 'hidden',
  },
  unitButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  unitButtonSelected: {
    backgroundColor: '#667eea',
  },
  unitText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  unitTextSelected: {
    color: '#fff',
  },
  notesInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 100,
  },
  saveButton: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveButtonDisabled: {
    elevation: 0,
    shadowOpacity: 0,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default AddChildScreen;