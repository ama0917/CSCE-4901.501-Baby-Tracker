import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, StatusBar, Platform } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getFirestore, collection, query, onSnapshot, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Settings, Edit3, UserPlus } from 'lucide-react-native';
import { app } from '../firebaseConfig';
import useUserRole from './useUserRole';

import { useDarkMode } from '../screens/DarkMode';
import ThemedBackground from '../screens/ThemedBackground';
import NotificationService from '../src/notifications/notificationService';

// Neon gradients for dark mode
const neonGradients = {
  profile: ['#6491ebff', '#7676dbff'],
  button1: ['#5aececff', '#62a8e5ff'],
  button2: ['#7ed36fff', '#d1e487ff'],
  edit: ['#faaa72ff', '#f68dc0ff'],
};

const HomeScreen = () => {
  const navigation = useNavigation();
  const [profiles, setProfiles] = useState([]);
  const [showEditButtons, setShowEditButtons] = useState(false);
  const db = getFirestore(app);
  const auth = getAuth();

  const { darkMode } = useDarkMode();

  useFocusEffect(
    React.useCallback(() => {
      setShowEditButtons(false);
    }, [])
  );

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const uid = currentUser.uid;

    // Query children owned by user
    const ownedQuery = query(
      collection(db, 'children'),
      where('userId', '==', uid)
    );

    // Query children where user is a caregiver
    const caregiverQuery = query(
      collection(db, 'children'),
      where('caregivers', 'array-contains', uid)
    );

    const unsubscribes = [];

    // Listen to owned children
    unsubscribes.push(
      onSnapshot(ownedQuery, (snapshot) => {
        const ownedProfiles = snapshot.docs.map((doc) => ({
          id: doc.id,
          isOwner: true,
          ...doc.data(),
        }));
        
        setProfiles((prev) => {
          const caregiverProfiles = prev.filter(p => !p.isOwner);
          return [...ownedProfiles, ...caregiverProfiles];
        });
      }, (error) => {
        console.error('Owned profiles listener error:', error);
      })
    );

    // Listen to caregiver assignments
    unsubscribes.push(
      onSnapshot(caregiverQuery, (snapshot) => {
        const assignedProfiles = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            isOwner: false,
            ...doc.data(),
          }))
          .filter((child) => {
            const perm = child.caregiverPerms?.[uid];
            return perm === 'on' || perm === 'log';
          });
        
        setProfiles((prev) => {
          const ownedProfiles = prev.filter(p => p.isOwner);
          return [...ownedProfiles, ...assignedProfiles];
        });
      }, (error) => {
        console.error('Caregiver profiles listener error:', error);
      })
    );

    return () => unsubscribes.forEach(unsub => unsub());
  }, []);


  const toggleEditButtons =() => setShowEditButtons(prev => !prev);
    return (
    <ThemedBackground>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent />
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.innerContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image source={require('../assets/NoTitleLogo.png')} style={styles.logoImageSmall} />
            </View>
            <Text style={[styles.headerTitle, { color: darkMode ? '#fff' : '#2E3A59' }]}>Home</Text>
            <TouchableOpacity style={styles.settingsButton} onPress={() => navigation.navigate('Settings')}>
              <Settings size={24} color={darkMode ? '#fff' : '#7C8B9A'} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: darkMode ? '#fff' : '#2E3A59' }]}>
              Welcome to Baby Tracker
            </Text>
            <Text style={[styles.subtitle, { color: darkMode ? '#ccc' : '#7C8B9A' }]}>
              Select a profile to continue
            </Text>
          </View>

          {/* Profiles */}
          <View style={styles.profilesContainer}>
            {profiles.length > 0 ? (
              profiles.map((profile) => (
                <View key={profile.id} style={styles.profileCard}>
                  <TouchableOpacity
                    style={styles.profileButton}
                    onPress={() => 
                      navigation.navigate('ChildDashboard', {
                        childId: profile.id,
                        name: profile.name?.split(' ')[0] || profile.firstName || 'Child',
                        image: profile.image || profile.photoURL, // supporting both field names
                      })
                    }
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={darkMode ? neonGradients.profile : ['#E3F2FD', '#F3E5F5']}
                      style={styles.profileGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <View style={styles.avatarContainer}>
                        {(profile.image || profile.photoURL) ? (
                          <Image
                            source={{ uri: profile.image || profile.photoURL }}
                            style={[
                              styles.avatarImage,
                              { borderColor: darkMode ? '#fff' : '#2E3A59' }
                            ]}
                            onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
                          />
                        ) : (
                          <View style={styles.defaultAvatar}>
                            <LinearGradient
                              colors={['#FF6B9D', '#C06C84']}
                              style={styles.defaultAvatarGradient}
                            >
                              <Text style={styles.avatarInitial}>
                                {profile.name?.charAt(0).toUpperCase() || '?'}
                              </Text>
                            </LinearGradient>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.profileName, { color: darkMode ? '#fff' : '#2E3A59' }]}>
                        {profile.name}
                        {!profile.isOwner && ' 👥'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {showEditButtons && profile.isOwner && (
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => navigation.navigate('EditChild', { childId: profile.id })}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={darkMode ? neonGradients.edit : ['#FFE0B2', '#FFCCBC']}
                        style={styles.editGradient}
                      >
                        <Edit3 size={16} color={darkMode ? '#fff' : '#E65100'} strokeWidth={2} />
                        <Text style={[styles.editText, { color: darkMode ? '#fff' : '#E65100' }]}>
                          Edit Profile
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            ) : (
              <Text
                style={{
                  color: darkMode ? '#ccc' : '#7C8B9A',
                  marginBottom: 20,
                  textAlign: 'center',
                }}
              >
                No children added yet.
              </Text>
            )}
          </View>

        {/* Action buttons */}
                <View style={[styles.actionButtons, { marginTop: 20 }]}>
                  {/* Only show Edit Profiles button if user owns at least one child */}
                  {profiles.some(p => p.isOwner) && (
                    <TouchableOpacity 
                      style={styles.editProfilesButton} 
                      onPress={toggleEditButtons} 
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={darkMode ? neonGradients.button1 : ['#FAD0C4', '#FFD1FF']}
                        style={styles.buttonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Edit3 size={20} color={darkMode ? '#fff' : '#E65100'} strokeWidth={2} />
                        <Text style={[styles.buttonText, { color: darkMode ? '#fff' : '#E65100' }]}>
                          {showEditButtons ? 'Done Editing' : 'Edit Profiles'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  {/* Always show Add Child button */}
                  <TouchableOpacity
                    style={styles.addChildButton}
                    onPress={() => navigation.navigate('AddChild')}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={darkMode ? neonGradients.button2 : ['#D0F0C0', '#B2DFDB']}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <UserPlus size={20} color={darkMode ? '#fff' : '#33691E'} strokeWidth={2} />
                      <Text style={[styles.buttonText, { color: darkMode ? '#fff' : '#33691E' }]}>
                        Add Child
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

        {/* Invite code button - always show */}
        <TouchableOpacity
          style={[
            styles.inviteButton,
            { 
              marginTop: 20,
              backgroundColor: darkMode ? '#333' : '#ECEFF1',
              borderWidth: 1,
              borderColor: darkMode ? '#555' : '#CFD8DC'
            }
          ]}
          onPress={() => navigation.navigate('AcceptInvite')}
          activeOpacity={0.8}
        >
          <Text style={{ 
            color: darkMode ? '#aaa' : '#546E7A', 
            fontWeight: '600',
            fontSize: 14
          }}>
            Enter Caregiver Invite Code
          </Text>
        </TouchableOpacity>

              </View>
            </ScrollView>
          </ThemedBackground>
        );
        };

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  innerContainer: {
    padding: 30,
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
  },
  header:
   { 
    flexDirection: 'row',
     justifyContent: 'space-between', 
     alignItems: 'center',
     marginBottom: 30 
    },
  headerTitle: 
  {
    fontSize: 20, 
    fontWeight: '600', 
    textAlign: 'center', 
    flex: 1, right: 8
   },
  logoImageSmall:
   { 
    width: 80,
     height: 80, 
     resizeMode: 'contain'
     },
  logoContainer: 
  { 
    position: 'relative' 
  },
  titleSection: 
  { alignItems: 'center', 
    marginBottom: 40 
  },
  title:
   { 
    fontSize: 28,
     fontWeight: '700', 
     textAlign: 'center',
      marginBottom: 8 
    },
  subtitle:
   { 
    fontSize: 16, 
    textAlign: 'center'
   },
  profilesContainer: 
  { 
    alignItems: 'center',
     marginBottom: 40 
    },
  profileCard:
   { 
    alignItems: 'center', 
    marginBottom: 20 
  },
  profileButton: {
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  profileGradient: {
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 160,
  },
  avatarContainer: 
  { 
    marginBottom: 12
   },
  avatarImage: 
  {
     width: 80,
      height: 80, 
      borderRadius: 40, 
      borderWidth: 3,
      backgroundColor: '#f0f0f0',
    },
  defaultAvatar: 
  { 
    width: 80, 
    height: 80, 
    borderRadius: 40
   },
  defaultAvatarGradient: 
  { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  avatarInitial:
   { 
    fontSize: 32, 
    fontWeight: '700', 
    color: 'white' 
  },
  profileName: 
  { 
    fontSize: 18, 
    fontWeight: '600',
     textAlign: 'center' 
    },
  editButton: 
  { 
    marginTop: 12, 
    borderRadius: 12,
     shadowOpacity: 0.2, 
     elevation: 5 
    },
  editGradient: 
  { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8, 
    paddingHorizontal: 16,
     borderRadius: 12 },
  editText: 
  { 
    fontSize: 14, 
    fontWeight: '600', 
    marginLeft: 6 },
  individualEditButton:
   { 
    marginTop: 6,
     paddingVertical: 4, 
     paddingHorizontal: 12, 
     backgroundColor: '#fff3e0', 
     borderRadius: 6 },
  actionButtons:
   { 
    gap: 16
   },
  buttonGradient: 
  { 
    flexDirection: 'row',
     alignItems: 'center', 
     justifyContent: 'center', 
     paddingVertical: 16, 
     paddingHorizontal: 24, 
     borderRadius: 16, gap: 10 
    },
  buttonText: 
  { 
    fontSize: 16,
     fontWeight: '600' 
    },
    inviteButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
  },
});

export default HomeScreen;
