import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, ScrollView, SafeAreaView, } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { app } from '../firebaseConfig';
import { getAuth } from 'firebase/auth';
import { ArrowLeft } from 'lucide-react-native';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';
import { Timestamp } from 'firebase/firestore';

const AddChildScreen = () => {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState({ month: '', day: '', year: '' });
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState(null);

  const db = getFirestore(app);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

    const handleSave = async () => {
      if (!firstName || !birthDate.month || !birthDate.day || !birthDate.year) {
        Alert.alert('Missing Info', 'Please fill out required fields.');
        return;
      }

      // Convert input into a real Date
      const isoString = `${birthDate.year}-${birthDate.month.padStart(2, '0')}-${birthDate.day.padStart(2, '0')}`;
      const parsedDate = new Date(isoString);

      if (isNaN(parsedDate.getTime())) {
        Alert.alert('Invalid Date', 'Please enter a valid birth date.');
        return;
      }

      // Validate age cap (max 5 years)
      const today = new Date();
      const ageDiffMs = today - parsedDate;
      const ageDate = new Date(ageDiffMs);
      const ageYears = Math.abs(ageDate.getUTCFullYear() - 1970);

      if (ageYears >= 5) {
        Alert.alert('Age Limit', 'Child must be under 5 years old to be added.');
        return;
      }

      try {
        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) {
          Alert.alert('Authentication Error', 'You must be logged in to add a child.');
          return;
        }

        const db = getFirestore(app);

        const newProfile = {
          name: `${firstName} ${lastName}`.trim(),
          gender,
          birthDate: Timestamp.fromDate(parsedDate),
          notes,
          image,
          userId: currentUser.uid,
          createdAt: Timestamp.fromDate(new Date()),
        };

        const docRef = await addDoc(collection(db, 'children'), newProfile);

        // Ensure user role is tagged as parent
        try {
          const userRef = doc(db, 'Users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, { UserType: 'parent' }, { merge: true });
          } else if (!userSnap.data()?.UserType) {
            await updateDoc(userRef, { UserType: 'parent' });
          }
        } catch (_) {
          // not critical
        }

        navigation.navigate('Home', { newProfile: { id: docRef.id, ...newProfile } });
      } catch (e) {
        console.error('Error adding child profile: ', e);
        Alert.alert('Error', 'Something went wrong while saving the profile.');
      }
    };
  return (
    <ThemedBackground>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
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

          <Text style={[styles.title, { color: currentTheme.textPrimary }]}>Add Child</Text>

          {/* Photo */}
          <TouchableOpacity onPress={pickImage} style={styles.imageWrapper}>
            {image ? (
              <Image source={{ uri: image }} style={styles.profilePic} />
            ) : (
              <Text style={styles.imagePlaceholder}>Add Photo</Text>
            )}
          </TouchableOpacity>

          {/* First Name */}
          <LinearGradient
            colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']}
            style={styles.inputCard}
          >
            <TextInput
              style={[styles.input, { color: currentTheme.textPrimary }]}
              placeholder="First Name"
              placeholderTextColor={currentTheme.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
            />
          </LinearGradient>

          {/* Last Name */}
          <LinearGradient
            colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']}
            style={styles.inputCard}
          >
            <TextInput
              style={[styles.input, { color: currentTheme.textPrimary }]}
              placeholder="Last Name"
              placeholderTextColor={currentTheme.textSecondary}
              value={lastName}
              onChangeText={setLastName}
            />
          </LinearGradient>

          {/* Gender */}
          <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Gender</Text>
          <View style={styles.genderRow}>
            {['Male', 'Female'].map((g) => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.genderBtn,
                  gender === g && { backgroundColor: darkMode ? '#6C63FF' : '#b2ebf2' },
                ]}
                onPress={() => setGender(g)}
              >
                <Text style={{ color: gender === g ? '#fff' : currentTheme.textPrimary }}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Birth Date */}
          <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Birth Date</Text>
          <View style={styles.birthRow}>
            {['MM', 'DD', 'YYYY'].map((ph, i) => (
              <LinearGradient
                key={ph}
                colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']}
                style={[styles.inputCard, { flex: 1, marginRight: i < 2 ? 8 : 0 }]}
              >
                <TextInput
                  style={[styles.input, { textAlign: 'center', color: currentTheme.textPrimary }]}
                  placeholder={ph}
                  placeholderTextColor={currentTheme.textSecondary}
                  keyboardType="numeric"
                  maxLength={ph === 'YYYY' ? 4 : 2}
                  value={
                    ph === 'MM' ? birthDate.month : ph === 'DD' ? birthDate.day : birthDate.year
                  }
                  onChangeText={(val) =>
                    setBirthDate({
                      ...birthDate,
                      ...(ph === 'MM'
                        ? { month: val }
                        : ph === 'DD'
                        ? { day: val }
                        : { year: val }),
                    })
                  }
                />
              </LinearGradient>
            ))}
          </View>

          {/* Notes */}
          <LinearGradient
            colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']}
            style={styles.inputCard}
          >
            <TextInput
              style={[
                styles.notesInput,
                { height: 100, textAlignVertical: 'top', color: currentTheme.textPrimary },
              ]}
              placeholder="Add any health notes or preferences..."
              placeholderTextColor={currentTheme.textSecondary}
              multiline
              value={notes}
              onChangeText={setNotes}
            />
          </LinearGradient>

          {/* Save Button */}
          <TouchableOpacity onPress={handleSave} style={{ marginTop: 20 }}>
            <LinearGradient
              colors={darkMode ? ['#8e2de2', '#4a00e0'] : ['#A5D6A7', '#81D4FA']}
              style={styles.addButton}
            >
              <Text style={styles.buttonText}>Add Child</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    color: '#007AFF',
    fontSize: 14,
    marginBottom: 20,
  },
  imageWrapper: 
  {
    alignSelf: 'center',
    borderRadius: 60,
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems:'center',
    marginBottom: 20,
  },
  headerButton:
  {
    borderRadius: 16,
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
    resizeMode: 'contain',

  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    marginTop: 15,
  },
  input:
   {
    padding: 12,
    fontSize: 16,
  },
  genderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  genderBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    marginRight: 10,
    alignItems: 'center',
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
  addButton: {
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  inputCard:
  {
    borderRadius: 16,
    padding: 4,
    marginBottom: 10
  },
});

export default AddChildScreen;


