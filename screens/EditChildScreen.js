import React, { useEffect, useState, useCallback } from 'react'; 
import { 
  View, Text, TextInput, StyleSheet, Image, TouchableOpacity, 
  ActivityIndicator, Alert, ScrollView, Platform, Keyboard 
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getFirestore, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { app } from '../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

const AGE_WARNING_YEARS = 18;
const WEIGHT_WARNING_LBS = 200;
const HEIGHT_WARNING_IN = 80;

const EditChildScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { childId } = route.params || {};

  const db = getFirestore(app);

  const [childData, setChildData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    birthDate: new Date(),
    notes: '',
    image: null,
    weight: '',
    weightUnit: 'lbs',
    height: '',
    heightUnit: 'in',
  });
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (childId) {
      loadChildData();
    }
  }, []);

  const loadChildData = async () => {
    try {
      const docRef = doc(db, 'children', childId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Parse birthDate from stored MM/DD/YYYY or timestamp to Date object
        let birthDate = new Date();
        if (data.birthDate) {
          if (typeof data.birthDate === 'string') {
            const parts = data.birthDate.split('/');
            if (parts.length === 3) {
              birthDate = new Date(parts[2], parts[0] - 1, parts[1]);
            }
          } else if (data.birthDate.seconds) {
            birthDate = new Date(data.birthDate.seconds * 1000);
          } else if (data.birthDate instanceof Date) {
            birthDate = data.birthDate;
          }
        }

        const [firstName = '', ...lastParts] = (data.name || '').split(' ');
        const lastName = lastParts.join(' ');

        setChildData({
          firstName,
          lastName,
          gender: data.gender || '',
          birthDate,
          notes: data.notes || '',
          image: data.image || null,
          weight: data.weight ? String(data.weight) : '',
          weightUnit: data.weightUnit || 'lbs',
          height: data.height ? String(data.height) : '',
          heightUnit: data.heightUnit || 'in',
        });
      } else {
        Alert.alert('Error', 'Child profile not found.');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Failed to load child data:', error);
      Alert.alert('Error', 'Failed to load child data.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setChildData(prev => ({ ...prev, image: result.assets[0].uri }));
    }
  };

  const updateField = (field, value) => {
    setChildData(prev => ({ ...prev, [field]: value }));
  };

  const updateNestedField = (parent, child, value) => {
    setChildData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [child]: value,
      }
    }));
  };

  // Handle birth date change from DateTimePicker
  const handleDateChange = (event, selectedDate) => {
    if (selectedDate) {
      updateField('birthDate', selectedDate);
    }
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (selectedDate && selectedDate > new Date()) {
        Alert.alert("Invalid Date", "Birth date cannot be in the future.");
        updateField('birthDate', childData.birthDate); // revert
      }
    }
  };

  // iOS Done button for date picker
  const handleDatePickerDone = () => {
    if (childData.birthDate > new Date()) {
      Alert.alert("Invalid Date", "Birth date cannot be in the future.");
      updateField('birthDate', new Date());
    }
    setShowDatePicker(false);
  };

  // Weight unit toggle with conversion
  const handleWeightUnitChange = (newUnit) => {
    if (childData.weight && !isNaN(parseFloat(childData.weight))) {
      let converted = parseFloat(childData.weight);
      if (childData.weightUnit === 'lbs' && newUnit === 'kg') {
        converted = (converted * 0.453592).toFixed(1);
      } else if (childData.weightUnit === 'kg' && newUnit === 'lbs') {
        converted = (converted / 0.453592).toFixed(1);
      }
      updateField('weight', String(converted));
    }
    updateField('weightUnit', newUnit);
  };

  // Height unit toggle with conversion
  const handleHeightUnitChange = (newUnit) => {
    if (childData.height && !isNaN(parseFloat(childData.height))) {
      let converted = parseFloat(childData.height);
      if (childData.heightUnit === 'in' && newUnit === 'cm') {
        converted = (converted * 2.54).toFixed(1);
      } else if (childData.heightUnit === 'cm' && newUnit === 'in') {
        converted = (converted / 2.54).toFixed(1);
      }
      updateField('height', String(converted));
    }
    updateField('heightUnit', newUnit);
  };

  // Calculate age years
  const getAgeYears = () => {
    const today = new Date();
    const birth = new Date(childData.birthDate);
    let years = today.getFullYear() - birth.getFullYear();
    if (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
    ) {
      years--;
    }
    return years;
  };

  // Save handler with warnings
  const handleUpdate = async () => {
    if (childData.birthDate > new Date()) {
      Alert.alert("Validation Error", "Birth date cannot be in the future.");
      return;
    }

    const weightVal = parseFloat(childData.weight);
    const heightVal = parseFloat(childData.height);

    if (childData.weight && (isNaN(weightVal) || weightVal <= 0)) {
      Alert.alert("Validation Error", "Please enter a valid weight.");
      return;
    }
    if (childData.height && (isNaN(heightVal) || heightVal <= 0)) {
      Alert.alert("Validation Error", "Please enter a valid height.");
      return;
    }

    // Convert weight and height to lbs/inches for warnings
    let weightLbs = weightVal || 0;
    if (childData.weightUnit === 'kg') weightLbs = weightLbs / 0.453592;

    let heightIn = heightVal || 0;
    if (childData.heightUnit === 'cm') heightIn = heightIn / 2.54;

    const ageYears = getAgeYears();

    if (
      ageYears > AGE_WARNING_YEARS ||
      weightLbs > WEIGHT_WARNING_LBS ||
      heightIn > HEIGHT_WARNING_IN
    ) {
      Alert.alert(
        'Confirm Large Values',
        `You have entered large values:\n` +
        `${ageYears > AGE_WARNING_YEARS ? `Age: ${ageYears} years\n` : ''}` +
        `${weightLbs > WEIGHT_WARNING_LBS ? `Weight: ${childData.weight} ${childData.weightUnit}\n` : ''}` +
        `${heightIn > HEIGHT_WARNING_IN ? `Height: ${childData.height} ${childData.heightUnit}\n` : ''}` +
        `Are you sure you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, continue', onPress: () => saveData() }
        ]
      );
    } else {
      saveData();
    }
  };

  // Save data to Firestore
  const saveData = async () => {
    try {
      const docRef = doc(db, 'children', childId);
      const updatedData = {
        name: `${childData.firstName} ${childData.lastName}`.trim(),
        gender: childData.gender,
        birthDate: childData.birthDate.toISOString(),
        notes: childData.notes,
        image: childData.image,
        weight: childData.weight ? parseFloat(childData.weight) : null,
        weightUnit: childData.weightUnit,
        height: childData.height ? parseFloat(childData.height) : null,
        heightUnit: childData.heightUnit,
      };

      await updateDoc(docRef, updatedData);
      Alert.alert('Success', 'Profile updated!');
      navigation.goBack();
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Failed to update profile.');
    }
  };

  const genderOptions = ['Male', 'Female'];

  if (loading) {
    return <ActivityIndicator size="large" style={{ flex: 1 }} />;
  }

  return (
    <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={styles.gradient}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={pickImage} style={styles.imageWrapper}>
          {childData.image ? (
            <Image source={{ uri: childData.image }} style={styles.profilePic} />
          ) : (
            <Text style={styles.imagePlaceholder}>Edit Photo</Text>
          )}
        </TouchableOpacity>

        {/* Names */}
        <Text style={styles.label}>First Name</Text>
        <TextInput
          style={styles.input}
          placeholder="First Name"
          value={childData.firstName}
          onChangeText={text => updateField('firstName', text)}
        />

        <Text style={styles.label}>Last Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Last Name"
          value={childData.lastName}
          onChangeText={text => updateField('lastName', text)}
        />

        {/* Gender */}
        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow}>
          {genderOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.genderBtn,
                childData.gender === option && styles.genderSelected,
              ]}
              onPress={() => updateField('gender', option)}
            >
              <Text>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Birth Date */}
        <Text style={styles.label}>Birth Date</Text>
        <TouchableOpacity 
          onPress={() => setShowDatePicker(true)} 
          style={styles.datePickerButton}
        >
          <Text style={styles.datePickerText}>
            {childData.birthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <View style={styles.datePickerContainer}>
            <DateTimePicker
              value={childData.birthDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity onPress={handleDatePickerDone} style={styles.dateConfirmButton}>
                <Text style={styles.dateConfirmText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Weight Input */}
        <Text style={styles.label}>Weight</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.flexInput}
            placeholder="0"
            keyboardType="decimal-pad"
            value={childData.weight}
            onChangeText={text => updateField('weight', text)}
            onSubmitEditing={Keyboard.dismiss}
          />
          {['lbs', 'kg'].map(unit => (
            <TouchableOpacity
              key={unit}
              style={[
                styles.unitBtn,
                childData.weightUnit === unit && styles.unitSelected,
              ]}
              onPress={() => handleWeightUnitChange(unit)}
            >
              <Text>{unit}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Height Input */}
        <Text style={styles.label}>Height</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.flexInput}
            placeholder="0"
            keyboardType="decimal-pad"
            value={childData.height}
            onChangeText={text => updateField('height', text)}
            onSubmitEditing={Keyboard.dismiss}
          />
          {['in', 'cm'].map(unit => (
            <TouchableOpacity
              key={unit}
              style={[
                styles.unitBtn,
                childData.heightUnit === unit && styles.unitSelected,
              ]}
              onPress={() => handleHeightUnitChange(unit)}
            >
              <Text>{unit}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Notes */}
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          multiline
          numberOfLines={3}
          value={childData.notes}
          onChangeText={text => updateField('notes', text)}
        />

        {/* Save */}
        <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
          <Text style={styles.buttonText}>Save Changes</Text>
        </TouchableOpacity>

        {/* Delete */}
        <TouchableOpacity style={styles.deleteButton} onPress={async () => {
          Alert.alert('Confirm Delete', 'Delete this profile?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              onPress: async () => {
                try {
                  await deleteDoc(doc(db, 'children', childId));
                  Alert.alert('Deleted', 'Profile removed.');
                  navigation.navigate('Home', { deleted: true });
                } catch (error) {
                  console.error('Delete error:', error);
                  Alert.alert('Error', 'Failed to delete profile.');
                }
              },
              style: 'destructive',
            },
          ]);
        }}>
          <Text style={styles.buttonText}>🗑️ Delete Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { 
    flex: 1,
  },
  container: { 
    paddingTop: 50,
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  backButton: { 
    alignSelf: 'flex-start',
    color: '#007AFF',
    fontSize: 14,
    marginBottom: 20,
  },
  imageWrapper: {
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 60,
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  profilePic: { 
    width: 100, 
    height: 100, 
    borderRadius: 60 
  },
  imagePlaceholder: { 
    fontSize: 14, 
    color: '#666' 
  },
  label: { 
    fontWeight: '600', 
    marginBottom: 5 
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  genderRow: { 
    flexDirection: 'row', 
    marginBottom: 10,
  },
  genderBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  genderSelected: { 
    backgroundColor: '#b2ebf2' 
  },
  datePickerButton: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  datePickerText: {
    fontSize: 16,
    color: '#333',
  },
  datePickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  dateConfirmButton: {
    padding: 10,
    backgroundColor: '#b2ebf2',
    alignItems: 'center',
  },
  dateConfirmText: {
    fontWeight: '600',
    color: '#007AFF',
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'center',
  },
  flexInput: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginRight: 10,
  },
  unitBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  unitSelected: {
    backgroundColor: '#b2ebf2',
    borderColor: '#007AFF',
  },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#eaffd0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  deleteButton: {
    backgroundColor: '#ffcdd2',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});

export default EditChildScreen;
