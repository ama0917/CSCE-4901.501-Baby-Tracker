import React, { useState } from 'react';
import {View,  Text,  TextInput,  TouchableOpacity,  StyleSheet,  Image,  Alert,  ScrollView,} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';

{/* Child profiles are currently not persistent throughtout the app*/}
const AddChildScreen = () => {
  const navigation = useNavigation();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState({month:'',day: '', year: ''});
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    if (!firstName || !birthDate.month || !birthDate.day || !birthDate.year) {
      Alert.alert('Missing Info', 'Please fill out required fields.');
      return;
    }
  
    const newProfile = {
      name: `${firstName} ${lastName}`,
      gender,
      birthDate,
      notes,
      image,
    };
  
    // updates homescreen with new child added
    navigation.navigate('Home', { newProfile });
  };
  

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backButton}>« Home</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={pickImage} style={styles.imageWrapper}>
        {image ? (
          <Image source={{ uri: image }} style={styles.profilePic} />
        ) : (
          <Text style={styles.imagePlaceholder}>Add Photo</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.header}>Add Child</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter First Name"
        value={firstName}
        onChangeText={setFirstName}
      />
      <TextInput
        style={styles.input}
        placeholder="Enter Last Name"
        value={lastName}
        onChangeText={setLastName}
      />

      <Text style={styles.label}>Gender</Text>
      <View style={styles.genderRow}>
        <TouchableOpacity
          style={[styles.genderBtn, gender === 'Male' && styles.genderSelected]}
          onPress={() => setGender('Male')}
        >
          <Text>Male</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.genderBtn, gender === 'Female' && styles.genderSelected]}
          onPress={() => setGender('Female')}
        >
          <Text>Female</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Birth Date</Text>
      <View style={styles.birthRow}>
        <TextInput
          style={styles.birthInput}
          placeholder="MM"
          maxLength={2}
          keyboardType="numeric"
          value={birthDate.month}
          onChangeText={(text) => setBirthDate({ ...birthDate, month: text })}
        />
        <TextInput
          style={styles.birthInput}
          placeholder="DD"
          maxLength={2}
          keyboardType="numeric"
          value={birthDate.day}
          onChangeText={(text) => setBirthDate({ ...birthDate, day: text })}
        />
        <TextInput
          style={styles.birthInput}
          placeholder="YYYY"
          maxLength={4}
          keyboardType="numeric"
          value={birthDate.year}
          onChangeText={(text) => setBirthDate({ ...birthDate, year: text })}
        />
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={styles.notesInput}
        placeholder="Add any health notes or preferences..."
        multiline
        numberOfLines={3}
        value={notes}
        onChangeText={setNotes}
      />

      <TouchableOpacity style={styles.addButton} onPress={handleSave}>
        <Text style={styles.buttonText}>Add Child</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    paddingHorizontal: 20,
    backgroundColor: '#E3F2FD',
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
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  imagePlaceholder: {
    fontSize: 15,
  },
  profilePic: {
    width: 100,
    height: 100,
    borderRadius: 60,
  },
  header: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  label: {
    fontWeight: '500',
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  genderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    backgroundColor: '#b2ebf2',
  },
  birthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  birthInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    flex: 1,
    marginRight: 10,
    padding: 12,
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  addButton: {
    backgroundColor: '#eaffd0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 30,
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});

export default AddChildScreen;
