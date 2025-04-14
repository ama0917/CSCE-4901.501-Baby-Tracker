import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createChild } from '../services/childService';
import { useAuthContext } from '../contexts/useAuthContext';

const AddChildScreen = ({ navigation }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState({ month: '', day: '', year: '' });
  const [notes, setNotes] = useState('');
  const { setChildId } = useAuthContext();

  const handleSave = async () => {
    if (!firstName || !birthDate.month || !birthDate.day || !birthDate.year) {
      Alert.alert('Missing Info', 'Please fill out required fields.');
      return;
    }
    // Validate birth date
    const childData = {
      name: `${firstName} ${lastName}`,
      gender,
      dob: `${birthDate.year}-${birthDate.month}-${birthDate.day}`,
      notes,
    };
    // Validate date format
    try {
      const response = await createChild(childData);
      
      if (response?.child_id) {
        // Build a child profile to store
        const newChild = {
          id: response.child_id,
          name: `${firstName} ${lastName}`,
          dob: childData.dob,
        };
  
        // Fetch any existing children
        const stored = await AsyncStorage.getItem('children');
        const children = stored ? JSON.parse(stored) : [];
  
        // Append and store back
        children.push(newChild);
        await AsyncStorage.setItem('children', JSON.stringify(children));
  
        // Also save last used child_id if needed
        await AsyncStorage.setItem('child_id', response.child_id);
        setChildId(response.child_id);
  
        Alert.alert('Success', 'Child added successfully!');
        navigation.navigate('ChildDashboard');
      } else {
        Alert.alert('Error', 'Failed to add child. Please try again.');
      }
    } catch (error) {
      console.error('Error adding child:', error);
      Alert.alert('Error', 'An error occurred while adding the child.');
    }
  };
  


  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backButton}>« Home</Text>
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
    padding: 12,
    textAlign: 'center',
    flex: 1,
    marginRight: 10,
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
