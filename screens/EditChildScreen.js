import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert, ScrollView, SafeAreaView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getFirestore, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { app } from '../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Trash2 } from 'lucide-react-native';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';

const EditChildScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { childId } = route.params || {};
  const { darkMode } = useDarkMode();
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;
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
    if (childId) loadChildData();
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
      const updatedData ={
        ...childData,
        name: `${childData.firstName} ${childData.lastName}`.trim(),
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
      <SafeAreaView Style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <LinearGradient colors={darkMode ? currentTheme.card : ['#fff', '#f5f5f5']}
                style={styles.headerButtonGradient}>
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
            <Text style={{ color: currentTheme.textSecondary}}>Edit Photo</Text>
          )}
        </TouchableOpacity>
          <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
        <TextInput
          style={[styles.input, { color: currentTheme.textPrimary}]}
          placeholder="First Name"
          placeholderTextColor={currentTheme.textSecondary}
          value={childData.firstName}
          onChangeText={(text) => setChildData({ ...childData, firstName: text })}
        />
        </LinearGradient>
          <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
        <TextInput
          style={[styles.input, { color: currentTheme.textPrimary}]}
          placeholder="Last Name"
          placeholderTextColor={currentTheme.textSecondary}
          value={childData.lastName}
          onChangeText={(text) => setChildData({ ...childData, lastName: text })}
        />
      </LinearGradient>

        <Text style={[styles.label, { color: currentTheme.textPrimary}]}>Gender</Text>
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
                <Text style={{ color: childData.gender === g ? '#fff' : currentTheme.textPrimary }}>{g}</Text>
              </TouchableOpacity>
            ))}
        </View>

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

          <LinearGradient colors={darkMode ? currentTheme.card : ['#ffffffee', '#f9f9ff']} style={styles.inputCard}>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top', color: currentTheme.textPrimary }]}
              placeholder="Notes (optional)"
              placeholderTextColor={currentTheme.textSecondary}
              value={childData.notes}
              onChangeText={(text) => setChildData({ ...childData, notes: text })}
              multiline
            />
          </LinearGradient>

       <TouchableOpacity onPress={handleUpdate} style={{ marginTop: 20 }}>
            <LinearGradient
              colors={darkMode ? ['#00c6ff', '#0072ff'] : ['#90CAF9', '#81D4FA']}
              style={styles.actionButton}
            >
              <Text style={styles.buttonText}>Save Changes</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDelete} style={{ marginTop: 10 }}>
            <LinearGradient
              colors={['#ff6a00', '#ee0979']}
              style={styles.actionButton}
            >
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
  container: { 
    flex: 1 
  },
  scrollContent: { 
    padding: 20,
    paddingBottom: 40,
},
header:
{
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
},
  headerButton: { 
  borderRadius: 16,
},
headerButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo:
  {
    width: 50,
    height:50,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 26,
    fontweight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  imageWrapper: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 60,
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
    fontSize: 16,
    fontWeight: '600', 
    marginBottom: 5, 
    marginTop:15,
}, 
  inputCard:
  {
    borderRadius: 16,
    padding: 4,
    marginBottom: 10,
  },
  input: {
    padding: 12,
    fontSize: 16,
  },
  genderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    marginBottom: 10 
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
  actionButton:{
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default EditChildScreen;
