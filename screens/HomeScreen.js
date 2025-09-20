import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient} from 'expo-linear-gradient';
import { getFirestore, collection, getDocs, query, onSnapshot, where, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '../firebaseConfig';
import useUserRole from './useUserRole';


const HomeScreen = () => {
  const navigation = useNavigation();
  const [profiles, setProfiles] = useState([]);
  const [showEditButtons, setShowEditButtons] =useState(false);
  const db = getFirestore(app);
  const auth = getAuth();
  const { role } = useUserRole(); // 'parent' | 'caregiver' | undefined


  useEffect(() => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  const uid = currentUser?.uid;
  if (!uid) return;

  // Parent sees children they own; Caregiver sees children assigned to them
  const base = collection(db, 'children');
  if (!role) return; // if hook can be undefined briefly
  const qRoles =
    role === 'parent'
     ? query(base, where('userId', '==', uid))
     : query(base, where('caregivers', 'array-contains', uid));

  const unsubscribe = onSnapshot(
    qRoles,
    (snapshot) => {
      const updatedProfiles = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      if (role === 'parent') {
        setProfiles(updatedProfiles);
      } else {
        const uid = auth.currentUser?.uid;
        const visible = updatedProfiles.filter(
          c => (c.caregiverPerms?.[uid] === 'on') || (c.caregiverPerms?.[uid] === 'log') // compat
        );
        setProfiles(visible);
      }
    },
    (error) => {
      console.error('Realtime profile listener error:', error);
    }
  );

  return () => unsubscribe();
}, [role]);


  const toggleEditButtons =() => setShowEditButtons(prev => !prev);
    return (
    <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={styles.gradient}>
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Image source={require('../assets/logo.png')} style={styles.logo} />
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Welcome to Baby Tracker</Text>

        <Text style={styles.subtitle}>
          {role !== 'parent' ? 'Select an assigned child' : 'Select a profile'}
        </Text>
        {role !== 'parent' && profiles.length === 0 && (
          <TouchableOpacity
            style={{ marginTop: 14, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#CFD8DC' }}
            onPress={() => navigation.navigate('AcceptInvite')}
          >
            <Text style={{ color: '#2E3A59', fontWeight: '700' }}>Enter caregiver invite code</Text>
          </TouchableOpacity>
        )}

        <View style={styles.profileList}>
          {profiles.map((profile) => {
            console.log("Profile Image URL:", profile.image);
            return(
            <View key={profile.id} style={styles.profileWrapper}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ChildDashboard', { name: profile.name?.split(' ')[0], childId: profile.id, image: profile.image})}
            >
              {profile.image ? (
                <Image source={{ uri: profile.image }} style={styles.avatarImage} />
              ) : (
                <Image source ={require('../assets/default-profile.png')} 
                style ={styles.avatarImage}/> // default image incase they do not choose one
              )}
              <Text style={styles.profileText}>{profile.name}</Text>
            </TouchableOpacity>
            {showEditButtons && (
              <TouchableOpacity style ={styles.individualEditButton} onPress={() => navigation.navigate('EditChild', { childId: profile.id})}>
              <Text style={{ fontSize: 14}}>Edit</Text>
              </TouchableOpacity>
            )}
            </View>
            );
          })}
        </View>

        {role === 'parent' && (
          <>
            <TouchableOpacity style={styles.editButton} onPress={toggleEditButtons}>
              <Text style={styles.buttonText}>✏️ Edit Profiles</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddChild')}>
              <Text style={styles.buttonText}>➕ Add Child</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient:{
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  container: {
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    width: 65,
    height: 65,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  settingsIcon: {
    fontSize: 30,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#444',
    textAlign: 'center',
    marginTop: 5,
  },
  subtitle: {
    fontSize: 18,
    marginVertical: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  profileList: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  profileWrapper: {
    alignItems: 'center',
    marginVertical: 15,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    resizeMode: 'cover',
    borderBottom: 8,
  },
  defaultAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#B2EBF2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  individualEditButton: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#fff3e0',
    borderRadius: 6
  },
  editButton: {
    backgroundColor: '#ffeaa7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10
  },
  addButton: {
    backgroundColor: '#eaffd0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;
