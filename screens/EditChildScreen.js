import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getFirestore, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { app } from '../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';

const EditChildScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { childId } = route.params || {};

  const db = getFirestore(app);
  const [childData, setChildData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    birthDate: { month: '', day: '', year: '' },
    notes: '',
    image: null,
  });
  const [loading, setLoading] = useState(true);

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
          const [firstName = '', ...lastParts] = (data.name || '').split(' ');
          const lastName = lastParts.join(' ');
          setChildData({
            ...data,
            firstName,
            lastName,
          });
        } else {
        Alert.alert('Error', 'Child profile not found.');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Failed to load child data:', error);
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

  const handleUpdate = async () => {
    try {
      const docRef = doc(db, 'children', childId);
      await updateDoc(docRef, childData);
      Alert.alert('Success', 'Profile updated!');
      navigation.goBack();
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Failed to update profile.');
    }
  };

  const handleDelete = async () => {
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
  };

  if (loading) {
    return <ActivityIndicator size="large" style={{ flex: 1 }} />;
  }

  return (
    <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={styles.gradient}>
      <ScrollView contentContainerStyle={styles.container}>
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

        <Text style={styles.label}>First Name</Text>
        <TextInput
          style={styles.input}
          placeholder="First Name"
          value={childData.lastname}
          onChangeText={(text) => setChildData({ ...childData, lastName: text })}
        />
        <Text style={styles.label}>Last Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Last Name"
          value={childData.lastName}
          onChangeText={(text) => setChildData({ ...childData, lastName: text })}
        />

        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow}>
          <TouchableOpacity
            style={[styles.genderBtn, childData.gender === 'Male' && styles.genderSelected]}
            onPress={() => setChildData({ ...childData, gender: 'Male' })}
          >
            <Text>Male</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderBtn, childData.gender === 'Female' && styles.genderSelected]}
            onPress={() => setChildData({ ...childData, gender: 'Female' })}
          >
            <Text>Female</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Birth Date</Text>
        <View style={styles.birthRow}>
          <TextInput
            style={styles.birthInput}
            placeholder="MM"
            value={childData.birthDate?.month}
            onChangeText={(text) => setChildData({ ...childData, birthDate: { ...childData.birthDate, month: text } })}
          />
          <TextInput
            style={styles.birthInput}
            placeholder="DD"
            value={childData.birthDate?.day}
            onChangeText={(text) => setChildData({ ...childData, birthDate: { ...childData.birthDate, day: text } })}
          />
          <TextInput
            style={styles.birthInput}
            placeholder="YYYY"
            value={childData.birthDate?.year}
            onChangeText={(text) => setChildData({ ...childData, birthDate: { ...childData.birthDate, year: text } })}
          />
        </View>

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          multiline
          numberOfLines={3}
          value={childData.notes}
          onChangeText={(text) => setChildData({ ...childData, notes: text })}
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
          <Text style={styles.buttonText}>Save Changes</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.buttonText}>🗑️ Delete Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { 
    flex: 1 
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
    fontSize: 14, color: '#666' 
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
    marginBottom: 10 
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
