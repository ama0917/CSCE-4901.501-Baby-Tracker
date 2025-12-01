import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert, Animated, Dimensions, Platform, StatusBar } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { Bell, ArrowLeft, Settings, Sparkles, TrendingUp, Activity, Image as ImageIcon, Calendar, Edit2, Trash2 } from 'lucide-react-native';
import { app } from '../firebaseConfig';
import { useDarkMode } from '../screens/DarkMode';
import ThemedBackground from '../screens/ThemedBackground';
import useUserRole from './useUserRole';       
import { getAuth } from 'firebase/auth'; 
import { Info } from 'lucide-react-native';
import { Modal, Easing } from 'react-native';      
import { CalendarDays, Ruler, Weight, UserRound, X, Cake } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Clock } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const db = getFirestore(app);

const darkModeGradients = {
  feeding: ['#00c6ff', '#0072ff'],
  diaper: ['#ff6a00', '#ee0979'],
  sleep: ['#8e2de2', '#4a00e0'],
  card: ['#1f1f1f', '#2c2c2c'],
  profile: ['#ff00cc', '#333399'],
};

// helper used to scope caregiver queries to "today"
const getTodayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};


export default function ChildDashboard() {
  const navigation = useNavigation();
  const route = useRoute();
  const { name, childId, image } = route.params || {};
  const { darkMode } = useDarkMode();
  const [userEmails, setUserEmails] = useState({});
  const { role } = useUserRole();                  
  const isCaregiver = role === 'caregiver';        
  const uid = getAuth().currentUser?.uid;          
  const [canView, setCanView] = useState(true);    
  const [isOwner, setIsOwner] = useState(false);   
  const [canLog, setCanLog] = useState(true);
const [hasParentAccess, setHasParentAccess] = useState(false);
  const [history, setHistory] = useState([]);
  const [childInfo, setChildInfo] = useState(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const profileScale = useRef(new Animated.Value(0.8)).current;
  const buttonScales = useRef([new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(profileScale, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!childId || !uid) { 
      setCanView(false); 
      setIsOwner(false); 
      setCanLog(false); 
      setHasParentAccess(false);
      return; 
    }

    const ref = doc(db, 'children', childId);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      
      setChildInfo({
        name: data.firstName ? `${data.firstName} ${data.lastName || ''}`.trim() : name,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        birthdate: data.birthdate || data.birthDate || null,
        sex: data.sex || '',
        weight: data.weight ?? null,
        weightUnit: data.weightUnit || 'lbs',
        height: data.height ?? null,
        heightUnit: data.heightUnit || 'in',
        notes: data.notes || '',
        image: data.image || null,
      });
      
      // Check if user is the owner
      const owner = data?.userId === uid;
      
      // Get caregiver permission level
      const permissionLevel = data?.caregiverPerms?.[uid];
      
      // Determine access levels based on permissions
      setIsOwner(owner);
      
      // Parent access: owner OR caregiver with 'parent' permission
      setHasParentAccess(owner || permissionLevel === 'parent');
      
      // Can view: owner OR any caregiver permission except 'none'
      setCanView(owner || (permissionLevel && permissionLevel !== 'none'));
      
      // Can log: owner OR 'log' OR 'parent' permission
      setCanLog(owner || permissionLevel === 'log' || permissionLevel === 'parent' || permissionLevel === 'on');
      
      console.log('Permission check:', {
        uid,
        owner,
        permissionLevel,
        canView: owner || (permissionLevel && permissionLevel !== 'none'),
        canLog: owner || permissionLevel === 'log' || permissionLevel === 'parent' || permissionLevel === 'on',
        hasParentAccess: owner || permissionLevel === 'parent'
      });
    });
    
    return () => unsub();
  }, [childId, uid]);

  useFocusEffect(
    React.useCallback(() => {
      if (!childId) {
        Alert.alert('Error', 'Child ID is missing. Please return to Home and try again.');
        navigation.goBack();
      } else {
        fetchChildData();
        
        // Double-check permissions on focus
        if (uid) {
          (async () => {
            try {
              const childDocRef = doc(db, 'children', childId);
              const childDoc = await getDoc(childDocRef);
              
              if (childDoc.exists()) {
                const data = childDoc.data();
                const owner = data.userId === uid;
                const permissionLevel = data?.caregiverPerms?.[uid];
                
                setIsOwner(owner);
                setHasParentAccess(owner || permissionLevel === 'parent');
                setCanView(owner || (permissionLevel && permissionLevel !== 'none'));
                setCanLog(owner || permissionLevel === 'log' || permissionLevel === 'parent' || permissionLevel === 'on');
              }
            } catch (e) {
              console.log('Permission check error:', e);
              setCanView(false);
              setCanLog(false);
              setHasParentAccess(false);
            }
          })();
        }
      }
    }, [childId, uid])
  );

  const animateButton = (index) => {
    Animated.sequence([
      Animated.spring(buttonScales[index], { toValue: 0.95, useNativeDriver: true, duration: 100 }),
      Animated.spring(buttonScales[index], { toValue: 1, useNativeDriver: true, duration: 100 }),
    ]).start();
  };

  const toDate = (val) => {
    if (!val) return null;
    if (val?.toDate) return val.toDate();
    const d = new Date(val);
    return isNaN(d) ? null : d;
    };

  const formatAge = (birth) => {
    const b = toDate(birth);
    if (!b) return '—';
    const t = new Date();
    let y = t.getFullYear() - b.getFullYear();
    let m = t.getMonth() - b.getMonth();
    let d = t.getDate() - b.getDate();
    if (d < 0) { m--; d += new Date(t.getFullYear(), t.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    if (y <= 0 && m <= 0) return `${d} d`;
    if (y <= 0) return `${m} mo${m>1?'s':''}${d?` ${d} d`:''}`;
    return `${y} yr${y>1?'s':''}${m?` ${m} mo${m>1?'s':''}`:''}`;
  };

const safe = (v, placeholder='—') => (v === 0 || v ? String(v) : placeholder);

  const formatTime = (timestamp) => {
    const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    return new Date(timestamp).toLocaleTimeString([], options);
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours > 0 ? `${hours} hr` : ''} ${mins} min`;
  };


  const fetchUserEmail = async (userId) => {
    if (!userId) return null;
    
    // Check if we already have this user's email cached
    if (userEmails[userId]) {
      return userEmails[userId];
    }
    
    try {
      // Import getDoc at the top if not already imported
      const { getDoc } = await import('firebase/firestore');
      
      // Fetch user document directly by ID
      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        // Use lowercase 'email' field (fallback to uppercase if needed)
        const email = userData.email || userData.Email || null;
        
        console.log('Fetched email for user:', userId, email); // Debug log
        
        if (email) {
          // Cache the email to avoid repeated fetches
          setUserEmails(prev => ({ ...prev, [userId]: email }));
          return email;
        }
      } else {
        console.log('No user document found for:', userId);
      }
    } catch (error) {
      console.error('Error fetching user email for userId:', userId, error);
    }
    
    return null;
  };

  const fetchChildData = async () => {
    try {
      // Diaper logs
      const diaperLogsQuery = query(
        collection(db, 'diaperLogs'),
        where('childId', '==', childId),
        ...(isCaregiver ? [where('logDate', '==', getTodayStr())] : []),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const diaperSnapshot = await getDocs(diaperLogsQuery);
      const diaperLogs = diaperSnapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: 'Diaper Change',
          subtype: data.stoolType,
          time: formatTime(data.timestamp?.toDate()) || 'Unknown',
          timestamp: data.timestamp?.toDate() || new Date(0),
          createdBy: data.createdBy || null,
          collection: 'diaperLogs',
        };
      });

      // Feeding logs
      const feedingLogsQuery = query(
        collection(db, 'feedLogs'),
        where('childId', '==', childId),
        ...(isCaregiver ? [where('logDate', '==', getTodayStr())] : []),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const feedingSnapshot = await getDocs(feedingLogsQuery);
      const feedLogs = feedingSnapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: 'Feeding',
          subtype: data.feedType,
          amount: data.amount ? `${data.amount} ${data.amountUnit || ''}` : '',
          notes: data.notes || '',
          time: formatTime(data.timestamp?.toDate()) || 'Unknown',
          timestamp: data.timestamp?.toDate() || new Date(0),
          createdBy: data.createdBy || null,
          collection: 'feedLogs',
        };
      });

      // Sleep logs
      const sleepLogsQuery = query(
        collection(db, 'sleepLogs'),
        where('childId', '==', childId),
        ...(isCaregiver ? [where('logDate', '==', getTodayStr())] : []),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const sleepSnapshot = await getDocs(sleepLogsQuery);
      const sleepLogs = sleepSnapshot.docs.map((d) => {
        const data = d.data();
        const incomplete = data.incomplete || false;
        return {
          id: d.id,
          type: 'Sleep',
          subtype: incomplete ? 'Still sleeping...' : formatDuration(data.duration),
          sleepType: data.sleepType || '',
          incomplete: incomplete,
          time: formatTime(data.timestamp?.toDate()) || 'Unknown',
          timestamp: data.timestamp?.toDate() || new Date(0),
          createdBy: data.createdBy || null,
          collection: 'sleepLogs',
        };
      });

      const combinedLogs = [...diaperLogs, ...feedLogs, ...sleepLogs]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);
      
      setHistory(combinedLogs);
      
      // Fetch emails for all unique users who created these logs
      const uniqueUserIds = [...new Set(combinedLogs.map(log => log.createdBy).filter(Boolean))];
      for (const userId of uniqueUserIds) {
        await fetchUserEmail(userId);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Unable to fetch data.');
    }
  };

  const getLoggerDisplay = (userId) => {
    if (!userId) return 'Unknown';
    
    // If this is the current user
    if (userId === uid) {
      return 'You';
    }
    
    // If we have the email cached
    if (userEmails[userId]) {
      const email = userEmails[userId];
      // Extract name before @ or show first part of email
      const displayName = email.split('@')[0];
      return displayName;
    }
    
    return 'Loading...';
  };

  const canModifyLog = (log) => {
    // Owners and those with parent access can modify all logs
    if (isOwner || hasParentAccess) return true;
    
    // Caregivers with logging permission can only modify their own logs
    return canLog && log.createdBy === uid;
  };

  const handleDeleteLog = async (log) => {
    if (!canModifyLog(log)) {
      Alert.alert('Permission Denied', 'You can only delete logs you created.');
      return;
    }

    Alert.alert(
      'Delete Log',
      'Are you sure you want to delete this log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { deleteDoc, doc } = await import('firebase/firestore');
              await deleteDoc(doc(db, log.collection, log.id));
              Alert.alert('Success', 'Log deleted successfully');
              fetchChildData();
            } catch (error) {
              console.error('Error deleting log:', error);
              Alert.alert('Error', 'Failed to delete log');
            }
          }
        }
      ]
    );
  };

  const handleEditLog = async (log) => {
    if (!canModifyLog(log)) {
      Alert.alert('Permission Denied', 'You can only edit logs you created.');
      return;
    }

    try {
      // Fetch the full log data from Firestore
      const { getDoc, doc } = await import('firebase/firestore');
      const logDoc = await getDoc(doc(db, log.collection, log.id));
      
      if (!logDoc.exists()) {
        Alert.alert('Error', 'Log not found');
        return;
      }
      
      const logData = logDoc.data();
      
      // Navigate to appropriate form with existing data
      switch (log.collection) {
        case 'feedLogs':
          navigation.navigate('FeedingForm', { 
            childId, 
            name, 
            editingLogId: log.id,
            existingData: {
              feedType: logData.feedType,
              amount: logData.amount,
              amountUnit: logData.amountUnit,
              notes: logData.notes,
              timestamp: logData.timestamp?.toDate(),
            }
          });
          break;
        case 'diaperLogs':
          navigation.navigate('DiaperChangeForm', { 
            childId, 
            name, 
            editingLogId: log.id,
            existingData: {
              stoolType: logData.stoolType,
              time: logData.time?.toDate(),
              notes: logData.notes,
            }
          });
          break;
        case 'sleepLogs':
          navigation.navigate('SleepingForm', { 
            childId, 
            name, 
            editingLogId: log.id,
            existingData: {
              sleepType: logData.sleepType,
              duration: logData.duration,
              timestamp: logData.timestamp?.toDate(),
              incomplete: logData.incomplete,
              notes: logData.notes,
            }
          });
          break;
      }
    } catch (error) {
      console.error('Error fetching log data:', error);
      Alert.alert('Error', 'Failed to load log data');
    }
  };

  if (!canView) {
    return (
      <LinearGradient colors={['#E3F2FD', '#FFFFFF']} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ margin: 20, backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name="lock-closed" size={48} color="#9E9E9E" />
          </View>
          <Text style={{ color: '#2E3A59', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
            Access Restricted
          </Text>
          <Text style={{ color: '#7C8B9A', textAlign: 'center', marginBottom: 16 }}>
            The parent has turned off access for this child. Please contact them to request access.
          </Text>
          <TouchableOpacity
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
            style={{ padding: 12, backgroundColor: '#CFD8DC', borderRadius: 10, alignItems: 'center' }}
          >
            <Text style={{ color: '#2E3A59', fontWeight: '700' }}>Return Home</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const getActivityIcon = (type) => {
    switch (type) {
      case 'Feeding':
        return require('../assets/bottle.png');
      case 'Diaper Change':
        return require('../assets/diaper.png');
      case 'Sleep':
        return require('../assets/sleep.png');
      default:
        return require('../assets/bottle.png');
    }
  };

  const activityButtons = [
    {
      title: 'Feeding',
      icon: require('../assets/bottle.png'),
      gradient: ['#81D4FA', '#B39DDB'],
      dark: darkModeGradients.feeding,
      onPress: () => {
        animateButton(0);
        navigation.navigate('FeedingForm', { childId, name });
      },
    },
    {
      title: 'Diaper',
      icon: require('../assets/diaper.png'),
      gradient: ['#F8BBD9', '#FFB74D'],
      dark: darkModeGradients.diaper,
      onPress: () => {
        animateButton(1);
        navigation.navigate('DiaperChangeForm', { childId, name });
      },
    },
    {
      title: 'Sleep',
      icon: require('../assets/sleep.png'),
      gradient: ['#A5D6A7', '#81D4FA'],
      dark: darkModeGradients.sleep,
      onPress: () => {
        animateButton(2);
        navigation.navigate('SleepingForm', { childId, name });
      },
    },
  ];

  return (
    <ThemedBackground>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <Animated.View style={[styles.innerContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton} activeOpacity={0.7}>
            <LinearGradient colors={darkMode ? darkModeGradients.card : ['#fff', '#f5f5f5']} style={styles.headerButtonGradient}>
              <ArrowLeft size={20} color={darkMode ? '#fff' : '#2E3A59'} />
            </LinearGradient>
          </TouchableOpacity>

          <Image source={require('../assets/logo.png')} style={styles.logo} />

          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.headerButton} activeOpacity={0.7}>
            <LinearGradient colors={darkMode ? darkModeGradients.card : ['#fff', '#f5f5f5']} style={styles.headerButtonGradient}>
              <Settings size={20} color={darkMode ? '#fff' : '#2E3A59'} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Profile */}
      <View style={styles.profileSection}>
        <Text style={[styles.title, { color: darkMode ? '#fff' : '#2E3A59' }]}>{name}'s Dashboard</Text>

        <Animated.View style={[styles.profileContainer, { transform: [{ scale: profileScale }] }]}>
          <LinearGradient
            colors={darkMode ? darkModeGradients.profile : ['#81D4FA', '#F8BBD9']}
            style={styles.profileGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {image ? (
              <Image source={{ uri: image }} style={styles.profileImage} />
            ) : (
              <Image source={require('../assets/default-profile.png')} style={styles.profileImage} />
            )}
          </LinearGradient>
          <View style={styles.profileSparkle}>
            <Sparkles size={16} color={darkMode ? '#ff80ff' : '#F8BBD9'} />
          </View>
        </Animated.View>
        {/* Info Button */}
        <TouchableOpacity
          style={styles.infoFab}
          onPress={() => setInfoVisible(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={darkMode ? ['#2d2f35', '#3b3f47'] : ['#81D4FA', '#F8BBD9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.infoFabGrad}
          >
            <Info size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
        </View>

          {/* Permission Status Badge - shown to caregivers */}
          {!isOwner && (
            <View style={[
              styles.permissionBadge,
              { 
                backgroundColor: hasParentAccess 
                  ? (darkMode ? '#2a3a1a' : '#E8F5E9') 
                  : canLog 
                  ? (darkMode ? '#2a3a2a' : '#E3F2FD')
                  : (darkMode ? '#3a3a2a' : '#FFF9C4')
              }
            ]}>
              <Ionicons 
                name={hasParentAccess ? 'star' : canLog ? 'create' : 'eye'} 
                size={14} 
                color={
                  hasParentAccess 
                    ? (darkMode ? '#A5D6A7' : '#2E7D32') 
                    : canLog 
                    ? (darkMode ? '#64b5f6' : '#1976d2')
                    : (darkMode ? '#FFD54F' : '#F57C00')
                }
              />
              <Text style={[
                styles.permissionBadgeText,
                { 
                  color: hasParentAccess 
                    ? (darkMode ? '#A5D6A7' : '#2E7D32') 
                    : canLog 
                    ? (darkMode ? '#64b5f6' : '#1976d2')
                    : (darkMode ? '#FFD54F' : '#F57C00')
                }
              ]}>
                {hasParentAccess ? 'Full Parent Access' : canLog ? 'Can Log' : 'View Only'}
              </Text>
            </View>
          )}

        {/* Modern Profile Sheet */}
        <Modal
          visible={infoVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setInfoVisible(false)}
        >
          <View style={styles.sheetOverlay}>
            <BlurView intensity={40} tint={darkMode ? 'dark' : 'light'} style={styles.blur} />
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setInfoVisible(false)} />

            <View style={[styles.sheet, { backgroundColor: darkMode ? '#17181c' : '#ffffff' }]}>
              {/* Handle */}
              <View style={[styles.handle, { backgroundColor: darkMode ? '#2a2c31' : '#e9edf2' }]} />

              {/* Header */}
              <View style={[styles.headerRow, { justifyContent: 'center' }]}>
                <View style={styles.avatarRing}>
                  <LinearGradient colors={darkMode ? ['#4b5563', '#374151'] : ['#81D4FA', '#F8BBD9']} style={styles.avatarGrad}>
                    {childInfo?.image ? (
                      <Image source={{ uri: childInfo.image }} style={styles.avatarImg} />
                    ) : (
                      <UserRound size={28} color="#fff" />
                    )}
                  </LinearGradient>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.name, { color: darkMode ? '#fff' : '#2E3A59' }]}>
                    {childInfo?.firstName || childInfo?.name || 'Your Child'}
                  </Text>

                  {/* Age + Birthday chips */}
                  <View style={styles.chipsRow}>
                    <View style={[styles.chip, { backgroundColor: darkMode ? '#23262c' : '#eef7ff' }]}>
                      <CalendarDays size={14} color={darkMode ? '#9cc9ff' : '#2f6fab'} />
                      <Text style={[styles.chipText, { color: darkMode ? '#cfe6ff' : '#2f6fab' }]}>
                        {formatAge(childInfo?.birthdate)}
                      </Text>
                    </View>
                    {toDate(childInfo?.birthdate) && (
                      <View style={[styles.chip, { backgroundColor: darkMode ? '#23262c' : '#f6eefe' }]}>
                        <Cake size={14} color={darkMode ? '#e3d0ff' : '#7a3aa7'} />
                        <Text style={[styles.chipText, { color: darkMode ? '#eddcff' : '#7a3aa7' }]}>
                          {toDate(childInfo.birthdate).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

              </View>

              {/* Stat cards */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: darkMode ? '#1e2026' : '#f5f8fd', borderColor: darkMode ? '#2a2e36' : '#e6edf7' }]}>
                  <Weight size={18} color={darkMode ? '#a3e0ff' : '#2f6fab'} />
                  <Text style={[styles.statLabel, { color: darkMode ? '#9aa3af' : '#6b7a8c' }]}>Weight</Text>
                  <Text style={[styles.statValue, { color: darkMode ? '#e7f5ff' : '#2E3A59' }]}>
                    {safe(childInfo?.weight)} {safe(childInfo?.weightUnit)}
                  </Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: darkMode ? '#1e2026' : '#f5f8fd', borderColor: darkMode ? '#2a2e36' : '#e6edf7' }]}>
                  <Ruler size={18} color={darkMode ? '#c4b5fd' : '#7a3aa7'} />
                  <Text style={[styles.statLabel, { color: darkMode ? '#9aa3af' : '#6b7a8c' }]}>Height</Text>
                  <Text style={[styles.statValue, { color: darkMode ? '#f1f0ff' : '#2E3A59' }]}>
                    {safe(childInfo?.height)} {safe(childInfo?.heightUnit)}
                  </Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: darkMode ? '#1e2026' : '#f5f8fd', borderColor: darkMode ? '#2a2e36' : '#e6edf7' }]}>
                  <UserRound size={18} color={darkMode ? '#fdcfe8' : '#b21b79'} />
                  <Text style={[styles.statLabel, { color: darkMode ? '#9aa3af' : '#6b7a8c' }]}>Sex</Text>
                  <Text style={[styles.statValue, { color: darkMode ? '#ffe7f7' : '#2E3A59' }]}>{safe(childInfo?.sex)}</Text>
                </View>
              </View>

              {/* Notes */}
              <View style={[styles.notesBox, { backgroundColor: darkMode ? '#1d1f25' : '#f8fafc', borderColor: darkMode ? '#2a2e36' : '#ebeff5' }]}>
                <Text style={[styles.notesLabel, { color: darkMode ? '#9aa3af' : '#6b7a8c' }]}>Notes</Text>
                <Text style={[styles.notesText, { color: darkMode ? '#e5e7eb' : '#425166' }]}>
                  {childInfo?.notes?.trim() ? childInfo.notes : 'No notes added yet.'}
                </Text>
              </View>

              {/* Close */}
              <TouchableOpacity onPress={() => setInfoVisible(false)} activeOpacity={0.9} style={{ marginTop: 8 }}>
                <LinearGradient colors={darkMode ? ['#30343c', '#3b3f47'] : ['#81D4FA', '#F8BBD9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.closeBtn}>
                  <Text style={styles.closeText}>Close</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Activities */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View className="section" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: darkMode ? '#fff' : '#2e3a59' }]}>Log Activities</Text>
              <Activity size={20} color={darkMode ? '#fff' : '#2E3A59'} strokeWidth={2} />
            </View>

            {/* Only show activity logging buttons if owner or caregiver with logging permission */}
            {canLog ? (
              <View style={styles.activitiesGrid}>
                {activityButtons.map((activity, index) => (
                  <Animated.View key={activity.title} style={{ transform: [{ scale: buttonScales[index] }] }}>
                    <TouchableOpacity style={styles.activityButton} onPress={activity.onPress} activeOpacity={0.8}>
                      <LinearGradient
                        colors={darkMode ? activity.dark : activity.gradient}
                        style={styles.activityGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Image source={activity.icon} style={styles.activityIcon} />
                        <Text style={styles.activityText}>{activity.title}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            ) : (
              // View-only message
              <View style={[
                styles.viewOnlyBanner,
                { backgroundColor: darkMode ? '#2a3a2a' : '#FFF9B0' }
              ]}>
                <Ionicons name="eye" size={20} color={darkMode ? '#A5D6A7' : '#F57C00'} />
                <Text style={[
                  styles.viewOnlyText,
                  { color: darkMode ? '#A5D6A7' : '#2E3A59' }
                ]}>
                  View-only access. Ask the parent for logging permission.
                </Text>
              </View>
            )}
          </View>

          {/* Featured Health Tracking Section */}
          {hasParentAccess && (
            <View style={styles.featuredSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: darkMode ? '#fff' : '#2e3a59' }]}>
                  Health Insights
                </Text>
                <Ionicons name="fitness" size={20} color={darkMode ? '#fff' : '#2E3A59'} />
              </View>

              {/* Reports Card */}
              <TouchableOpacity
                style={styles.featuredCard}
                onPress={() => navigation.navigate('ReportsScreen', { childId, name })}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={darkMode ? ['#0a3a5a', '#003d5c'] : ['#E3F2FD', '#BBDEFB']}
                  style={styles.featuredGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.featuredContent}>
                    <View style={styles.featuredLeft}>
                      <View style={[styles.featuredIconContainer, { backgroundColor: darkMode ? '#1976d2' : '#2196F3' }]}>
                        <TrendingUp size={24} color="#fff" strokeWidth={2.5} />
                      </View>
                      <View style={styles.featuredText}>
                        <Text style={[styles.featuredTitle, { color: darkMode ? '#fff' : '#0D47A1' }]}>
                          Reports & Analytics
                        </Text>
                        <Text style={[styles.featuredSubtitle, { color: darkMode ? '#64B5F6' : '#1565C0' }]}>
                          Sleep, feeding & diaper insights
                        </Text>
                      </View>
                    </View>
                    <Ionicons 
                      name="chevron-forward" 
                      size={24} 
                      color={darkMode ? '#64B5F6' : '#1976d2'} 
                    />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Growth Tracking Card */}
              <TouchableOpacity
                style={styles.featuredCard}
                onPress={() => navigation.navigate('MeasurementsScreen', { childId, name })}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={darkMode ? ['#1b5e20', '#2d5016'] : ['#E8F5E9', '#C8E6C9']}
                  style={styles.featuredGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.featuredContent}>
                    <View style={styles.featuredLeft}>
                      <View style={[styles.featuredIconContainer, { backgroundColor: darkMode ? '#388E3C' : '#4CAF50' }]}>
                        <Ionicons name="analytics" size={24} color="#fff" />
                      </View>
                      <View style={styles.featuredText}>
                        <Text style={[styles.featuredTitle, { color: darkMode ? '#fff' : '#1B5E20' }]}>
                          Growth Tracking
                        </Text>
                        <Text style={[styles.featuredSubtitle, { color: darkMode ? '#81C784' : '#2E7D32' }]}>
                          Weight, height & CDC percentiles
                        </Text>
                      </View>
                    </View>
                    <Ionicons 
                      name="chevron-forward" 
                      size={24} 
                      color={darkMode ? '#81C784' : '#388E3C'} 
                    />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: darkMode ? '#fff' : '#2e3a59' }]}>
                Quick Actions
              </Text>
              <Ionicons name="flash" size={20} color={darkMode ? '#fff' : '#2E3A59'} />
            </View>

            <View style={[styles.actionGridCard]}>
              <View style={styles.actionButtonsContainerGrid}> 
                
                {/* Reminders button */}
                <TouchableOpacity
                  style={styles.actionButtonGrid}
                  onPress={() => navigation.navigate('RemindersScreen', { childId, name })}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={darkMode ? ['#ff6a00', '#ee0979'] : ['#FFB74D', '#FF9800']}
                    style={styles.actionButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Bell size={18} color="#fff" strokeWidth={2} />
                    <Text style={styles.actionButtonText}>Reminders</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Memories button */}
                {hasParentAccess && (
                  <TouchableOpacity
                    style={styles.actionButtonGrid}
                    onPress={() => navigation.navigate('MemoriesScreen', { childId, name })}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={darkMode ? ['#E1BEE7', '#CE93D8'] : ['#E1BEE7', '#FFCDD2']}
                      style={styles.actionButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <ImageIcon size={18} color="#fff" strokeWidth={2} />
                      <Text style={styles.actionButtonText}>Memories</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* Pediatrician Finder button */}
                {hasParentAccess && (
                  <TouchableOpacity
                    style={styles.actionButtonGrid}
                    onPress={() => navigation.navigate('PediatricianFinder')}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={darkMode ? ['#e14c2bff', '#de4040ff']: ['#ed7e65ff', '#f16767ff']}
                      style={styles.actionButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Ionicons name="medical" size={18} color="#fff" strokeWidth={2} />
                      <Text style={styles.actionButtonText}>Find Pediatrician</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* Lullaby button */}
                {/* <TouchableOpacity
                  style={styles.actionButtonGrid}
                  onPress={() => navigation.navigate('LullabyScreen', { childId, name })}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={darkMode ? ['#9C27B0', '#7B1FA2'] : ['#BA68C8', '#AB47BC']}
                    style={styles.actionButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="moon" size={18} color="#fff" strokeWidth={2} />
                    <Text style={styles.actionButtonText}>Lullabies</Text>
                  </LinearGradient>
                </TouchableOpacity> */}
              </View>
            </View>

          {/* History */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: darkMode ? '#fff' : '#2E3A59' }]}>Recent Activity</Text>
              <View style={styles.historyBadge}>
                <Text style={styles.historyBadgeText}>{history.length}</Text>
              </View>
            </View>

            <View style={[styles.historyContainer, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
              {history.length > 0 ? (
                history.map((item, index) => (
                  <View key={index} style={styles.historyItem}>
                    <View style={styles.historyIconContainer}>
                      <LinearGradient
                        colors={
                          item.type === 'Feeding'
                            ? darkMode ? darkModeGradients.feeding : ['#81D4FA', '#B39DDB']
                            : item.type === 'Diaper Change'
                            ? darkMode ? darkModeGradients.diaper : ['#F8BBD9', '#FFB74D']
                            : darkMode ? darkModeGradients.sleep : ['#A5D6A7', '#81D4FA']
                        }
                        style={styles.historyIconGradient}
                      >
                        <Image source={getActivityIcon(item.type)} style={styles.historyIcon} />
                      </LinearGradient>
                    </View>
                    
                    <View style={styles.historyContent}>
                      <View style={styles.historyTextRow}>
                        <Text style={[styles.historyText, { color: darkMode ? '#fff' : '#2E3A59' }]}>
                          {item.type}
                        </Text>
                        {canModifyLog(item) && (
                          <View style={styles.historyActions}>
                            <TouchableOpacity
                              onPress={() => handleEditLog(item)}
                              style={styles.historyActionButton}
                              activeOpacity={0.7}
                            >
                              <Edit2 size={14} color={darkMode ? '#64B5F6' : '#2196F3'} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteLog(item)}
                              style={styles.historyActionButton}
                              activeOpacity={0.7}
                            >
                              <Trash2 size={14} color={darkMode ? '#EF5350' : '#F44336'} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.historyMetaRow}>
                        <Text style={[styles.historyTime, { color: darkMode ? '#B0BEC5' : '#7C8B9A' }]}>
                          {item.time}
                        </Text>
                        {item.createdBy && (
                          <>
                            <Text style={[styles.historyDivider, { color: darkMode ? '#B0BEC5' : '#7C8B9A' }]}>
                              •
                            </Text>
                            <Text style={[styles.historyLogger, { color: darkMode ? '#90A4AE' : '#9E9E9E' }]}>
                              by {getLoggerDisplay(item.createdBy)}
                            </Text>
                          </>
                        )}
                      </View>
                      
                      {item.subtype && (
                        <Text style={[styles.historySubtext, { color: darkMode ? '#90A4AE' : '#A0A0A0' }]}>
                          {item.type === 'Sleep' && item.incomplete}
                          {item.type === 'Sleep' && item.sleepType && `${item.sleepType} - `}
                          {item.subtype}
                        </Text>
                      )}
                      
                      {item.amount && (
                        <Text style={[styles.historySubtext, { color: darkMode ? '#90A4AE' : '#A0A0A0' }]}>
                          Amount: {item.amount}
                        </Text>
                      )}
                      
                      {item.notes && (
                        <TouchableOpacity
                          onPress={() => setExpandedLogId(expandedLogId === item.id ? null : item.id)}
                          activeOpacity={0.7}
                        >
                          <Text 
                            style={[styles.historyNotes, { color: darkMode ? '#81D4FA' : '#2196F3' }]}
                            numberOfLines={expandedLogId === item.id ? undefined : 2}
                          >
                            Notes: {item.notes}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyHistory}>
                  <Text style={[styles.emptyHistoryText, { color: darkMode ? '#B0BEC5' : '#7C8B9A' }]}>
                    No activities logged yet
                  </Text>
                  <Text style={[styles.emptyHistorySubtext, { color: darkMode ? '#90A4AE' : '#A0A0A0' }]}>
                    Start tracking your baby's activities above
                  </Text>
                </View>
              )}
            </View>
          </View>

        </ScrollView>
      </Animated.View>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight + 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    marginBottom: 20,
  },
  headerButton: {
    borderRadius: 16,
    elevation: 5,
  },
  headerButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: 
  { width: 60, 
    height: 60, 
    resizeMode: 'contain' 
  },
  profileSection:
   { 
    alignItems: 
    'center', 
    marginBottom: 30 
  },
  title: 
  { fontSize: 28,
     fontWeight: '700',
      marginBottom: 20, 
      textAlign: 'center'
     },
  profileContainer: 
  { 
    position: 'relative'
   },
  profileGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 15,
  },
  profileImage: 
  { 
    width: 110,
    height: 110, 
    borderRadius: 55, 
    resizeMode: 'cover'
   },
  profileSparkle: 
  { 
    position: 'absolute', 
    top: 8, 
    right: 8 
  },
  scrollContent:
   { 
    paddingHorizontal: 25,
     paddingBottom: 30 
    },
  section: 
  { 
    marginBottom: 30
   },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionTitle: 
  { fontSize: 20, 
    fontWeight: '700'
   },
  historyBadge: 
  { 
    backgroundColor: '#81D4FA',
     borderRadius: 12,
      paddingHorizontal: 8,
       paddingVertical: 4
       },
  historyBadgeText:
   { color: '#fff', 
    fontSize: 12, 
    fontWeight: '600'
   },
  activitiesGrid: 
  { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  activityButton: 
  { 
    borderRadius: 24, 
    elevation: 8 
  },
  activityGradient: 
  {
     width: (width - 80) / 3,
      height: 100, 
     borderRadius: 24,
      alignItems: 'center', 
      justifyContent: 'center' 
    },
  activityIcon:
   { 
    width: 36, 
    height: 36, 
    marginBottom: 8, 
    tintColor: '#fff'
   },
  activityText: 
  { 
    fontSize: 13,
     fontWeight: '600', 
     color: '#fff', 
     textAlign: 'center' 
    },
  actionButtonsContainer:
   { flexDirection: 'row', 
    justifyContent: 'space-between',
     marginBottom: 20,
     flexWrap: 'wrap',
     },
  actionButton:
   { flex: 1, 
    marginHorizontal: 5, 
    borderRadius: 20, 
    elevation: 6,
    marginBottom: 10,
    minWidth: '48%',
  },
  actionButtonGradient:
   { flexDirection: 'row',
     alignItems: 'center', 
     justifyContent: 'center',
      paddingVertical: 14, 
      borderRadius: 20 
    },
  actionButtonText: 
  { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 15, 
    marginLeft: 8 
  },
  historyContainer: 
  { borderRadius: 24, 
    padding: 20, 
    elevation: 8 
  },
  historyItem: 
  { 
    flexDirection: 'row',
    alignItems: 'center', 
    paddingVertical: 12, 
    borderBottomWidth: 1,
     borderBottomColor: 'rgba(129, 212, 250, 0.1)' 
    },
  historyIconContainer: 
  { 
    marginRight: 15
   },
  historyIconGradient: 
  { width: 44, 
    height: 44,
     borderRadius: 22, 
     justifyContent: 'center',
      alignItems: 'center'
     },
  historyIcon:
   { 
    width: 24, 
    height: 24, 
    tintColor: '#fff'
   },
  historyContent: 
  { flex: 1 

  },
  historyText: 
  { 
    fontSize: 16,
    color: '#526475ff',
     fontWeight: '600' 
    },
  historyTime:
   { 
    fontSize: 13,
     color: '#7C8B9A', 
     fontWeight: '500' 
    },
  historySubtext: 
  { 
    fontSize: 12,
     color: '#A0A0A0',
      marginTop: 2 
    },
  emptyHistory:
   { 
    alignItems: 'center',
     paddingVertical: 30 
    },
  emptyHistoryText:
   { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#7C8B9A', 
    marginBottom: 5 },
  emptyHistorySubtext:
   { 
    fontSize: 14, 
    color: '#A0A0A0', 
    textAlign: 'center' 
  },
  infoButton: {
    position: 'absolute',
    bottom: 20,
    right: '35%',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  infoButtonGradient: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    borderRadius: 16,
    padding: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    marginVertical: 6,
    lineHeight: 22,
  },
  modalCloseBtn: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalCloseGradient: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  historyTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  historyActionButton: {
    padding: 4,
  },
  historyNotes: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  infoFab: {
      position: 'absolute',
      bottom: -6,   
      right: 12,         
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
      zIndex: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 5,
      elevation: 8,
  },
  infoFabGrad: { 
      flex: 1,
      width: '100%',
      height: '100%',
      borderRadius: 21,
      justifyContent: 'center',
      alignItems: 'center',
   },
  // Sheet
  sheetOverlay: { 
    flex: 1,
     justifyContent: 'flex-end',
     },
  blur: { ...StyleSheet.absoluteFillObject },
  sheet: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  handle: { 
    alignSelf: 'center', 
    width: 40, height: 4, 
    borderRadius: 2, 
    marginBottom: 12,
   },

  headerRow: { 
    flexDirection: 'row',
     alignItems: 'center',
     },
  avatarRing: { 
    width: 56, 
    height: 56,
     borderRadius: 28, 
     overflow: 'hidden',
     },
  avatarGrad: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
   },
  avatarImg: { 
    width: '100%',
     height: '100%',
     },
  name: { 
    fontSize: 20, 
    fontWeight: '800',
   },

  chipsRow: { 
    flexDirection: 'row', 
    gap: 8, 
    marginTop: 6, 
    flexWrap: 'wrap',
   },
  chip: { 
    flexDirection: 'row', 
    alignItems: 'center',
     gap: 6,
      paddingHorizontal: 10,
       paddingVertical: 6,
        borderRadius: 999,
       },
  chipText: { 
    fontSize: 13, 
    fontWeight: '700',
   },

  statsRow: { 
    flexDirection: 'row', 
    gap: 10, 
    marginTop: 16,
   },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
    gap: 4,
  },
  statLabel: { 
    fontSize: 12, 
    fontWeight: '700',
     textTransform: 'uppercase',
      letterSpacing: 0.4,
     },
  statValue: { 
    fontSize: 16,
     fontWeight: '800',
     },

  notesBox: { 
    marginTop: 14, 
    borderRadius: 14,
     borderWidth: 1,
      padding: 12 },
  notesLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    textTransform: 'uppercase',
     letterSpacing: 0.4,
      marginBottom: 6,
     },
  notesText: { 
    fontSize: 14, 
    lineHeight: 20 ,
  },

  closePill: { 
    padding: 8, 
    borderRadius: 999,
   },
  closeBtn: { 
    borderRadius: 14, 
    paddingVertical: 12, 
    alignItems: 'center',
   },
  closeText: { 
    color: '#fff', 
    fontWeight: '800', 
    letterSpacing: 0.3,
   },
   historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyDivider: {
    marginHorizontal: 6,
    fontSize: 12,
  },
  historyLogger: {
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  viewOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    gap: 10,
  },
  viewOnlyText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  permissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    marginBottom: 10,
  },
  permissionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  featuredSection: {
  marginBottom: 20,
},
featuredCard: {
  marginBottom: 12,
  borderRadius: 16,
  overflow: 'hidden',
  elevation: 6,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.25,
  shadowRadius: 5,
},
featuredGradient: {
  padding: 16,
},
featuredContent: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
featuredLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},
featuredIconContainer: {
  width: 52,
  height: 52,
  borderRadius: 26,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 14,
  elevation: 4,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 3,
},
featuredText: {
  flex: 1,
},
featuredTitle: {
  fontSize: 18,
  fontWeight: '700',
  marginBottom: 3,
  letterSpacing: 0.3,
},
featuredSubtitle: {
  fontSize: 13,
  fontWeight: '600',
  lineHeight: 18,
},
actionGridCard: {
  borderRadius: 24, 
  padding: 10,
  elevation: 8,
  marginBottom: 30, 
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 6,
},
actionButtonsContainerGrid: { 
  flexDirection: 'row', 
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  marginHorizontal: -5,
},
actionButtonGrid: {
  minWidth: '47%',
  marginHorizontal: 5,
  borderRadius: 20, 
  elevation: 0,
  marginBottom: 10,
},
});