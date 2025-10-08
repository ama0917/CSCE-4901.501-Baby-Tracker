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
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { app } from '../firebaseConfig';
import { getAuth } from 'firebase/auth';
import { KeyboardAvoidingView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { InputAccessoryView } from 'react-native';
import { useDarkMode } from './DarkMode';
import { appTheme } from './ThemedBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AddChildScreen = () => {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();
  const theme = darkMode ? appTheme.dark : appTheme.light;

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
    { label: 'Other', icon: 'account', color: '#D7BCE8' },
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
        birthdate: formData.birthDate,
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

  const dynamicStyles = getThemedStyles(theme, darkMode);

  return (
    <>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <LinearGradient 
        colors={theme.backgroundGradient} 
        start={{ x: 0, y: 0.5 }} 
        end={{ x: 1, y: 0.5 }}
        style={dynamicStyles.gradient}
      >
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            contentContainerStyle={dynamicStyles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={dynamicStyles.header}>
              <TouchableOpacity 
                style={dynamicStyles.backButton} 
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <BlurView intensity={20} tint={darkMode ? "dark" : "light"} style={dynamicStyles.backButtonBlur}>
                  <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
                </BlurView>
              </TouchableOpacity>
              
              <Text style={[dynamicStyles.headerTitle, { color: theme.textPrimary }]}>Add Child Profile</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Content Card */}
            <View style={[dynamicStyles.contentCard, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
              {/* Profile Image */}
              <TouchableOpacity onPress={pickImage} style={dynamicStyles.imageContainer} activeOpacity={0.8}>
                <View style={dynamicStyles.imageWrapper}>
                  {formData.image ? (
                    <Image source={{ uri: formData.image }} style={dynamicStyles.profileImage} />
                  ) : (
                    <View style={[dynamicStyles.imagePlaceholder, { backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa', borderColor: darkMode ? '#444' : '#e9ecef' }]}>
                      <MaterialCommunityIcons name="camera-plus" size={32} color={darkMode ? '#666' : '#999'} />
                      <Text style={[dynamicStyles.imagePlaceholderText, { color: darkMode ? '#999' : '#999' }]}>Add Photo</Text>
                    </View>
                  )}
                  <View style={dynamicStyles.imageOverlay}>
                    <MaterialCommunityIcons name="camera" size={20} color="#fff" />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Name Section */}
              <View style={dynamicStyles.section}>
                <Text style={[dynamicStyles.sectionTitle, { color: theme.textPrimary }]}>Personal Information</Text>
                
                <View style={dynamicStyles.inputGroup}>
                  <Text style={[dynamicStyles.inputLabel, { color: theme.textSecondary }]}>First Name *</Text>
                  <TextInput
                    style={[dynamicStyles.input, { 
                      backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                      borderColor: darkMode ? '#444' : '#e9ecef',
                      color: theme.textPrimary
                    }]}
                    placeholder="Enter first name"
                    placeholderTextColor={darkMode ? '#888' : '#999'}
                    value={formData.firstName}
                    onChangeText={(value) => updateFormData('firstName', value)}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                <View style={dynamicStyles.inputGroup}>
                  <Text style={[dynamicStyles.inputLabel, { color: theme.textSecondary }]}>Last Name</Text>
                  <TextInput
                    style={[dynamicStyles.input, { 
                      backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                      borderColor: darkMode ? '#444' : '#e9ecef',
                      color: theme.textPrimary
                    }]}
                    placeholder="Enter last name"
                    placeholderTextColor={darkMode ? '#888' : '#999'}
                    value={formData.lastName}
                    onChangeText={(value) => updateFormData('lastName', value)}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                {/* Sex Selection */}
                <View style={dynamicStyles.inputGroup}>
                  <Text style={[dynamicStyles.inputLabel, { color: theme.textSecondary }]}>Sex *</Text>
                  <View style={dynamicStyles.sexContainer}>
                    {sexOptions.map((option) => (
                      <TouchableOpacity
                        key={option.label}
                        style={[
                          dynamicStyles.sexOption,
                          { 
                            backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                            borderColor: darkMode ? '#444' : '#e9ecef'
                          },
                          formData.sex === option.label && {
                            backgroundColor: option.color,
                            borderColor: option.color,
                          }
                        ]}
                        onPress={() => updateFormData('sex', option.label)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons
                          name={option.icon}
                          size={24}
                          color={formData.sex === option.label ? '#fff' : theme.textSecondary}
                        />
                        <Text
                          style={[
                            dynamicStyles.sexLabel,
                            { color: theme.textSecondary },
                            formData.sex === option.label && { color: '#fff', fontWeight: '600' }
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Birth Date */}
                <View style={dynamicStyles.inputGroup}>
                  <Text style={[dynamicStyles.inputLabel, { color: theme.textSecondary }]}>Birth Date *</Text>
                  <TouchableOpacity 
                    onPress={() => setShowDatePicker(true)} 
                    style={[dynamicStyles.dateSelector, { 
                      backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                      borderColor: darkMode ? '#444' : '#e9ecef'
                    }]}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="calendar" size={20} color="#667eea" />
                    <Text style={[dynamicStyles.dateText, { color: theme.textPrimary }]}>
                      {formData.birthDate.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </Text>
                  </TouchableOpacity>
                  <Text style={dynamicStyles.ageText}>Age: {calculateAge}</Text>
                </View>

                {showDatePicker && (
                <View style={[dynamicStyles.datePickerContainer, { 
                  backgroundColor: darkMode ? '#2c2c2c' : '#fff',
                  borderColor: darkMode ? '#444' : '#e9ecef'
                }]}>
                  <DateTimePicker
                    value={formData.birthDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    textColor={theme.textPrimary}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={dynamicStyles.dateConfirmButton}
                      onPress={handleDatePickerDone}
                    >
                      <Text style={dynamicStyles.dateConfirmText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              </View>

              {/* Physical Information */}
              <View style={dynamicStyles.section}>
                <Text style={[dynamicStyles.sectionTitle, { color: theme.textPrimary }]}>Physical Information</Text>

              {/* Row for Weight + Height */}
                <View style={dynamicStyles.measurementRow}>
                  {/* Weight */}
                  <View style={[dynamicStyles.inputGroup, dynamicStyles.halfInput]}>
                    <Text style={[dynamicStyles.inputLabel, { color: theme.textSecondary }]}>Weight</Text>
                    <View style={dynamicStyles.measurementRow}>
                      <TextInput
                        style={[dynamicStyles.input, dynamicStyles.measurementInput, { 
                          backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                          borderColor: darkMode ? '#444' : '#e9ecef',
                          color: theme.textPrimary
                        }]}
                        placeholder="0"
                        placeholderTextColor={darkMode ? '#888' : '#999'}
                        keyboardType="decimal-pad"
                        value={formData.weight}
                        onChangeText={(value) => updateFormData('weight', value)}
                        inputAccessoryViewID="doneBar"
                      />
                      <View style={[dynamicStyles.unitSelector, { 
                        backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                        borderColor: darkMode ? '#444' : '#e9ecef'
                      }]}>
                        {['lbs', 'kg'].map((unit) => (
                          <TouchableOpacity
                            key={unit}
                            style={[
                              dynamicStyles.unitButton,
                              formData.weightUnit === unit && dynamicStyles.unitButtonSelected,
                            ]}
                            onPress={() => handleWeightUnitChange(unit)}
                          >
                            <Text
                              style={[
                                dynamicStyles.unitText,
                                { color: darkMode ? theme.textSecondary : '#666' },
                                formData.weightUnit === unit && dynamicStyles.unitTextSelected,
                              ]}
                            >
                              {unit}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Height */}
                  <View style={[dynamicStyles.inputGroup, dynamicStyles.halfInput]}>
                    <Text style={[dynamicStyles.inputLabel, { color: theme.textSecondary }]}>Height</Text>
                    <View style={dynamicStyles.measurementRow}>
                      <TextInput
                        style={[dynamicStyles.input, dynamicStyles.measurementInput, { 
                          backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                          borderColor: darkMode ? '#444' : '#e9ecef',
                          color: theme.textPrimary
                        }]}
                        placeholder="0"
                        placeholderTextColor={darkMode ? '#888' : '#999'}
                        keyboardType="decimal-pad"
                        value={formData.height}
                        onChangeText={(value) => updateFormData('height', value)}
                        inputAccessoryViewID="heightDoneBar"
                      />
                      <View style={[dynamicStyles.unitSelector, { 
                        backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                        borderColor: darkMode ? '#444' : '#e9ecef'
                      }]}>
                        {['in', 'cm'].map((unit) => (
                          <TouchableOpacity
                            key={unit}
                            style={[
                              dynamicStyles.unitButton,
                              formData.heightUnit === unit && dynamicStyles.unitButtonSelected,
                            ]}
                            onPress={() => handleHeightUnitChange(unit)}
                          >
                            <Text
                              style={[
                                dynamicStyles.unitText,
                                { color: darkMode ? theme.textSecondary : '#666' },
                                formData.heightUnit === unit && dynamicStyles.unitTextSelected,
                              ]}
                            >
                              {unit}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Notes */}
              <View style={dynamicStyles.section}>
                <Text style={[dynamicStyles.sectionTitle, { color: theme.textPrimary }]}>Additional Notes</Text>
                <View style={dynamicStyles.inputGroup}>
                  <TextInput
                    style={[dynamicStyles.notesInput, { 
                      backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                      borderColor: darkMode ? '#444' : '#e9ecef',
                      color: theme.textPrimary
                    }]}
                    placeholder="Add any additional notes about your child..."
                    placeholderTextColor={darkMode ? '#888' : '#999'}
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
                style={[dynamicStyles.saveButton, isLoading && dynamicStyles.saveButtonDisabled]} 
                onPress={handleSave}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isLoading ? ['#667eea', '#667eea'] : ['#667eea', '#667eea']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={dynamicStyles.saveButtonGradient}
                >
                  {isLoading ? (
                    <Text style={dynamicStyles.saveButtonText}>Adding...</Text>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="check" size={20} color="#fff" />
                      <Text style={dynamicStyles.saveButtonText}>Add Child Profile</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="doneBar">
          <View style={[dynamicStyles.accessory, { backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa', borderColor: darkMode ? '#444' : '#e9ecef' }]}>
            <TouchableOpacity onPress={Keyboard.dismiss} style={dynamicStyles.accessoryButton}>
              <Text style={dynamicStyles.accessoryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
      <InputAccessoryView nativeID="heightDoneBar">
        <View style={[dynamicStyles.accessory, { backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa', borderColor: darkMode ? '#444' : '#e9ecef' }]}>
          <TouchableOpacity onPress={Keyboard.dismiss} style={dynamicStyles.accessoryButton}>
            <Text style={dynamicStyles.accessoryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </InputAccessoryView>
    </>
  );
};

const getThemedStyles = (theme, darkMode) => {
  return StyleSheet.create({
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
      textAlign: 'center',
    },
    contentCard: {
      flex: 1,
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
      borderWidth: 2,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imagePlaceholderText: {
      fontSize: 12,
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
      marginBottom: 20,
    },
    inputGroup: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
    },
    sexContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    sexOption: {
      flex: 1,
      borderWidth: 2,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginHorizontal: 4,
    },
    sexLabel: {
      fontSize: 12,
      fontWeight: '500',
      marginTop: 6,
    },
    dateSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    dateText: {
      fontSize: 16,
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
      borderRadius: 12,
      padding: 16,
      marginTop: 12,
      borderWidth: 1,
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
      flex: 2,
      marginRight: 6,
    },
    unitSelector: {
      flex: 1.2,
      flexDirection: 'row',
      borderRadius: 8,
      borderWidth: 1,
      overflow: 'hidden',
    },
    unitButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
    },
    unitButtonSelected: {
      backgroundColor: '#667eea',
    },
    unitText: {
      fontSize: 14,
      fontWeight: '500',
    },
    unitTextSelected: {
      color: '#fff',
    },
    notesInput: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
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
    halfInput: {
      flex: 1,
      marginRight: 10,
    },
    accessory: {
      padding: 8,
      borderTopWidth: 1,
      alignItems: 'flex-end',
    },
    accessoryButton: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      backgroundColor: '#667eea',
      borderRadius: 8,
    },
    accessoryButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
  });
};

export default AddChildScreen;