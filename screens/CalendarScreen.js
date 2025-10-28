import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar } from 'react-native-calendars';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { ArrowLeft, TrendingUp } from 'lucide-react-native';
import { app } from '../firebaseConfig';
import { useDarkMode } from '../screens/DarkMode';
import ThemedBackground from '../screens/ThemedBackground';

const db = getFirestore(app);

export default function CalendarScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { childId, name } = route.params || {};
  const { darkMode } = useDarkMode();

  const [selectedDate, setSelectedDate] = useState('');
  const [markedDates, setMarkedDates] = useState({});
  const [dayLogs, setDayLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDay, setIsLoadingDay] = useState(false);

  useEffect(() => {
    if (!childId) {
      Alert.alert('Error', 'Child ID is missing');
      navigation.goBack();
      return;
    }
    loadCalendarData();
  }, [childId]);

  const loadCalendarData = async () => {
    try {
      setIsLoading(true);
      
      // Get all logs for the year to mark calendar
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      const endOfYear = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);

      const collections = ['feedLogs', 'diaperLogs', 'sleepLogs'];
      const marked = {};

      for (const collectionName of collections) {
        const q = query(
          collection(db, collectionName),
          where('childId', '==', childId),
          where('timestamp', '>=', Timestamp.fromDate(startOfYear)),
          where('timestamp', '<=', Timestamp.fromDate(endOfYear))
        );

        const snapshot = await getDocs(q);
        snapshot.forEach((doc) => {
          const data = doc.data();
          const timestamp = data.timestamp?.toDate();
          if (timestamp) {
            const dateStr = timestamp.toISOString().split('T')[0];
            if (!marked[dateStr]) {
              marked[dateStr] = { marked: true, dotColor: '#81D4FA' };
            }
          }
        });
      }

      setMarkedDates(marked);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      Alert.alert('Error', 'Failed to load calendar data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDayLogs = async (date) => {
    try {
      setIsLoadingDay(true);
      
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const allLogs = [];

      // Fetch feeding logs
      const feedQuery = query(
        collection(db, 'feedLogs'),
        where('childId', '==', childId),
        where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
        where('timestamp', '<=', Timestamp.fromDate(endOfDay))
      );
      const feedSnapshot = await getDocs(feedQuery);
      feedSnapshot.forEach((doc) => {
        const data = doc.data();
        allLogs.push({
          id: doc.id,
          type: 'Feeding',
          subtype: data.feedType,
          amount: data.amount ? `${data.amount} ${data.amountUnit || ''}` : '',
          notes: data.notes || '',
          time: data.timestamp?.toDate(),
        });
      });

      // Fetch diaper logs
      const diaperQuery = query(
        collection(db, 'diaperLogs'),
        where('childId', '==', childId),
        where('time', '>=', Timestamp.fromDate(startOfDay)),
        where('time', '<=', Timestamp.fromDate(endOfDay))
      );
      const diaperSnapshot = await getDocs(diaperQuery);
      diaperSnapshot.forEach((doc) => {
        const data = doc.data();
        allLogs.push({
          id: doc.id,
          type: 'Diaper Change',
          subtype: data.stoolType,
          time: data.time?.toDate(),
        });
      });

      // Fetch sleep logs
      const sleepQuery = query(
        collection(db, 'sleepLogs'),
        where('childId', '==', childId),
        where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
        where('timestamp', '<=', Timestamp.fromDate(endOfDay))
      );
      const sleepSnapshot = await getDocs(sleepQuery);
      sleepSnapshot.forEach((doc) => {
        const data = doc.data();
        const duration = data.duration;
        const hours = Math.floor(duration / 60);
        const mins = duration % 60;
        allLogs.push({
          id: doc.id,
          type: 'Sleep',
          subtype: data.sleepType,
          duration: `${hours > 0 ? `${hours}h ` : ''}${mins}m`,
          incomplete: data.incomplete || false,
          time: data.timestamp?.toDate(),
        });
      });

      // Sort by time
      allLogs.sort((a, b) => a.time - b.time);
      setDayLogs(allLogs);
    } catch (error) {
      console.error('Error loading day logs:', error);
      Alert.alert('Error', 'Failed to load logs for this day');
    } finally {
      setIsLoadingDay(false);
    }
  };

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
    
    // Update marked dates to highlight selected
    const updatedMarked = { ...markedDates };
    Object.keys(updatedMarked).forEach(key => {
      updatedMarked[key] = { ...updatedMarked[key], selected: false };
    });
    updatedMarked[day.dateString] = {
      ...updatedMarked[day.dateString],
      selected: true,
      selectedColor: darkMode ? '#0072ff' : '#81D4FA',
    };
    setMarkedDates(updatedMarked);
    
    loadDayLogs(day.dateString);
  };

  const formatTime = (date) => {
    if (!date) return 'Unknown';
    const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    return date.toLocaleTimeString([], options);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <ThemedBackground>
      <StatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={darkMode ? ['#1f1f1f', '#2c2c2c'] : ['#fff', '#f5f5f5']}
              style={styles.headerButtonGradient}
            >
              <ArrowLeft size={20} color={darkMode ? '#fff' : '#2E3A59'} />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.title, { color: darkMode ? '#fff' : '#2E3A59' }]}>
            {name}'s Calendar
          </Text>

          <View style={{ width: 44 }} />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={darkMode ? '#fff' : '#2E3A59'} />
          </View>
        ) : (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Calendar */}
            <View style={styles.calendarContainer}>
              <Calendar
                markedDates={markedDates}
                onDayPress={handleDayPress}
                theme={{
                  calendarBackground: darkMode ? '#1f1f1f' : '#fff',
                  textSectionTitleColor: darkMode ? '#B0BEC5' : '#2E3A59',
                  selectedDayBackgroundColor: darkMode ? '#0072ff' : '#81D4FA',
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: darkMode ? '#00c6ff' : '#2196F3',
                  dayTextColor: darkMode ? '#fff' : '#2E3A59',
                  textDisabledColor: darkMode ? '#555' : '#d9e1e8',
                  dotColor: '#81D4FA',
                  selectedDotColor: '#ffffff',
                  arrowColor: darkMode ? '#fff' : '#2E3A59',
                  monthTextColor: darkMode ? '#fff' : '#2E3A59',
                  textDayFontWeight: '500',
                  textMonthFontWeight: 'bold',
                  textDayHeaderFontWeight: '600',
                  textDayFontSize: 16,
                  textMonthFontSize: 18,
                  textDayHeaderFontSize: 14,
                }}
              />
            </View>

            {/* Selected Day Logs */}
            {selectedDate && (
              <View style={[styles.logsContainer, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
                <Text style={[styles.logsTitle, { color: darkMode ? '#fff' : '#2E3A59' }]}>
                  {formatDate(selectedDate)}
                </Text>

                {isLoadingDay ? (
                  <ActivityIndicator size="small" color={darkMode ? '#fff' : '#2E3A59'} style={{ marginVertical: 20 }} />
                ) : dayLogs.length > 0 ? (
                  dayLogs.map((log, index) => (
                    <View key={index} style={[styles.logItem, { borderBottomColor: darkMode ? '#333' : '#E0E0E0' }]}>
                      <View style={styles.logIconContainer}>
                        <LinearGradient
                          colors={
                            log.type === 'Feeding'
                              ? ['#81D4FA', '#B39DDB']
                              : log.type === 'Diaper Change'
                              ? ['#F8BBD9', '#FFB74D']
                              : ['#A5D6A7', '#81D4FA']
                          }
                          style={styles.logIconGradient}
                        >
                          <Text style={styles.logIcon}>
                            {log.type === 'Feeding' ? '🍼' : log.type === 'Diaper Change' ? '👶' : '😴'}
                          </Text>
                        </LinearGradient>
                      </View>

                      <View style={styles.logContent}>
                        <Text style={[styles.logType, { color: darkMode ? '#fff' : '#2E3A59' }]}>
                          {log.type}
                        </Text>
                        <Text style={[styles.logTime, { color: darkMode ? '#B0BEC5' : '#7C8B9A' }]}>
                          {formatTime(log.time)}
                        </Text>
                        {log.subtype && (
                          <Text style={[styles.logSubtext, { color: darkMode ? '#90A4AE' : '#A0A0A0' }]}>
                            {log.incomplete && '⏰ Still sleeping'}
                            {!log.incomplete && log.subtype}
                          </Text>
                        )}
                        {log.duration && !log.incomplete && (
                          <Text style={[styles.logSubtext, { color: darkMode ? '#90A4AE' : '#A0A0A0' }]}>
                            Duration: {log.duration}
                          </Text>
                        )}
                        {log.amount && (
                          <Text style={[styles.logSubtext, { color: darkMode ? '#90A4AE' : '#A0A0A0' }]}>
                            Amount: {log.amount}
                          </Text>
                        )}
                        {log.notes && (
                          <Text style={[styles.logNotes, { color: darkMode ? '#81D4FA' : '#2196F3' }]}>
                            📝 {log.notes}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.noLogsText, { color: darkMode ? '#B0BEC5' : '#7C8B9A' }]}>
                    No activities logged on this day
                  </Text>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  calendarContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 5,
  },
  logsContainer: {
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  logsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  logItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  logIconContainer: {
    marginRight: 12,
  },
  logIconGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logIcon: {
    fontSize: 20,
  },
  logContent: {
    flex: 1,
  },
  logType: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  logTime: {
    fontSize: 13,
    marginBottom: 4,
  },
    logSubtext: {
        fontSize: 12,
        marginTop: 2,
    },
    logNotes: {
        fontSize: 12,
        marginTop: 4,
        fontStyle: 'italic',
        lineHeight: 16,
    },
    noLogsText: {
        fontSize: 14,
        textAlign: 'center',
        marginVertical: 20,
    },
});