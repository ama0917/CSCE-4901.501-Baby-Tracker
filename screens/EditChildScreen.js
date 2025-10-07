import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  arrayRemove,
  deleteField,
  onSnapshot,
} from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { app } from '../firebaseConfig';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Trash2 } from 'lucide-react-native';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';
import { Timestamp } from 'firebase/firestore';

const EditChildScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { childId } = route.params || {};

  const { darkMode } = useDarkMode();
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;

  const db = getFirestore(app);
  const storage = getStorage(app);

  const [childData, setChildData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    birthDate: { month: '', day: '', year: '' },
    notes: '',
    image: null,
  });
  const [loading, setLoading] = useState(true);

  const [cgList, setCgList] = useState([]);
  const [cgPerms, setCgPerms] = useState({});

  useEffect(() => {
    if (childId) loadChildData();
  }, []);

  // Live listener for caregiver list & permissions
  useEffect(() => {
    if (!childId) return;
    const refDoc = doc(db, 'children', childId);
    const unsub = onSnapshot(refDoc, (snap) => {
      const data = snap.data() || {};
      setCgList(Array.isArray(data.caregivers) ? data.caregivers : []);
      setCgPerms(data.caregiverPerms || {});
    });
    return () => unsub();
  }, [childId]);

  const loadChildData = async () => {
  try {
    const docRef = doc(db, 'children', childId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      // Split name into first and last
      const [firstName = '', ...lastParts] = (data.name || '').split(' ');
      const lastName = lastParts.join(' ');

      // Format birthDate safely
      let formattedBirthDate = { month: '', day: '', year: '' };
      if (data.birthDate) {
        let dateObj = data.birthDate.toDate
          ? data.birthDate.toDate() // Firestore Timestamp
          : new Date(data.birthDate); // fallback if it's a string

        if (!isNaN(dateObj)) {
          formattedBirthDate = {
            month: String(dateObj.getMonth() + 1).padStart(2, '0'),
            day: String(dateObj.getDate()).padStart(2, '0'),
            year: String(dateObj.getFullYear()),
          };
        }
      }

      // Set state
      setChildData({
        ...data,
        firstName,
        lastName,
        birthDate: formattedBirthDate,
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
      const localUri = result.assets[0].uri;
      const filename = `${childId}_${Date.now()}`; // unique filename
      const storageRef = ref(storage, `childProfiles/${filename}`);

      try {
        // Convert image to blob
        const response = await fetch(localUri);
        const blob = await response.blob();

        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);

        setChildData((prev) => ({ ...prev, image: downloadURL }));
      } catch (error) {
        console.error('Upload failed:', error);
        Alert.alert('Error', 'Failed to upload image.');
      }
    }
  };

  const handleUpdate = async () => {
    try {
      const docRef = doc(db, 'children', childId);
      const { birthDate } = childData;
      let birthDateValue = null;
 // Only save if all parts are provided
      if (birthDate?.month && birthDate?.day && birthDate?.year) {
        const isoString = `${birthDate.year}-${birthDate.month.padStart(2, '0')}-${birthDate.day.padStart(2, '0')}`;
        const dateObj = new Date(isoString);
        if (!isNaN(dateObj)) {
          birthDateValue = Timestamp.fromDate(dateObj);
        }
      }

      const updatedData = {
        ...childData,
        name: `${childData.firstName} ${childData.lastName}`.trim(),
        birthDate: birthDateValue, // always a Firestore Timestamp
      };
      delete updatedData.firstName;
      delete updatedData.lastName;

      await updateDoc(docRef, updatedData);
      Alert.alert('Success', 'Profile updated!');
      navigation.goBack();
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Failed to update profile.');
    }
  };

  const setPerm = async (uid, perm) => {
    await updateDoc(doc(db, 'children', childId), {
      [`caregiverPerms.${uid}`]: perm,
    });
  };

  const removeCaregiver = async (uid) => {
    await updateDoc(doc(db, 'children', childId), {
      caregivers: arrayRemove(uid),
      [`caregiverPerms.${uid}`]: deleteField(),
    });
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
    <ThemedBackground>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
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

          <Text style={[styles.title, { color: currentTheme.textPrimary }]}>Edit Child</Text>

          <TouchableOpacity onPress={pickImage} style={styles.imageWrapper}>
            {childData.image ? (
              <Image source={{ uri: childData.image }} style={styles.profilePic} />
            ) : (
              <Text style={{ color: currentTheme.textSecondary }}>Edit Photo</Text>
            )}
          </TouchableOpacity>

          {/* First & Last Name Inputs */}
          <LinearGradient
            colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']}
            style={styles.inputCard}
          >
            <TextInput
              style={[styles.input, { color: currentTheme.textPrimary }]}
              placeholder="First Name"
              placeholderTextColor={currentTheme.textSecondary}
              value={childData.firstName}
              onChangeText={(text) => setChildData({ ...childData, firstName: text })}
            />
          </LinearGradient>

          <LinearGradient
            colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']}
            style={styles.inputCard}
          >
            <TextInput
              style={[styles.input, { color: currentTheme.textPrimary }]}
              placeholder="Last Name"
              placeholderTextColor={currentTheme.textSecondary}
              value={childData.lastName}
              onChangeText={(text) => setChildData({ ...childData, lastName: text })}
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
                  childData.gender === g && { backgroundColor: darkMode ? '#6C63FF' : '#b2ebf2' },
                ]}
                onPress={() => setChildData({ ...childData, gender: g })}
              >
                <Text style={{ color: childData.gender === g ? '#fff' : currentTheme.textPrimary }}>
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
                    ph === 'MM'
                      ? childData.birthDate?.month
                      : ph === 'DD'
                      ? childData.birthDate?.day
                      : childData.birthDate?.year
                  }
                  onChangeText={(val) =>
                    setChildData({
                      ...childData,
                      birthDate: {
                        ...childData.birthDate,
                        ...(ph === 'MM' ? { month: val } : ph === 'DD' ? { day: val } : { year: val }),
                      },
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
              style={[styles.input, { height: 100, textAlignVertical: 'top', color: currentTheme.textPrimary }]}
              placeholder="Notes (optional)"
              placeholderTextColor={currentTheme.textSecondary}
              value={childData.notes}
              onChangeText={(text) => setChildData({ ...childData, notes: text })}
              multiline
            />
          </LinearGradient>

          {/* Manage Caregivers */}
          <View style={{ marginTop: 20, padding: 12, backgroundColor: '#F5F7FA', borderRadius: 12 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, color: '#2E3A59', marginBottom: 10 }}>
              Manage Caregivers
            </Text>
            {cgList.length === 0 ? (
              <Text style={{ color: '#7C8B9A' }}>No caregivers assigned yet.</Text>
            ) : (
              cgList.map((uid) => {
                const perm = cgPerms?.[uid] || 'view';
                const isView = perm === 'view';
                const isLog = perm === 'log';
                return (
                  <View key={uid} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#ECEFF1' }}>
                    <Text style={{ color: '#2E3A59', marginBottom: 8 }}>{uid}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={() => setPerm(uid, 'view')}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          backgroundColor: isView ? '#CFD8DC' : '#ECEFF1',
                          marginRight: 8,
                        }}
                      >
                        <Text style={{ color: '#2E3A59', fontWeight: '600' }}>View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setPerm(uid, 'log')}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          backgroundColor: isLog ? '#81D4FA' : '#ECEFF1',
                          marginRight: 8,
                        }}
                      >
                        <Text style={{ color: isLog ? '#fff' : '#2E3A59', fontWeight: '600' }}>Log</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeCaregiver(uid)}
                        style={{
                          marginLeft: 'auto',
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          backgroundColor: '#FFCDD2',
                        }}
                      >
                        <Text style={{ color: '#B71C1C', fontWeight: '700' }}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Save */}
          <TouchableOpacity onPress={handleUpdate} style={{ marginTop: 20 }}>
            <LinearGradient
              colors={darkMode ? ['#00c6ff', '#0072ff'] : ['#90CAF9', '#81D4FA']}
              style={styles.actionButton}
            >
              <Text style={styles.buttonText}>Save Changes</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Delete */}
          <TouchableOpacity onPress={handleDelete} style={{ marginTop: 10 }}>
            <LinearGradient colors={['#ff6a00', '#ee0979']} style={styles.actionButton}>
              <Trash2 size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.buttonText}>Delete Profile</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerButton: { borderRadius: 16 },
  headerButtonGradient: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  logo: { width: 50, height: 50, resizeMode: 'contain' },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  imageWrapper: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 60, width: 100, height: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  profilePic: { width: 100, height: 100, borderRadius: 60 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 5, marginTop: 15 },
  inputCard: { borderRadius: 16, padding: 4, marginBottom: 10 },
  input: { padding: 12, fontSize: 16 },
  genderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  genderBtn: { flex: 1, padding: 14, borderRadius: 12, marginRight: 10, alignItems: 'center' },
  birthRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  actionButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 20, paddingVertical: 16 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default EditChildScreen;
