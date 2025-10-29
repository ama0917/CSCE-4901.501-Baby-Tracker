import React, { useState, useEffect, useRef  } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Pressable } from 'react-native';
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
  profile: ['#6e98edff', '#7171c1ff'],
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
  
      // ---- micro-interaction state ----
    const scalesRef = useRef({});

    const animateScale = (id, toValue) => {
      if (!scalesRef.current[id]) {
        scalesRef.current[id] = new Animated.Value(1);
      }
      Animated.spring(scalesRef.current[id], {
        toValue,
        useNativeDriver: true,
        speed: 20,
        bounciness: 6,
      }).start();
    };


  const toggleEditButtons =() => setShowEditButtons(prev => !prev);
    return (
    <ThemedBackground>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never">
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
               <Animated.View
                style={[
                  { transform: [{ scale: scalesRef.current[profile.id] || 1 }] },
                  { width: '100%' }, 
                ]}
              >
                <Pressable
                  onPressIn={() => animateScale(profile.id, 0.96)}
                  onPressOut={() => animateScale(profile.id, 1)}
                  onPress={() =>
                    navigation.navigate('ChildDashboard', {
                      childId: profile.id,
                      name: profile.name?.split(' ')[0] || profile.firstName || 'Child',
                      image: profile.image || profile.photoURL,
                    })
                  }
                  android_ripple={{ color: 'rgba(0,0,0,0.05)', borderless: true }}
                  style={({ pressed }) => [styles.profileButton, pressed && { opacity: 0.95 }]}
                >
                  <LinearGradient
                    colors={darkMode ? neonGradients.profile : ['#E3F2FD', '#F3E5F5']}
                    style={styles.profileGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.avatarContainer}>
                      <LinearGradient
                        colors={darkMode ? ['#7AA7FF', '#C9A7FF'] : ['#9AD0FF', '#FBC2EB']}
                        style={styles.avatarRing}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        {(profile.image || profile.photoURL) ? (
                          <Image
                            source={{ uri: profile.image || profile.photoURL }}
                            style={styles.avatarImage}
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
                      </LinearGradient>
                    </View>

                    <Text style={[styles.profileName, { color: darkMode ? '#fff' : '#2E3A59' }]} numberOfLines={2}>
                      {profile.name}
                      {!profile.isOwner && ' 👥'}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </Animated.View>

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
             </SafeAreaView>
          </ThemedBackground>
        );
        };

const SP = 16;
const styles = StyleSheet.create({ 
  safeArea: {
  backgroundColor: 'transparent',
  paddingTop: Platform.OS === 'ios' ? 6 : 12, 
},
  container: { 
    flex: 1,

   },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 0,
  },
  innerContainer: {
  paddingHorizontal: SP * 1.5,
  paddingBottom: 0,
  maxWidth: 520,           
  alignSelf: 'center',
  width: '100%',
  },
  header:
   { 
    flexDirection: 'row',
     justifyContent: 'space-between', 
     alignItems: 'center',
     paddingHorizontal: 20,
     marginTop: 15, 
    },
  headerTitle: 
  {
    fontSize: 22, 
    fontWeight: '800', 
    textAlign: 'center', 
    flex: 1
   },
  logoImageSmall:
   { 
    width: 70,
     height: 70, 
     resizeMode: 'contain',
    
    },
  logoContainer: 
  { 
    width: 32, 
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',

  },
  titleSection: 
  {
     alignItems: 'center', 
     marginTop: 10,
     marginBottom: 16,

  },
  title:
   { 
    fontSize: 25,
     fontWeight: '700', 
     textAlign: 'center',
     marginTop: 15,
     marginBottom: 8 
    },
  subtitle:
   { 
    fontSize: 16, 
    textAlign: 'center'
   },
  profilesContainer: 
  { 
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center', 
      rowGap: SP * 1.5,
      columnGap: SP,
      marginTop: SP,
  },
  profileCard:
   { 
      flexBasis: '45%',
      maxWidth: '45%',         
      alignItems: 'center',
  },
  profileButton: {
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  profileGradient: {
    paddingVertical: 22,
    paddingHorizontal: 26,
    borderRadius: 22,
    alignItems: 'center',
    minWidth: 0,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  avatarRing: 
  {
      padding: 3,             
      borderRadius: 44,      
      alignItems: 'center',
      justifyContent: 'center',
  },
  avatarContainer: 
  { 
      marginBottom: 10,
      alignItems: 'center',
      justifyContent: 'center',
   },
  avatarImage: 
  {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    },
  defaultAvatar: 
  { 
    width: 70, 
    height: 76, 
    borderRadius: 38,
   },
  defaultAvatarGradient: 
  { 
    width: 76, 
    height: 76, 
    borderRadius: 38, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  avatarInitial:
   { 
    fontSize: 30, 
    fontWeight: '700', 
    color: 'white' 
  },
  profileName: 
  { 
  fontSize: 16,
  fontWeight: '700',
  textAlign: 'center',
  marginTop: 8,
  lineHeight: 20,        
  maxWidth: 160, 
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
