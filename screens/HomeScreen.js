import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, StatusBar, Platform } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient} from 'expo-linear-gradient';
import { getFirestore, collection, getDocs, query, onSnapshot, where, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Settings, Edit3, UserPlus, Sparkles } from 'lucide-react-native';
import { app } from '../firebaseConfig';

const HomeScreen = () => {
  const navigation = useNavigation();
  const [profiles, setProfiles] = useState([]);
  const [showEditButtons, setShowEditButtons] = useState(false);
  const db = getFirestore(app);
  const auth = getAuth();

  // Hide edit buttons when screen comes into focus (e.g., returning from edit screen)
  useFocusEffect(
    React.useCallback(() => {
      setShowEditButtons(false);
    }, [])
  );

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

  const toggleEditButtons = () => setShowEditButtons(prev => !prev);

  return (
    <LinearGradient colors={['#B2EBF2', '#FCE4EC', '#F3E5F5']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerContainer}>
          {/* Header Section */}
          <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image source={require('../assets/NoTitleLogo.png')} style={styles.logoImageSmall} />
          </View>

          <Text style={styles.headerTitle}>Home</Text>

          <TouchableOpacity style={styles.settingsButton}>
            <Settings size={24} color="#7C8B9A" strokeWidth={1.5} />
          </TouchableOpacity>
        </View>

          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Welcome to Baby Tracker</Text>
            <Text style={styles.subtitle}>Select a profile to continue</Text>
          </View>

          {/* Profiles Section */}
          <View style={styles.profilesContainer}>
            {profiles.map((profile) => (
              <View key={profile.id} style={styles.profileCard}>
                <TouchableOpacity
                  style={styles.profileButton}
                  onPress={() => navigation.navigate('ChildDashboard', { 
                    name: profile.name?.split(' ')[0], 
                    childId: profile.id, 
                    image: profile.image
                  })}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
                    style={styles.profileGradient}
                  >
                    <View style={styles.avatarContainer}>
                      {profile.image ? (
                        <Image source={{ uri: profile.image }} style={styles.avatarImage} />
                      ) : (
                        <View style={styles.defaultAvatar}>
                          <LinearGradient
                            colors={['#81D4FA', '#F8BBD9']}
                            style={styles.defaultAvatarGradient}
                          >
                            <Text style={styles.avatarInitial}>
                              {profile.name?.charAt(0)?.toUpperCase() || '?'}
                            </Text>
                          </LinearGradient>
                        </View>
                      )}
                    </View>
                    <Text style={styles.profileName}>{profile.name}</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                {showEditButtons && (
                  <TouchableOpacity 
                    style={styles.editButton} 
                    onPress={() => navigation.navigate('EditChild', { childId: profile.id })}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#FFE0B2', '#FFCC80']}
                      style={styles.editGradient}
                    >
                      <Edit3 size={16} color="#E65100" strokeWidth={2} />
                      <Text style={styles.editText}>Edit</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.editProfilesButton} 
              onPress={toggleEditButtons}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FAD0C4', '#FFD1FF']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Edit3 size={20} color="#E65100" strokeWidth={2} />
                <Text style={styles.buttonText}>
                  {showEditButtons ? 'Done Editing' : 'Edit Profiles'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.addChildButton} 
              onPress={() => navigation.navigate('AddChild')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#D0F0C0', '#B2DFDB']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <UserPlus size={20} color="#33691E" strokeWidth={2} />
                <Text style={[styles.buttonText, { color: '#33691E' }]}>Add Child</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  innerContainer: {
    padding: 30,
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2E3A59',
    textAlign: 'center',
    flex: 1,
    right: 8,
  },
  logoImageSmall: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  logoContainer: {
    position: 'relative',
  },
  logoGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  logoSparkle: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  settingsButton: {
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  settingsGradient: {
    width: 48,
    height: 48,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129, 212, 250, 0.2)',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2E3A59',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7C8B9A',
    textAlign: 'center',
  },
  profilesContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileButton: {
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  profileGradient: {
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 160,
    borderWidth: 1.5,
    borderColor: 'rgba(129, 212, 250, 0.2)',
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(129, 212, 250, 0.3)',
  },
  defaultAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  defaultAvatarGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2E3A59',
    textAlign: 'center',
  },
  editButton: {
    marginTop: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  editGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  editText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    marginLeft: 6,
  },
  actionButtons: {
    gap: 16,
  },
  editProfilesButton: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  addChildButton: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A4A4A',
  },
});

export default HomeScreen;