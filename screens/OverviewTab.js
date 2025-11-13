import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { app } from '../firebaseConfig';

const db = getFirestore(app);

const OverviewTab = ({ 
  childId, 
  name, 
  darkMode, 
  theme,
  sleepData,
  feedingData,
  diaperData,
  childData,
  AIPoweredSummary 
}) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [markedDates, setMarkedDates] = useState({});
  const [dayLogs, setDayLogs] = useState([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [aiInsightRange, setAiInsightRange] = useState('Weekly');
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [displayedLogsCount, setDisplayedLogsCount] = useState(10);

  useEffect(() => {
    if (childId) {
      loadCalendarData();
    }
  }, [childId]);

  const loadCalendarData = async () => {
    try {
      setIsLoadingCalendar(true);
      
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
          const timestamp = data.timestamp?.toDate() || data.time?.toDate();
          if (timestamp) {
            const dateStr = timestamp.toISOString().split('T')[0];
            if (!marked[dateStr]) {
              marked[dateStr] = { marked: true, dotColor: darkMode ? '#64b5f6' : '#81D4FA' };
            }
          }
        });
      }

      setMarkedDates(marked);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      Alert.alert('Error', 'Failed to load calendar data');
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const loadDayLogs = async (date, loadMore = false) => {
    try {
      if (!loadMore) {
        setIsLoadingDay(true);
        setDisplayedLogsCount(10);
      }
      
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
        where('timestamp', '<=', Timestamp.fromDate(endOfDay)),
        orderBy('timestamp', 'desc')
      );
      const feedSnapshot = await getDocs(feedQuery);
      feedSnapshot.forEach((doc) => {
        const data = doc.data();
        allLogs.push({
          id: doc.id,
          type: 'Feeding',
          icon: require('../assets/bottle.png'),
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
        where('time', '<=', Timestamp.fromDate(endOfDay)),
        orderBy('time', 'desc')
      );
      const diaperSnapshot = await getDocs(diaperQuery);
      diaperSnapshot.forEach((doc) => {
        const data = doc.data();
        allLogs.push({
          id: doc.id,
          type: 'Diaper Change',
          icon: require('../assets/diaper.png'),
          subtype: data.stoolType,
          time: data.time?.toDate(),
        });
      });

      // Fetch sleep logs
      const sleepQuery = query(
        collection(db, 'sleepLogs'),
        where('childId', '==', childId),
        where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
        where('timestamp', '<=', Timestamp.fromDate(endOfDay)),
        orderBy('timestamp', 'desc')
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
          icon: require('../assets/sleep.png'),
          subtype: data.sleepType,
          duration: `${hours > 0 ? `${hours}h ` : ''}${mins}m`,
          incomplete: data.incomplete || false,
          time: data.timestamp?.toDate(),
        });
      });

      // Sort by time (most recent first)
      allLogs.sort((a, b) => b.time - a.time);
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
    setDisplayedLogsCount(10);
    
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

  const handleLoadMore = () => {
    setDisplayedLogsCount(prev => prev + 10);
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

  const getActivityGradient = (type) => {
    if (type === 'Feeding') {
      return darkMode ? ['#00c6ff', '#0072ff'] : ['#81D4FA', '#B39DDB'];
    } else if (type === 'Diaper Change') {
      return darkMode ? ['#ff6a00', '#ee0979'] : ['#F8BBD9', '#FFB74D'];
    } else {
      return darkMode ? ['#8e2de2', '#4a00e0'] : ['#A5D6A7', '#81D4FA'];
    }
  };

  const displayedLogs = dayLogs.slice(0, displayedLogsCount);
  const hasMoreLogs = displayedLogsCount < dayLogs.length;

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    >
      {/* AI Insights Section - Streamlined */}
      <View style={[
        styles.aiInsightsSection,
        { 
          backgroundColor: darkMode ? '#1f1f1f' : '#fff',
          borderColor: darkMode ? '#333' : '#e0e0e0'
        }
      ]}>
        <View style={styles.aiInsightsHeader}>
          <View style={styles.aiInsightsHeaderLeft}>
            <Ionicons name="sparkles" size={20} color="#1976d2" />
            <Text style={[styles.aiInsightsTitle, { color: theme.textPrimary }]}>
              AI Insights
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.rangeSelector,
              { 
                backgroundColor: darkMode ? '#2c2c2c' : '#f0f0f0',
                borderColor: darkMode ? '#404040' : '#e0e0e0'
              }
            ]}
            onPress={() => setShowRangeModal(true)}
          >
            <Text style={[styles.rangeSelectorText, { color: theme.textPrimary }]}>
              {aiInsightRange}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        {childId && childData && (
          <AIPoweredSummary 
            childId={childId} 
            childAge={childData.age} 
            childWeight={childData.weight} 
            childHeight={childData.height}
            sleepData={sleepData || []}
            feedingData={feedingData || []}
            diaperData={diaperData || []}
            reportRange={aiInsightRange}
            activeTab="Overall"
            darkMode={darkMode}
            theme={theme}
            isOverviewMode={true}
          />
        )}
      </View>

      {/* Range Selection Modal */}
      <Modal
        visible={showRangeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRangeModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRangeModal(false)}
        >
          <View style={[
            styles.modalContent,
            { backgroundColor: darkMode ? '#2c2c2c' : '#fff' }
          ]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Select Time Range
            </Text>
            {['Weekly', 'Monthly', 'Annual'].map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.modalOption,
                  aiInsightRange === range && styles.modalOptionSelected,
                  { borderBottomColor: darkMode ? '#404040' : '#e0e0e0' }
                ]}
                onPress={() => {
                  setAiInsightRange(range);
                  setShowRangeModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  { color: theme.textPrimary },
                  aiInsightRange === range && { color: '#1976d2', fontWeight: '600' }
                ]}>
                  {range}
                </Text>
                {aiInsightRange === range && (
                  <Ionicons name="checkmark" size={20} color="#1976d2" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Calendar Section */}
      <View style={[
        styles.calendarSection,
        { 
          backgroundColor: darkMode ? '#1f1f1f' : '#fff',
          borderColor: darkMode ? '#333' : '#e0e0e0'
        }
      ]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar" size={20} color={darkMode ? '#64b5f6' : '#1976d2'} />
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Activity Calendar
          </Text>
        </View>

        {isLoadingCalendar ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={darkMode ? '#64b5f6' : '#1976d2'} />
          </View>
        ) : (
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
              dotColor: darkMode ? '#64b5f6' : '#81D4FA',
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
        )}
      </View>

      {/* Selected Day Logs */}
      {selectedDate && (
        <View style={[
          styles.logsSection,
          { 
            backgroundColor: darkMode ? '#1f1f1f' : '#fff',
            borderColor: darkMode ? '#333' : '#e0e0e0'
          }
        ]}>
          <Text style={[styles.logsTitle, { color: theme.textPrimary }]}>
            {formatDate(selectedDate)}
          </Text>

          {isLoadingDay ? (
            <ActivityIndicator 
              size="small" 
              color={darkMode ? '#64b5f6' : '#1976d2'} 
              style={{ marginVertical: 20 }} 
            />
          ) : displayedLogs.length > 0 ? (
            <>
              {displayedLogs.map((log, index) => (
                <View 
                  key={`${log.id}-${index}`} 
                  style={[
                    styles.logItem,
                    { borderBottomColor: darkMode ? '#333' : '#E0E0E0' }
                  ]}
                >
                  <View style={styles.logIconContainer}>
                    <LinearGradient
                      colors={getActivityGradient(log.type)}
                      style={styles.logIconGradient}
                    >
                      <Image source={log.icon} style={styles.logIcon} />
                    </LinearGradient>
                  </View>

                  <View style={styles.logContent}>
                    <Text style={[styles.logType, { color: theme.textPrimary }]}>
                      {log.type}
                    </Text>
                    <Text style={[styles.logTime, { color: theme.textSecondary }]}>
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
                      <TouchableOpacity
                        onPress={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                        activeOpacity={0.7}
                      >
                        <Text 
                          style={[
                            styles.logNotes, 
                            { color: darkMode ? '#81D4FA' : '#2196F3' }
                          ]}
                          numberOfLines={expandedLogId === log.id ? undefined : 2}
                        >
                          📝 {log.notes}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}

              {hasMoreLogs && (
                <TouchableOpacity 
                  style={[
                    styles.loadMoreButton,
                    { backgroundColor: darkMode ? '#2c2c2c' : '#f0f0f0' }
                  ]}
                  onPress={handleLoadMore}
                >
                  <Text style={[styles.loadMoreText, { color: theme.textPrimary }]}>
                    Load More ({dayLogs.length - displayedLogsCount} remaining)
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.noLogsContainer}>
              <Ionicons name="calendar-outline" size={40} color={darkMode ? '#555' : '#ccc'} />
              <Text style={[styles.noLogsText, { color: theme.textSecondary }]}>
                No activities logged on this day
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 30,
  },
  aiInsightsSection: {
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
  },
  aiInsightsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  aiInsightsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiInsightsTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  rangeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    minWidth: 100,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  rangeSelectorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxWidth: 300,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(25, 118, 210, 0.1)',
  },
  modalOptionText: {
    fontSize: 16,
  },
  calendarSection: {
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logsSection: {
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
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
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  noLogsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  noLogsText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default OverviewTab;