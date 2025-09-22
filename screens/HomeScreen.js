import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient} from 'expo-linear-gradient';
import { getFirestore, collection, getDocs, query, onSnapshot, where, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '../firebaseConfig';
import { useActiveChild } from '../src/contexts/ActiveChildContext';
import NotificationService from '../src/notifications/notificationService';

const HomeScreen = () => {
  const navigation = useNavigation();
  const [profiles, setProfiles] = useState([]);
  const [showEditButtons, setShowEditButtons] =useState(false);
  const db = getFirestore(app);
  const auth = getAuth();
  const { setActiveChildId, setActiveChildName } = useActiveChild();

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
  
    const q = query(
      collection(db, 'children'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updatedProfiles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProfiles(updatedProfiles);
    }, (error) => {
      console.error('Realtime profile listener error:', error);
    });
  
    return () => unsubscribe(); 
  }, []);

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
        <Text style={styles.subtitle}>Select a profile</Text>

        <View style={styles.profileList}>
          {profiles.map((profile) => {
            console.log("Profile Image URL:", profile.image);
            return(
            <View key={profile.id} style={styles.profileWrapper}>
            <TouchableOpacity
              onPress={() => {
                try { setActiveChildId(profile.id); setActiveChildName(profile.name?.split(' ')[0] || null); } catch (e) { /* ignore if context not available */ }
                navigation.navigate('ChildDashboard', { name: profile.name?.split(' ')[0], childId: profile.id, image: profile.image});
              }}
            >
              {profile.image ? (
                <Image source={{ uri: profile.image }} style={styles.avatarImage} />
              ) : (
                <Image source ={require('../assets/default-profile.png')} 
                style ={styles.avatarImage}/> // default image incase they do not choose one
              )}
              <Text style={styles.profileText}>{profile.name}</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              {showEditButtons && (
                <TouchableOpacity style ={styles.individualEditButton} onPress={() => navigation.navigate('EditChild', { childId: profile.id})}>
                  <Text style={{ fontSize: 14}}>Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.individualEditButton, { marginLeft: 8 }]} onPress={async () => {
                try {
                  const res = await NotificationService.sendDigestNotificationForChild(profile.id);
                  if (res) alert('Notification scheduled');
                  else alert('No notification sent (throttled or no data)');
                } catch (e) { console.error(e); alert('Failed to send notification'); }
              }}>
                <Text style={{ fontSize: 14}}>Send Digest</Text>
              </TouchableOpacity>
            </View>
            </View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.editButton} onPress={toggleEditButtons}>
          <Text style={styles.buttonText}>✏️ Edit Profiles</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddChild')}>
          <Text style={styles.buttonText}>➕ Add Child</Text>
        </TouchableOpacity>
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
