import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert, Animated, Dimensions, Platform, StatusBar } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Bell, ArrowLeft, Settings, Sparkles, TrendingUp, Activity } from 'lucide-react-native';
import { app } from '../firebaseConfig';
import { useDarkMode } from '../screens/DarkMode';
import ThemedBackground from '../screens/ThemedBackground';

const { width } = Dimensions.get('window');
const db = getFirestore(app);

const darkModeGradients = {
  feeding: ['#00c6ff', '#0072ff'],
  diaper: ['#ff6a00', '#ee0979'],
  sleep: ['#8e2de2', '#4a00e0'],
  card: ['#1f1f1f', '#2c2c2c'],
  profile: ['#ff00cc', '#333399'],
};

export default function ChildDashboard() {
  const navigation = useNavigation();
  const route = useRoute();
  const { name, childId, image } = route.params || {};
  const { darkMode } = useDarkMode();

  const [history, setHistory] = useState([]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const profileScale = useRef(new Animated.Value(0.8)).current;
  const buttonScales = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(profileScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (!childId) {
        Alert.alert('Error', 'Child ID is missing. Please return to Home and try again.');
        navigation.goBack();
      } else {
        fetchChildData();
      }
    }, [childId])
  );

  const animateButton = (index) => {
    Animated.sequence([
      Animated.spring(buttonScales[index], {
        toValue: 0.95,
        useNativeDriver: true,
        duration: 100,
      }),
      Animated.spring(buttonScales[index], {
        toValue: 1,
        useNativeDriver: true,
        duration: 100,
      }),
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
      const diaperLogsQuery = query(
        collection(db, 'diaperLogs'),
        where('childId', '==', childId),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const diaperSnapshot = await getDocs(diaperLogsQuery);
      const diaperLogs = diaperSnapshot.docs.map((doc) => ({
        id: doc.id,
        type: 'Diaper Change',
        subtype: doc.data().stoolType,
        time: formatTime(doc.data().timestamp?.toDate()) || 'Unknown',
        timestamp: doc.data().timestamp?.toDate() || new Date(0),
      }));

      const feedingLogsQuery = query(
        collection(db, 'feedLogs'),
        where('childId', '==', childId),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const feedingSnapshot = await getDocs(feedingLogsQuery);
      const feedLogs = feedingSnapshot.docs.map((doc) => ({
        id: doc.id,
        type: 'Feeding',
        subtype: doc.data().feedType,
        time: formatTime(doc.data().timestamp?.toDate()) || 'Unknown',
        timestamp: doc.data().timestamp?.toDate() || new Date(0),
      }));

      const sleepLogsQuery = query(
        collection(db, 'sleepLogs'),
        where('childId', '==', childId),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const sleepSnapshot = await getDocs(sleepLogsQuery);
      const sleepLogs = sleepSnapshot.docs.map((doc) => ({
        id: doc.id,
        type: 'Sleep',
        subtype: formatDuration(doc.data().duration),
        time: formatTime(doc.data().timestamp?.toDate()) || 'Unknown',
        timestamp: doc.data().timestamp?.toDate() || new Date(0),
      }));

      const combinedLogs = [...diaperLogs, ...feedLogs, ...sleepLogs].sort(
        (a, b) => b.timestamp - a.timestamp
      );

      setHistory(combinedLogs.slice(0, 5));
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Unable to fetch data.');
    }
  };

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
      <StatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      <Animated.View
        style={[
          styles.innerContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={darkMode ? darkModeGradients.card : ['#fff', '#f5f5f5']}
              style={styles.headerButtonGradient}
            >
              <ArrowLeft size={20} color={darkMode ? '#fff' : '#2E3A59'} />
            </LinearGradient>
          </TouchableOpacity>

          <Image source={require('../assets/logo.png')} style={styles.logo} />

          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={darkMode ? darkModeGradients.card : ['#fff', '#f5f5f5']}
              style={styles.headerButtonGradient}
            >
              <Settings size={20} color={darkMode ? '#fff' : '#2E3A59'} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Profile */}
        <View style={styles.profileSection}>
          <Text style={[styles.title, { color: darkMode ? '#fff' : '#2E3A59' }]}>
            {name}'s Dashboard
          </Text>
          <Animated.View
            style={[styles.profileContainer, { transform: [{ scale: profileScale }] }]}
          >
            <LinearGradient
              colors={darkMode ? darkModeGradients.profile : ['#81D4FA', '#F8BBD9']}
              style={styles.profileGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {image ? (
                <Image source={{ uri: image }} style={styles.profileImage} />
              ) : (
                <Image
                  source={require('../assets/default-profile.png')}
                  style={styles.profileImage}
                />
              )}
            </LinearGradient>
            <View style={styles.profileSparkle}>
              <Sparkles size={16} color={darkMode ? '#ff80ff' : '#F8BBD9'} />
            </View>
          </Animated.View>
        </View>
       

        {/* Activities */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: darkMode ? '#fff' : '#2e3a59' }]}>
                Log Activities
              </Text>
              <Activity size={20} color={darkMode ? '#fff' : '#2E3A59'} strokeWidth={2} />
            </View>

            <View style={styles.activitiesGrid}>
              {activityButtons.map((activity, index) => (
                <Animated.View
                  key={activity.title}
                  style={{ transform: [{ scale: buttonScales[index] }] }}
                >
                  <TouchableOpacity
                    style={styles.activityButton}
                    onPress={activity.onPress}
                    activeOpacity={0.8}
                  >
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
          </View>

          {/* Reports + Reminders */}
          <View style={styles.actionButtonsContainer}>
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
                <Text style={styles.actionButtonText}>View Reports</Text>
              </LinearGradient>
            </TouchableOpacity>

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
          </View>
{/* Digest Button */} 
  <TouchableOpacity

  style={styles.actionButton}
  onPress={async () => {
    try {
      const NotificationService = (await import("../src/notifications/notificationService")).default;
      const res = await NotificationService.sendDigestNotificationForChild(childId);
      if (res) Alert.alert("Digest scheduled");
      else Alert.alert("No digest sent (throttled or no data)");
    } catch (e) {
      console.error(e);
      Alert.alert("Failed to send digest");
    }
  }}
  activeOpacity={0.8}
>
  <LinearGradient
    colors={darkMode ? ['#ff80ab', '#ff4081'] : ['#F8BBD9', '#F48FB1']}
    style={styles.actionButtonGradient}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
  >
    <Sparkles size={12} color="#fff" strokeWidth={2} />
    <Text style={styles.actionButtonText}>Send Digest Now</Text>
  </LinearGradient>
</TouchableOpacity>

          {/* History */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: darkMode ? '#fff' : '#2E3A59' }]}>
                Recent Activity
              </Text>
              <View style={styles.historyBadge}>
                <Text style={styles.historyBadgeText}>{history.length}</Text>
              </View>
            </View>

            <View
              style={[
                styles.historyContainer,
                { backgroundColor: darkMode ? '#1f1f1f' : '#fff' },
              ]}
            >
              {history.length > 0 ? (
                history.map((item, index) => (
                  <View key={index} style={styles.historyItem}>
                    <View style={styles.historyIconContainer}>
                      <LinearGradient
                        colors={
                          item.type === 'Feeding'
                            ? ['#81D4FA', '#B39DDB']
                            : item.type === 'Diaper Change'
                            ? ['#F8BBD9', '#FFB74D']
                            : ['#A5D6A7', '#81D4FA']
                        }
                        style={styles.historyIconGradient}
                      >
                        <Image source={getActivityIcon(item.type)} style={styles.historyIcon} />
                      </LinearGradient>
                    </View>
                    <View style={styles.historyContent}>
                      <Text style={styles.historyText}>{item.type}</Text>
                      <Text style={styles.historyTime}>{item.time}</Text>
                      {item.subtype && <Text style={styles.historySubtext}>{item.subtype}</Text>}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyHistory}>
                  <Text style={styles.emptyHistoryText}>No activities logged yet</Text>
                  <Text style={styles.emptyHistorySubtext}>
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
  logo: { width: 50, height: 50, resizeMode: 'contain' },
  profileSection: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  profileContainer: { position: 'relative' },
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
     width: (width - 80) / 3, height: 100, 
     borderRadius: 24,
      alignItems: 'center', 
      justifyContent: 'center' 
    },
  activityIcon:
   { width: 36, 
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
     marginBottom: 30
     },
  actionButton:
   { flex: 1, 
    marginHorizontal: 5, 
    borderRadius: 20, 
    elevation: 6 
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
     fontWeight: '600' 
    },
  historyTime:
   { 
    fontSize: 13,
     color: '#7C8B9A', fontWeight: '500' 
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
});