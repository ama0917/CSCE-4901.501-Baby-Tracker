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
  doc,            // for permission snapshot
  onSnapshot,     // for permission snapshot
} from 'firebase/firestore';
import { Bell, ArrowLeft, Settings, Sparkles, TrendingUp, Activity, Image as ImageIcon, Calendar, Edit2, Trash2 } from 'lucide-react-native';
import { app } from '../firebaseConfig';
import { useDarkMode } from '../screens/DarkMode';
import ThemedBackground from '../screens/ThemedBackground';
import useUserRole from './useUserRole';       
import { getAuth } from 'firebase/auth'; 
import { Info } from 'lucide-react-native';
import { Modal } from 'react-native';      

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

  const { role } = useUserRole();                  
  const isCaregiver = role === 'caregiver';        
  const uid = getAuth().currentUser?.uid;          
  const [canView, setCanView] = useState(true);    
  const [isOwner, setIsOwner] = useState(false);   
  const [canLog, setCanLog] = useState(true);      // parents true, caregivers gated

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
    if (!childId || !uid) { setCanView(false); setIsOwner(false); setCanLog(false); return; }

    const ref = doc(db, 'children', childId);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      setChildInfo({
        name: data.firstName ? `${data.firstName} ${data.lastName || ''}`.trim() : name,
        birthDate: data.birthDate || null,
        notes: data.notes || '',});
      const owner = data?.userId === uid;
      const val = data?.caregiverPerms?.[uid]; // 'on' | 'log' | undefined
      setIsOwner(owner);
      setCanView(owner || val === 'on' || val === 'log');
      setCanLog(owner || val === 'on' || val === 'log');
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
        // double-check caregiver canLog on focus (defensive)
        if (isCaregiver && uid) {
          (async () => {
            try {
              const snap = await getDocs(query(collection(db, 'children'), where('__name__', '==', childId)));
              const d = snap.docs[0];
              if (d) {
                const data = d.data() || {};
                const perms = (data.caregiverPerms || {})[uid];
                setCanLog(perms === 'on' || perms === 'log');
              }
            } catch (e) {
              console.log('perm check error', e);
              setCanLog(false);
            }
          })();
        }
      }
    }, [childId, isCaregiver, uid]) // include deps used above
  );

  const animateButton = (index) => {
    Animated.sequence([
      Animated.spring(buttonScales[index], { toValue: 0.95, useNativeDriver: true, duration: 100 }),
      Animated.spring(buttonScales[index], { toValue: 1, useNativeDriver: true, duration: 100 }),
    ]).start();
  };

  const formatTime = (timestamp) => {
    const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    return new Date(timestamp).toLocaleTimeString([], options);
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours > 0 ? `${hours} hr` : ''} ${mins} min`;
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

      const combinedLogs = [...diaperLogs, ...feedLogs, ...sleepLogs].sort((a, b) => b.timestamp - a.timestamp);
      setHistory(combinedLogs.slice(0, 5));
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Unable to fetch data.');
    }
  };

  const canModifyLog = (log) => {
    // Parents can modify all logs
    if (isOwner) return true;
    // Caregivers can only modify their own logs
    return log.createdBy === uid;
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
              fetchChildData(); // Refresh
            } catch (error) {
              console.error('Error deleting log:', error);
              Alert.alert('Error', 'Failed to delete log');
            }
          }
        }
      ]
    );
  };

  const handleEditLog = (log) => {
    if (!canModifyLog(log)) {
      Alert.alert('Permission Denied', 'You can only edit logs you created.');
      return;
    }

    // Navigate to appropriate form
    switch (log.collection) {
      case 'feedLogs':
        navigation.navigate('FeedingForm', { childId, name, editingLogId: log.id });
        break;
      case 'diaperLogs':
        navigation.navigate('DiaperChangeForm', { childId, name, editingLogId: log.id });
        break;
      case 'sleepLogs':
        navigation.navigate('SleepingForm', { childId, name, editingLogId: log.id });
        break;
    }
  };

  if (!canView) {
    // early return that matches app styling, minimal/no ripple to their UI
    return (
      <LinearGradient colors={['#E3F2FD', '#FFFFFF']} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ margin: 20, backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
          <Text style={{ color: '#2E3A59', marginBottom: 12 }}>Access is turned off by the parent.</Text>
          <TouchableOpacity
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
            style={{ padding: 12, backgroundColor: '#CFD8DC', borderRadius: 10, alignItems: 'center' }}
          >
            <Text style={{ color: '#2E3A59', fontWeight: '700' }}>Back</Text>
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
            style={styles.infoButton}
            onPress={() => setInfoVisible(true)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={darkMode ? ['#2a2a2a', '#444'] : ['#e0f7fa', '#b2ebf2']}
              style={styles.infoButtonGradient}
            >
              <Info size={18} color={darkMode ? '#fff' : '#2E3A59'} />
            </LinearGradient>
          </TouchableOpacity>

          <Modal
            visible={infoVisible}
            animationType="slide"
            transparent
            onRequestClose={() => setInfoVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContainer, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
                <Text style={[styles.modalTitle, { color: darkMode ? '#fff' : '#2E3A59' }]}>
                  {childInfo?.name || name}
                </Text>

                {childInfo?.birthDate && (
                  <Text style={[styles.modalText, { color: darkMode ? '#ccc' : '#555' }]}>
                    Birthday:{' '}
                    {(() => {
                      const b = childInfo.birthDate;
                      if (!b) return 'Unknown';

                      if (b.toDate) return b.toDate().toLocaleDateString(); // Firestore Timestamp
                      const parsed = new Date(b);
                      return isNaN(parsed) ? 'Unknown' : parsed.toLocaleDateString();
                    })()}
                  </Text>
                )}

                <Text style={[styles.modalText, { color: darkMode ? '#ccc' : '#555' }]}>
                  Notes: {childInfo?.notes ? childInfo.notes : 'No notes available.'}
                </Text>

                <TouchableOpacity
                  onPress={() => setInfoVisible(false)}
                  style={styles.modalCloseBtn}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={darkMode ? ['#444', '#666'] : ['#81D4FA', '#B39DDB']}
                    style={styles.modalCloseGradient}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Close</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>

        {/* Activities */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View className="section" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: darkMode ? '#fff' : '#2e3a59' }]}>Log Activities</Text>
              <Activity size={20} color={darkMode ? '#fff' : '#2E3A59'} strokeWidth={2} />
            </View>

            {/* Only show activity logging buttons if owner or caregiver with logging permission */}
            {(isOwner || canLog) ? (
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
              // view-only message for caregivers without logging perms
              <View style={{ padding: 12, backgroundColor: '#FFF9B0', borderRadius: 10, marginBottom: 10 }}>
                <Text style={{ color: '#2E3A59' }}>View-only access. Ask the parent for logging permission.</Text>
              </View>
            )}
          </View>

          {/* Reports + Reminders + Memories + Calendar */}
          <View style={styles.actionButtonsContainer}>
            {/* Only show Reports button if user is the child's parent (owner) */}
            {isOwner && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('ReportsScreen', { childId, name })}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={darkMode ? ['#00c6ff', '#0072ff'] : ['#90CAF9', '#81D4FA']}
                  style={styles.actionButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <TrendingUp size={18} color="#fff" strokeWidth={2} />
                  <Text style={styles.actionButtonText}>Reports</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Reminders button - available to both parents and caregivers with access */}
            <TouchableOpacity
              style={styles.actionButton}
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

            {/* Memories button - only for parents */}
            {/* {isOwner && (
              <TouchableOpacity
                style={styles.actionButton}
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
            )} */}

            {/* Calendar button - only for parents */}
            {/* {isOwner && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('CalendarScreen', { childId, name })}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={darkMode ? ['#8e2de2', '#4a00e0'] : ['#A5D6A7', '#81D4FA']}
                  style={styles.actionButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Calendar size={18} color="#fff" strokeWidth={2} />
                  <Text style={styles.actionButtonText}>Calendar</Text>
                </LinearGradient>
              </TouchableOpacity>
            )} */}
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
                      
                      <Text style={[styles.historyTime, { color: darkMode ? '#B0BEC5' : '#7C8B9A' }]}>
                        {item.time}
                      </Text>
                      
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
  { width: 50, 
    height: 50, 
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
    bottom: 8,
    right: 8,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
  },
  infoButtonGradient: {
    padding: 10,
    borderRadius: 20,
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
});