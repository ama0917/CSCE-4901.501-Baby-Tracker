import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  Alert, 
  Switch, 
  Platform,
  TextInput,
  Modal,
  ActivityIndicator 
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getAuth } from 'firebase/auth';
import OpenAI from 'openai';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('⚠️ OpenAI API key not found. AI features will use fallback analysis.');
}

const formatTime12Hour = (time24) => {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

const getNextReminderTime = (times) => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  
  // Convert times to minutes and find next one
  const timesInMinutes = times.map(time => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }).sort((a, b) => a - b);
  
  // Find the next time
  const nextTime = timesInMinutes.find(time => time > currentTimeInMinutes);
  
  if (nextTime) {
    const hoursUntil = Math.floor((nextTime - currentTimeInMinutes) / 60);
    const minutesUntil = (nextTime - currentTimeInMinutes) % 60;
    return { hours: hoursUntil, minutes: minutesUntil, isToday: true };
  } else {
    // Next reminder is tomorrow (first time of the day)
    const tomorrowTime = timesInMinutes[0];
    const minutesUntilMidnight = (24 * 60) - currentTimeInMinutes;
    const totalMinutes = minutesUntilMidnight + tomorrowTime;
    const hoursUntil = Math.floor(totalMinutes / 60);
    const minutesUntil = totalMinutes % 60;
    return { hours: hoursUntil, minutes: minutesUntil, isToday: false };
  }
};

const formatNextReminderTime = (hours, minutes) => {
  if (hours === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (minutes === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else {
    return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min`;
  }
};

const convertTo24Hour = (time12) => {
  const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return time12;
  
  let [, hours, minutes, period] = match;
  hours = parseInt(hours);
  minutes = parseInt(minutes);
  
  if (period.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const getConfidenceColor = (confidence) => {
  switch (confidence) {
    case 'high': return '#4CAF50';
    case 'medium': return '#FF9800';
    case 'low': return '#F44336';
    default: return '#9E9E9E';
  }
};

const ReminderCard = ({ reminder, type, reminders, setReminders, toggleReminder, toggleAI, sendImmediateReminder, openTimePicker, aiConsent, aiLoading, reminderTypes, darkMode, theme }) => {
  const currentReminder = reminders[type];
  const [showInsights, setShowInsights] = useState(false);
  
  return (
    <View style={[styles.reminderCard, { backgroundColor: darkMode ? '#2c2c2c' : '#fff' }]}>
      <View style={[styles.reminderHeader, { borderTopColor: darkMode ? '#444' : '#F0F0F0' }]}>
        <View style={styles.reminderTitleRow}>
          <View style={[styles.iconContainer, { backgroundColor: reminder.color + '20' }]}>
            <MaterialCommunityIcons name={reminder.icon} size={24} color={reminder.color} />
          </View>
          <View style={styles.reminderInfo}>
          <Text style={[styles.reminderTitle, { color: theme.textPrimary }]}>{reminder.title}</Text>
          <Text style={[styles.reminderDescription, { color: theme.textSecondary }]}>{reminder.description}</Text>
            {currentReminder.enabled && (
              <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: reminder.color }]} />
                <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                  {currentReminder.useAI ? 'AI-Optimized' : 'Manual Schedule'}
                </Text>
              </View>
            )}
          </View>
        <Switch
          value={currentReminder.enabled}
          onValueChange={() => toggleReminder(type)}
          trackColor={{ false: '#D0D0D0', true: reminder.color }}
          thumbColor={currentReminder.enabled ? '#FFFFFF' : '#F4F4F4'}
          ios_backgroundColor="#D0D0D0"
        />
        </View>
      </View>

      {currentReminder.enabled && (
        <View style={styles.reminderSettings}>
          {/* Quick Actions Row */}
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: reminder.color + '20' }]}
              onPress={() => sendImmediateReminder(type)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="send" size={16} color={reminder.color} />
              <Text style={[styles.quickActionText, { color: reminder.color }]}>
                Send Now
              </Text>
            </TouchableOpacity>

            {currentReminder.useAI && currentReminder.aiRecommendedTimes && (
            <TouchableOpacity
              style={[
                styles.insightsButton,
                { backgroundColor: darkMode ? '#3D3528' : '#FFF3E0' }
              ]}
              onPress={() => setShowInsights(!showInsights)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons 
                name={showInsights ? "chevron-up" : "lightbulb-outline"} 
                size={16} 
                color={darkMode ? '#FFB74D' : '#FF9800'}
              />
              <Text style={[
                styles.insightsButtonText,
                { color: darkMode ? '#FFB74D' : '#FF9800' }
              ]}>
                {showInsights ? 'Hide' : 'Insights'}
              </Text>
            </TouchableOpacity>
            )}
          </View>

          {/* Settings Toggles */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <MaterialCommunityIcons name="clock-outline" size={20} color="#666" />
              <View style={styles.settingLabelContainer}>
                <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Manual Time Setting</Text>
                <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>Set specific reminder times</Text>
              </View>
            </View>
            <Switch
              value={!currentReminder.useAI}
              onValueChange={() => {
                if (currentReminder.useAI) {
                  toggleAI(type);
                }
              }}
              trackColor={{ false: '#D0D0D0', true: '#66BB6A' }}
              thumbColor={!currentReminder.useAI ? '#FFFFFF' : '#F4F4F4'}
              ios_backgroundColor="#D0D0D0"
              disabled={!aiConsent || aiLoading}
            />
          </View>

          {currentReminder.useAI && currentReminder.enabled && (
            <View style={[
              styles.aiInfoNote,
              { backgroundColor: darkMode ? '#3D3528' : '#FFF8E1' }
            ]}>
              <MaterialCommunityIcons name="information-outline" size={14} color={darkMode ? '#FFB74D' : '#FF9800'} />
              <Text style={[
                styles.aiInfoNoteText,
                { color: darkMode ? '#FFB74D' : '#F57C00' }
              ]}>
                AI times are loaded. Click "Send Now" to test or "Save" to schedule.
              </Text>
            </View>
          )}

          {!currentReminder.useAI && currentReminder.customTimes && (
            <View style={styles.manualTimesSection}>
              <View style={styles.manualTimesSectionHeader}>
                <MaterialCommunityIcons name="clock" size={16} color="#666" />
                <Text style={[styles.sectionHeaderText, { color: theme.textPrimary }]}>Reminder Times:</Text>
              </View>
              {currentReminder.customTimes.map((time, index) => (
                <View key={index} style={[
                  styles.manualTimeContainer,
                  { backgroundColor: darkMode ? '#383838' : '#F8F9FA' }
                ]}>
                  <Text style={[styles.timeText, { color: theme.textPrimary }]}>{formatTime12Hour(time)}</Text>
                  <View style={styles.timeActions}>
                    <TouchableOpacity 
                      style={styles.editTimeButton}
                      onPress={() => openTimePicker(type, index, time)}
                    >
                      <MaterialCommunityIcons name="pencil" size={14} color="#FFF" />
                    </TouchableOpacity>
                    {currentReminder.customTimes.length > 1 && (
                      <TouchableOpacity 
                        style={styles.deleteTimeButton}
                        onPress={() => {
                          const newTimes = currentReminder.customTimes.filter((_, i) => i !== index);
                          setReminders(prev => ({
                            ...prev,
                            [type]: {
                              ...prev[type],
                              customTimes: newTimes
                            }
                          }));
                        }}
                      >
                        <MaterialCommunityIcons name="close" size={14} color="#FFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              <TouchableOpacity 
                style={styles.addTimeButton}
                onPress={() => {
                  const newTimes = [...currentReminder.customTimes, '12:00'];
                  setReminders(prev => ({
                    ...prev,
                    [type]: {
                      ...prev[type],
                      customTimes: newTimes
                    }
                  }));
                }}
              >
                <MaterialCommunityIcons name="plus" size={16} color="#4CAF50" />
                <Text style={styles.addTimeButtonText}>Add Another Time</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <MaterialCommunityIcons name="robot" size={20} color="#FF9800" />
              <View style={styles.settingLabelContainer}>
              <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>
                AI Pattern Recognition
              </Text>
              <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>
                Learns from your baby's patterns
              </Text>
              </View>
            </View>
            {aiLoading && (
              <ActivityIndicator size="small" color="#FF9800" style={styles.loadingIndicator} />
            )}
            <Switch
              value={currentReminder.useAI}
              onValueChange={() => toggleAI(type)}
              trackColor={{ false: '#D0D0D0', true: '#FFA726' }}
              thumbColor={currentReminder.useAI ? '#FFFFFF' : '#F4F4F4'}
              ios_backgroundColor="#D0D0D0"
              disabled={!aiConsent || aiLoading}
            />
          </View>

          {/* AI Insights Section */}
          {currentReminder.useAI && aiConsent && currentReminder.aiRecommendedTimes && (
            <View style={[
              styles.aiSection,
              { 
                backgroundColor: darkMode ? '#3D3528' : '#FFF8E1',
                borderLeftColor: darkMode ? '#FFA726' : '#FF9800'
              }
            ]}>
              <View style={styles.aiMainInfo}>
                <MaterialCommunityIcons name="robot" size={16} color={darkMode ? '#FFB74D' : '#FF9800'} />
                <View style={styles.aiMainContent}>
                  <Text style={[styles.aiPatternText, { color: darkMode ? '#FFB74D' : '#FF9800' }]}>
                    {currentReminder.aiPattern}
                  </Text>
                  
                  {/* Next Reminder Timer */}
                  {(() => {
                    const nextReminder = getNextReminderTime(currentReminder.aiRecommendedTimes);
                    const timingBasis = currentReminder.confidence === 'low' 
                      ? 'age-appropriate intervals' 
                      : 'your baby\'s routine';
                    
                    return (
                      <View style={[
                        styles.nextReminderContainer,
                        { backgroundColor: darkMode ? '#4A3D2E' : '#FFE0B2' }
                      ]}>
                        <MaterialCommunityIcons 
                          name="clock-outline" 
                          size={14} 
                          color={darkMode ? '#FFB74D' : '#F57C00'} 
                        />
                        <Text style={[
                          styles.nextReminderText,
                          { color: darkMode ? '#FFD699' : '#E65100' }
                        ]}>
                          Next reminder in {formatNextReminderTime(nextReminder.hours, nextReminder.minutes)}
                          {' '}(based on {timingBasis})
                        </Text>
                      </View>
                    );
                  })()}
                  
                  <View style={styles.aiTimesContainer}>
                    {currentReminder.aiRecommendedTimes.map((time, index) => (
                      <View key={index} style={[
                        styles.aiTimeChip,
                        { backgroundColor: darkMode ? '#FFA726' : '#FF9800' }
                      ]}>
                        <Text style={styles.aiTimeText}>{formatTime12Hour(time)}</Text>
                      </View>
                    ))}
                  </View>
                  
                  {currentReminder.confidence && (
                    <View style={[
                      styles.confidenceContainer,
                      { backgroundColor: darkMode ? '#3D3528' : '#FFF3E0' }
                    ]}>
                      <Text style={[styles.confidenceLabel, { color: darkMode ? '#B0B0B0' : '#666' }]}>
                        Data Quality: 
                      </Text>
                      <View style={[
                        styles.confidenceBadge,
                        { backgroundColor: getConfidenceColor(currentReminder.confidence) }
                      ]}>
                        <Text style={styles.confidenceText}>
                          {currentReminder.confidence === 'high' ? 'EXCELLENT' : 
                          currentReminder.confidence === 'medium' ? 'GOOD' : 'BUILDING'}
                        </Text>
                      </View>
                      <Text style={[
                        styles.confidenceExplanation,
                        { color: darkMode ? '#FFB74D' : '#E65100' }
                      ]}>
                        {currentReminder.confidence === 'high' 
                          ? ' - Strong pattern detected' 
                          : currentReminder.confidence === 'medium' 
                          ? ' - Pattern forming' 
                          : ' - Keep logging for better predictions'}
                      </Text>
                    </View>
                  )}
                  
                  {/* Improvement Tips based on confidence */}
                  {currentReminder.confidence === 'low' && (
                    <View style={[
                      styles.improvementTipContainer,
                      { backgroundColor: darkMode ? '#4A3D2E' : '#FFF3E0' }
                    ]}>
                      <MaterialCommunityIcons 
                        name="lightbulb-on-outline" 
                        size={14} 
                        color={darkMode ? '#FFB74D' : '#F57C00'} 
                      />
                      <Text style={[
                        styles.improvementTipText,
                        { color: darkMode ? '#FFD699' : '#E65100' }
                      ]}>
                        <Text style={{ fontWeight: '600' }}>How to improve: </Text>
                        Log {type} activities consistently for 3-5 days. The AI will analyze patterns in timing, 
                        frequency, and identify your baby's natural rhythm to provide personalized recommendations.
                      </Text>
                    </View>
                  )}
                  
                  {currentReminder.confidence === 'medium' && (
                    <View style={[
                      styles.improvementTipContainer,
                      { backgroundColor: darkMode ? '#4A3D2E' : '#FFF3E0' }
                    ]}>
                      <MaterialCommunityIcons 
                        name="trending-up" 
                        size={14} 
                        color={darkMode ? '#FFB74D' : '#F57C00'} 
                      />
                      <Text style={[
                        styles.improvementTipText,
                        { color: darkMode ? '#FFD699' : '#E65100' }
                      ]}>
                        <Text style={{ fontWeight: '600' }}>Pattern forming: </Text>
                        Continue logging to strengthen the AI's understanding. Log {7} more activities 
                        for highly accurate predictions based on your baby's unique schedule.
                      </Text>
                    </View>
                  )}
                  
                  {currentReminder.confidence === 'high' && (
                    <View style={[
                      styles.improvementTipContainer,
                      { backgroundColor: darkMode ? '#2E4A3D' : '#E8F5E9' }
                    ]}>
                      <MaterialCommunityIcons 
                        name="check-circle-outline" 
                        size={14} 
                        color={darkMode ? '#81C784' : '#2E7D32'} 
                      />
                      <Text style={[
                        styles.improvementTipText,
                        { color: darkMode ? '#A5D6A7' : '#1B5E20' }
                      ]}>
                        <Text style={{ fontWeight: '600' }}>Routine optimized: </Text>
                        AI has learned your baby's pattern! Continue logging to maintain accuracy and 
                        adapt to routine changes as your baby grows.
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Expandable Insights */}
              {showInsights && currentReminder.insights && (
                <View style={styles.expandedInsights}>
                  <Text style={[styles.insightsTitle, { color: darkMode ? '#FFB74D' : '#FF9800' }]}>
                    AI Analysis
                  </Text>
                  {currentReminder.insights.map((insight, index) => (
                    <View key={index} style={styles.insightRow}>
                      <MaterialCommunityIcons 
                        name="circle-small" 
                        size={16} 
                        color={darkMode ? '#FFB74D' : '#FF9800'} 
                      />
                      <Text style={[styles.insightText, { color: theme.textPrimary }]}>
                        {insight}
                      </Text>
                    </View>
                  ))}
                  {currentReminder.parentTip && (
                    <View style={[
                      styles.tipContainer,
                      { backgroundColor: darkMode ? '#2E4A3D' : '#E8F5E8' }
                    ]}>
                      <MaterialCommunityIcons 
                        name="lightbulb" 
                        size={16} 
                        color={darkMode ? '#81C784' : '#4CAF50'} 
                      />
                      <Text style={[
                        styles.tipText,
                        { color: darkMode ? '#A5D6A7' : '#2E7D32' }
                      ]}>
                        {currentReminder.parentTip}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default function RemindersScreen() {
  const { darkMode } = useDarkMode();
  const theme = darkMode ? appTheme.dark : appTheme.light;
  const navigation = useNavigation();
  const route = useRoute();
  const { childId, name } = route.params || {};
  const auth = getAuth();

const [reminders, setReminders] = useState({
  feeding: {
    enabled: false,
    useAI: false,
    customTimes: ['12:00'], // Array instead of single customTime
    aiPattern: 'Every 3-4 hours based on feeding history',
    notificationIds: [],
    aiRecommendedTimes: [],
    frequency: 'daily'
  },
  diaper: {
    enabled: false,
    useAI: false,
    customTimes: ['10:00'],
    aiPattern: 'Every 2-3 hours based on diaper logs',
    notificationIds: [],
    aiRecommendedTimes: [],
    frequency: 'daily'
  },
  nap: {
    enabled: false,
    useAI: false,
    customTimes: ['14:00'],
    aiPattern: 'Based on sleep patterns and age',
    notificationIds: [],
    aiRecommendedTimes: [],
    frequency: 'daily'
  }
});

  const [aiConsent, setAiConsent] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentEditingType, setCurrentEditingType] = useState(null);
  const [tempTime, setTempTime] = useState(new Date());

  const reminderTypes = [
    {
      key: 'feeding',
      title: 'Feeding',
      icon: 'food',
      color: '#4ECDC4',
      description: 'Never miss feeding time',
      collection: 'feedLogs',
      timestampField: 'timestamp'
    },
    {
      key: 'diaper',
      title: 'Diaper Change',
      icon: 'baby-face',
      color: '#45B7D1',
      description: 'Stay on top of diaper changes',
      collection: 'diaperLogs',
      timestampField: 'time'
    },
    {
      key: 'nap',
      title: 'Nap Time',
      icon: 'sleep',
      color: '#96CEB4',
      description: 'Maintain healthy sleep schedules',
      collection: 'sleepLogs',
      timestampField: 'timestamp'
    }
  ];

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) setExpoPushToken(token);
    });
    loadSavedReminders();
  }, []);

  // Load saved reminders from Firebase
const loadSavedReminders = async () => {
  try {
    const reminderDoc = await getDoc(doc(db, 'reminders', childId));
    if (reminderDoc.exists()) {
      const data = reminderDoc.data();
      const loadedReminders = data.reminders || reminders;
      
      // Migrate old data structure to new structure and fill in defaults
      const migratedReminders = {};
      for (const [key, reminder] of Object.entries(loadedReminders)) {
        migratedReminders[key] = {
          enabled: reminder?.enabled || false,
          useAI: reminder?.useAI || false,
          customTimes: reminder?.customTimes || (reminder?.customTime ? [reminder.customTime] : ['12:00']),
          aiPattern: reminder?.aiPattern || '',
          notificationIds: reminder?.notificationIds || [],
          aiRecommendedTimes: reminder?.aiRecommendedTimes || [],
          frequency: reminder?.frequency || 'daily',
          // Optional fields with defaults
          confidence: reminder?.confidence || null,
          insights: reminder?.insights || [],
          parentTip: reminder?.parentTip || '',
          nextOptimization: reminder?.nextOptimization || ''
        };
      }
      
      setReminders(migratedReminders);
      setAiConsent(data.aiConsent || false);
      
      console.log('Reminders loaded successfully:', migratedReminders);
    }
  } catch (error) {
    console.error('Error loading reminders:', error);
  }
};

  // Request notification permissions and get push token
  async function registerForPushNotificationsAsync() {
    let token;
    
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Baby Care Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Alert.alert(
        'Notifications Disabled', 
        'Please enable notifications in your device settings to receive reminders.'
      );
      return null;
    }
    
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      return token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  // Fetch child's historical data for AI analysis
const getChildHistoricalData = async (reminderType) => {
  try {
    const reminderConfig = reminderTypes.find(r => r.key === reminderType);
    if (!reminderConfig) {
      console.warn('Reminder config not found for type:', reminderType);
      return [];
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const q = query(
      collection(db, reminderConfig.collection),
      where('childId', '==', childId),
      where(reminderConfig.timestampField, '>=', sevenDaysAgo),
      orderBy(reminderConfig.timestampField, 'desc'),
      limit(50)
    );

    const querySnapshot = await getDocs(q);
    const logs = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const timestampField = data[reminderConfig.timestampField];
      
      if (timestampField === null || timestampField === undefined) {
        console.warn(`Missing timestamp field ${reminderConfig.timestampField} in document:`, doc.id);
        return;
      }

      let timestamp = null;

      try {
        // Handle Firestore Timestamp objects (most common)
        if (timestampField && typeof timestampField === 'object' && typeof timestampField.toDate === 'function') {
          timestamp = timestampField.toDate();
          console.log(`Successfully converted Firestore Timestamp to Date for doc ${doc.id}`);
        }
        // Handle plain objects with seconds property
        else if (
          timestampField &&
          typeof timestampField === 'object' &&
          typeof timestampField.seconds === 'number'
        ) {
          timestamp = new Date(timestampField.seconds * 1000);
          console.log(`Successfully converted seconds object to Date for doc ${doc.id}`);
        }
        // Handle Date objects
        else if (timestampField instanceof Date) {
          timestamp = timestampField;
          console.log(`Already a Date object for doc ${doc.id}`);
        }
        // Handle ISO strings
        else if (typeof timestampField === 'string') {
          timestamp = new Date(timestampField);
          console.log(`Successfully converted ISO string to Date for doc ${doc.id}`);
        }
        // Handle Unix timestamps (milliseconds)
        else if (typeof timestampField === 'number') {
          // Check if it's likely milliseconds (13 digits) or seconds (10 digits)
          if (timestampField > 1e10) {
            timestamp = new Date(timestampField);
          } else {
            timestamp = new Date(timestampField * 1000);
          }
          console.log(`Successfully converted number to Date for doc ${doc.id}`);
        }
        else {
          console.warn(`Unrecognized timestamp format for doc ${doc.id}:`, typeof timestampField, timestampField);
          return;
        }

        // Validate the resulting timestamp
        if (!timestamp || isNaN(timestamp.getTime())) {
          console.warn(`Invalid timestamp created from:`, timestampField, `for doc ${doc.id}`);
          return;
        }
        
        logs.push({
          id: doc.id,
          timestamp,
          ...data
        });
        
        console.log(`✓ Added ${reminderType} log from doc ${doc.id} with timestamp:`, timestamp.toISOString());
      } catch (error) {
        console.error(`Error processing timestamp for doc ${doc.id}:`, error);
        console.error(`Problematic field value:`, timestampField);
      }
    });

    console.log(`Successfully processed ${logs.length} valid logs for ${reminderType} analysis (out of ${querySnapshot.size} documents)`);
    
    if (logs.length > 0) {
      const firstLog = logs[0].timestamp?.toDate?.();
      const lastLog = logs[logs.length - 1].timestamp?.toDate?.();

      if (firstLog && lastLog) {
        console.log(`Time range: ${lastLog.toISOString()} to ${firstLog.toISOString()}`);
      } else {
        console.log('One or more timestamps are missing or invalid.');
      }
    }
    
    return logs.sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first
  } catch (error) {
    console.error('Error fetching historical data:', error);
    console.error('Stack trace:', error.stack);
    return [];
  }
};

const [showAiConsentModal, setShowAiConsentModal] = useState(false);

const AIConsentModal = () => (
  <Modal transparent visible={showAiConsentModal} animationType="fade">
    <View style={styles.modalOverlay}>
      <View style={styles.aiConsentModal}>
        <View style={styles.modalHeader}>
          <MaterialCommunityIcons name="robot" size={32} color="#FF9800" />
          <Text style={styles.modalHeaderText}>AI Pattern Recognition</Text>
        </View>
        
        <ScrollView style={styles.consentModalContent}>
          <Text style={styles.consentModalTitle}>How AI Analysis Works</Text>
          <Text style={styles.consentModalText}>
            Our AI analyzes your baby's care patterns to suggest optimal reminder times. Here's what you should know:
          </Text>
          
          <View style={styles.consentSection}>
            <Text style={styles.consentSectionTitle}>Data Usage:</Text>
            <Text style={styles.consentModalText}>
              - Your baby's feeding, sleep, and diaper change timestamps are sent to OpenAI's servers for analysis{'\n'}
              - Data is used only to generate personalized scheduling recommendations{'\n'}
              - No personal information (names, locations) is included in the analysis
            </Text>
          </View>
          
          <View style={styles.consentSection}>
            <Text style={styles.consentSectionTitle}>Privacy & Security:</Text>
            <Text style={styles.consentModalText}>
              - Data transmission is encrypted and secure{'\n'}
              - OpenAI may retain data for up to 30 days per their policy{'\n'}
              - You can disable AI analysis at any time{'\n'}
              - Local pattern analysis is available as an alternative
            </Text>
          </View>
          
          <View style={styles.consentSection}>
            <Text style={styles.consentSectionTitle}>Medical Disclaimer:</Text>
            <Text style={styles.consentModalText}>
              AI recommendations are for convenience only and should not replace pediatric medical advice. Always consult your healthcare provider for medical concerns.
            </Text>
          </View>
        </ScrollView>
        
        <View style={styles.modalButtons}>
          <TouchableOpacity 
            style={styles.modalCancelButton}
            onPress={() => setShowAiConsentModal(false)}
          >
            <Text style={styles.modalCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.modalAcceptButton}
            onPress={() => {
              setAiConsent(true);
              setShowAiConsentModal(false);
              Alert.alert(
                'AI Enabled!',
                'You can now toggle AI Pattern Recognition for individual reminders.',
                [{ text: 'Got it!' }]
              );
            }}
          >
            <Text style={styles.modalAcceptButtonText}>Accept & Enable</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const callOpenAI = async (prompt) => {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'undefined') {
    throw new Error('OpenAI API key not configured');
  }

  try {
    console.log('Making OpenAI API request...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful assistant for baby care scheduling. You must respond with ONLY valid JSON, no additional text or formatting. ALWAYS use 12-hour AM/PM time format in all text.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 400,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Details:', errorText);
      
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your OpenAI API key.');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    
    // Clean up the response to extract JSON
    content = extractJSON(content);
    
    console.log('Cleaned API response:', content);
    return content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
};

const cleanReminderData = (reminders) => {
  const cleaned = {};
  
  for (const [key, reminder] of Object.entries(reminders)) {
    cleaned[key] = {
      enabled: reminder.enabled || false,
      useAI: reminder.useAI || false,
      customTimes: reminder.customTimes || ['12:00'],
      aiPattern: reminder.aiPattern || '',
      notificationIds: reminder.notificationIds || [],
      aiRecommendedTimes: reminder.aiRecommendedTimes || [],
      frequency: reminder.frequency || 'daily',
      // Only include optional fields if they have values
      ...(reminder.confidence && { confidence: reminder.confidence }),
      ...(reminder.insights && Array.isArray(reminder.insights) && reminder.insights.length > 0 && { insights: reminder.insights }),
      ...(reminder.parentTip && reminder.parentTip.length > 0 && { parentTip: reminder.parentTip }),
      ...(reminder.nextOptimization && reminder.nextOptimization.length > 0 && { nextOptimization: reminder.nextOptimization })
    };
  }
  
  return cleaned;
};

// Helper function to extract JSON from potentially messy responses
const extractJSON = (text) => {
  try {
    // First, try to parse as-is
    JSON.parse(text);
    return text;
  } catch (e) {
    // If that fails, try to extract JSON from the text
    console.log('Attempting to extract JSON from:', text);
    
    // Look for JSON object between curly braces
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        JSON.parse(jsonMatch[0]);
        return jsonMatch[0];
      } catch (e2) {
        console.log('Extracted JSON still invalid');
      }
    }
    
    // If all else fails, return the original text and let the caller handle it
    return text;
  }
};

const generateLocalRecommendations = (analysisData, reminderType, dataCount, childData = {}) => {
  const { topHours, avgInterval, earliestTime, latestTime, distribution } = analysisData;
  
  let confidence = 'low';
  if (dataCount >= 15) confidence = 'high';
  else if (dataCount >= 8) confidence = 'medium';
  
  // For low confidence, generate age/weight-based recommendations
  let recommendedTimes;
  let recommendedInterval;
  
  if (confidence === 'low') {
    const ageMonths = childData?.ageMonths || 0;
    
    switch (reminderType) {
      case 'feeding':
        if (ageMonths < 2) {
          // Newborn: every 2-3 hours
          recommendedInterval = 2.5;
          recommendedTimes = ['06:00', '08:30', '11:00', '13:30', '16:00', '18:30', '21:00', '23:30'];
        } else if (ageMonths < 6) {
          // 2-6 months: every 3-4 hours
          recommendedInterval = 3.5;
          recommendedTimes = ['07:00', '10:30', '14:00', '17:30', '21:00'];
        } else if (ageMonths < 12) {
          // 6-12 months: every 4 hours with solids
          recommendedInterval = 4;
          recommendedTimes = ['07:00', '11:00', '15:00', '19:00'];
        } else {
          // 12+ months: 3 meals + snacks
          recommendedInterval = 5;
          recommendedTimes = ['08:00', '12:00', '15:00', '18:00'];
        }
        break;
        
      case 'diaper':
        if (ageMonths < 3) {
          // Newborn: every 2 hours
          recommendedInterval = 2;
          recommendedTimes = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];
        } else if (ageMonths < 12) {
          // 3-12 months: every 2-3 hours
          recommendedInterval = 2.5;
          recommendedTimes = ['08:00', '10:30', '13:00', '15:30', '18:00', '20:30'];
        } else {
          // 12+ months: every 3-4 hours
          recommendedInterval = 3.5;
          recommendedTimes = ['08:00', '11:30', '15:00', '18:30'];
        }
        break;
        
      case 'nap':
        if (ageMonths < 4) {
          // Newborn: 4-5 naps
          recommendedInterval = 2;
          recommendedTimes = ['09:00', '11:30', '14:00', '16:30'];
        } else if (ageMonths < 9) {
          // 4-9 months: 2-3 naps
          recommendedInterval = 3;
          recommendedTimes = ['09:30', '13:00', '16:00'];
        } else if (ageMonths < 18) {
          // 9-18 months: 2 naps
          recommendedInterval = 4;
          recommendedTimes = ['10:00', '14:30'];
        } else {
          // 18+ months: 1 nap
          recommendedInterval = 6;
          recommendedTimes = ['13:00'];
        }
        break;
        
      default:
        recommendedTimes = ['09:00', '12:00', '15:00', '18:00'];
        recommendedInterval = 3;
    }
  } else {
    // Use actual data patterns
    recommendedTimes = topHours.slice(0, reminderType === 'nap' ? 2 : 3);
    recommendedInterval = avgInterval;
  }
  
  const getTypeSpecificInsights = (type, hours, interval, count, childAge) => {
    if (confidence === 'low') {
      const ageMonths = childAge || 0;
      const ageDescription = ageMonths < 2 ? 'newborn' : 
                            ageMonths < 6 ? '2-6 months' :
                            ageMonths < 12 ? '6-12 months' : 'toddler';
      
      return [
        `Age-appropriate ${type} schedule for ${ageDescription} (every ${recommendedInterval} hrs)`,
        `${count} logs recorded - need ${confidence === 'medium' ? '15' : '8'} for personalized AI timing`,
        `Keep logging to unlock pattern recognition based on your baby's unique routine`
      ];
    }
    
    switch (type) {
      case 'feeding':
        return [
          `Baby typically feeds around ${hours.slice(0, 2).map(h => formatTime12Hour(h)).join(' and ')} based on ${count} feeding logs`,
          `Average ${interval} hour intervals between feedings`,
          childAge && childAge < 4 ? 'At this age, frequent feeding is normal and healthy' : 'Schedule is developing well with consistent patterns'
        ];
      case 'diaper':
        return [
          `Diaper changes most needed around ${hours.slice(0, 2).map(h => formatTime12Hour(h)).join(' and ')}`,
          `${interval}-hour intervals between changes fits normal patterns`,
          `Activity spans from ${formatTime12Hour(earliestTime)} to ${formatTime12Hour(latestTime)}`
        ];
      case 'nap':
        return [
          `Best nap times appear to be ${hours.slice(0, 2).map(h => formatTime12Hour(h)).join(' and ')}`,
          `${interval} hours between sleep periods follows natural rest cycles`,
          `Naps logged between ${formatTime12Hour(earliestTime)} and ${formatTime12Hour(latestTime)}`
        ];
      default:
        return ['Pattern analysis based on your data', 'Timing shows developing routine', 'Consistency will improve outcomes'];
    }
  };

  const getParentTip = (type, childAge, conf) => {
    const ageMonths = childAge || 0;
    
    if (conf === 'low') {
      return `Log ${type} activities consistently for 3-5 days to get personalized AI recommendations based on your baby's unique patterns.`;
    }
    
    const tips = {
      feeding: ageMonths < 6 
        ? 'Watch for hunger cues like rooting or hand-to-mouth movements. Newborns feed on demand.' 
        : 'Watch for hunger cues 15-30 minutes before scheduled times. Introducing solids? Keep milk feeds consistent.',
      diaper: ageMonths < 3
        ? 'Change diapers every 2-3 hours and after each feeding. Frequent changes prevent rashes.'
        : 'Check diapers before and after feeds. More frequent changes support healthy skin.',
      nap: ageMonths < 6
        ? 'Newborns sleep 14-17 hours daily. Watch for sleepy cues and follow wake windows.'
        : 'Look for sleepy cues like yawning or rubbing eyes. Consistent nap times help regulate sleep cycles.'
    };
    return tips[type] || 'Maintain consistent timing to help establish healthy routines';
  };
  
  return {
    times: recommendedTimes,
    explanation: confidence === 'low' 
      ? `Age-appropriate ${reminderType} schedule (every ${recommendedInterval} hrs). Log more activities (${dataCount}/8 recorded) for personalized AI timing.`
      : `Analysis of ${dataCount} logged ${reminderType} activities shows optimal times are ${topHours.slice(0, 2).map(h => formatTime12Hour(h)).join(' and ')}. Activity spans from ${formatTime12Hour(earliestTime)} to ${formatTime12Hour(latestTime)}.`,
    frequency: 'daily',
    confidence,
    insights: getTypeSpecificInsights(reminderType, topHours, avgInterval, dataCount, childData?.ageMonths),
    parentTip: getParentTip(reminderType, childData?.ageMonths, confidence),
    nextOptimization: confidence === 'low' 
      ? `Log ${8 - dataCount} more activities to unlock pattern recognition`
      : 'Review patterns weekly as routines develop'
  };
};

const getChildData = async (childId) => {
  try {
    if (!childId) {
      console.warn('getChildData: childId is missing');
      return null;
    }

    const docRef = doc(db, 'children', childId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('Child data retrieved:', data);
      
      let age = 0;
      if (data.birthDate) {
        let birthDate = data.birthDate;
        if (typeof birthDate.toDate === 'function') {
          birthDate = birthDate.toDate();
        } else if (typeof birthDate === 'string') {
          birthDate = new Date(birthDate);
        }
        
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }
      
      const result = {
        age,
        ageMonths: age,
        weight: data.weight || 'unknown',
        weightUnit: data.weightUnit || 'lbs',
        height: data.height || 'unknown',
        heightUnit: data.heightUnit || 'in'
      };
      
      console.log('Processed child data:', result);
      return result;
    } else {
      console.warn('No child document found for childId:', childId);
      return null;
    }
  } catch (error) {
    console.error('Error fetching child data:', error);
    return null;
  }
};

const getAIRecommendations = async (reminderType) => {
  setAiLoading(true);

  try {
    console.log(`Starting AI analysis for ${reminderType}`);
    const historicalData = await getChildHistoricalData(reminderType);
    console.log(`Historical data length: ${historicalData?.length || 0}`);

    if (!historicalData || historicalData.length < 3) {
      console.log('Insufficient data, using defaults');
      setAiLoading(false);
      return {
        times: getDefaultTimes(reminderType),
        explanation: `Insufficient data (${historicalData?.length || 0} entries). Using age-appropriate defaults.`,
        frequency: 'daily',
        confidence: 'low',
        insights: [`Start tracking ${reminderType} activities to get personalized recommendations`]
      };
    }

    // Get child data for context
    console.log('Fetching child data for childId:', childId);
    const childData = await getChildData(childId);
    console.log('Child data result:', childData);
    
    const analysisData = prepareAnalysisData(historicalData, reminderType, childData);
    console.log('Analysis data prepared:', analysisData);
    
    const topHoursStr = analysisData.topHours.slice(0, 3).map(h => formatTime12Hour(h)).join(', ');
    const timesJsonArray = JSON.stringify(analysisData.topHours.slice(0, 3));
    const ageMonths = childData?.ageMonths || 0;

    const prompt = `You are analyzing a baby's ${reminderType} patterns. Your job is to recommend reminder times based ONLY on the actual data provided.

    BABY DATA:
    - Age: ${ageMonths} months old
    - Number of ${reminderType} logs: ${historicalData.length}

    ACTUAL DATA ANALYSIS:
    The three most common times for ${reminderType} are: ${topHoursStr}
    Average interval: ${analysisData.avgInterval} hours
    Activity range: ${formatTime12Hour(analysisData.earliestTime)} to ${formatTime12Hour(analysisData.latestTime)}

    CRITICAL INSTRUCTIONS:
    1. You MUST use times from this list ONLY: ${timesJsonArray}
    2. Consider baby's sleep schedule - avoid recommendations between 10:00 PM and 6:00 AM unless data shows clear pattern
    3. For feeding, space recommendations to avoid nighttime unless baby regularly feeds at night
    4. Return exactly 2-3 times from the provided list
    5. In your "explanation" field, ALWAYS use 12-hour AM/PM format (e.g., "8:00 AM" or "3:00 PM"), NEVER 24-hour format
    6. Respond with ONLY valid JSON, no other text

    EXAMPLE of correct explanation format:
    "Baby typically feeds at 7:00 AM and 3:00 PM based on consistent patterns"

    NOT this format:
    "Baby typically feeds at 07:00 and 15:00"

    Return this JSON structure:
    {
      "times": ${timesJsonArray},
      "explanation": "Use 12-hour AM/PM format here (e.g., 8:00 AM, not 08:00 or 8:00)",
      "frequency": "daily",
      "confidence": "medium",
      "insights": ["insight with 12-hour times if mentioning times", "another insight", "third insight"],
      "nextOptimization": "review timing after 1 week",
      "parentTip": "practical advice for the parent"
    }`;

    try {
      const content = await callOpenAI(prompt);
      console.log('Raw AI response for', reminderType, ':', content);
      
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        console.error('JSON parse error for', reminderType, ':', parseError);
        console.error('Problematic content:', content);
        throw new Error(`Invalid JSON response: ${parseError.message}`);
      }
      
      if (!parsed.times || !Array.isArray(parsed.times) || parsed.times.length === 0) {
        throw new Error('Invalid response structure: missing or invalid times array');
      }

      setAiLoading(false);
      return {
        ...parsed,
        rawData: analysisData
      };
    } catch (apiError) {
      console.log(`AI API failed for ${reminderType}, using local analysis:`, apiError.message);
      const localResult = generateLocalRecommendations(analysisData, reminderType, historicalData.length, childData);
      setAiLoading(false);
      return localResult;
    }
  } catch (error) {
    console.error('AI recommendation error:', error);
    setAiLoading(false);

    return {
      times: getDefaultTimes(reminderType),
      explanation: 'Analysis temporarily unavailable. Using smart defaults.',
      frequency: 'daily',
      confidence: 'low',
      insights: ['Pattern analysis will improve with more data'],
      parentTip: 'Keep logging activities for better recommendations'
    };
  }
};

  
  // Helper function for enhanced data analysis
const prepareAnalysisData = (data, reminderType, childData = {}) => {
  console.log(`\n=== STARTING prepareAnalysisData for ${reminderType} ===`);
  console.log(`Received ${data.length} total entries`);
  
  if (data.length > 0) {
    console.log('First entry timestamp:', data[0].timestamp);
  }

  const hourCounts = {};
  const intervals = [];
  const dayPatterns = {};
  let earliestHour = 24;
  let latestHour = 0;

  // Helper function to convert various timestamp formats to Date
  const convertToDate = (timestampField) => {
    if (!timestampField) return null;

    try {
      // Already a Date
      if (timestampField instanceof Date) {
        return timestampField;
      }

      // Firestore Timestamp with toDate() method
      if (typeof timestampField.toDate === 'function') {
        return timestampField.toDate();
      }

      // Raw Firestore timestamp object: {seconds, nanoseconds}
      if (
        typeof timestampField === 'object' &&
        typeof timestampField.seconds === 'number'
      ) {
        const milliseconds = timestampField.seconds * 1000 + Math.floor(timestampField.nanoseconds / 1000000);
        return new Date(milliseconds);
      }

      // ISO string
      if (typeof timestampField === 'string') {
        return new Date(timestampField);
      }

      // Unix timestamp (milliseconds or seconds)
      if (typeof timestampField === 'number') {
        if (timestampField > 1e10) {
          return new Date(timestampField); // milliseconds
        } else {
          return new Date(timestampField * 1000); // seconds
        }
      }

      return null;
    } catch (error) {
      console.error('Error converting timestamp:', error);
      return null;
    }
  };

  // Detailed filter logging
  const validData = data.filter((entry, idx) => {
    const convertedDate = convertToDate(entry.timestamp);
    const isValid = convertedDate && !isNaN(convertedDate.getTime());
    
    if (idx < 3) { // Log first 3 entries
      console.log(`Entry ${idx}:`, {
        raw: entry.timestamp,
        converted: convertedDate,
        isValid: isValid
      });
    }
    
    // Replace the timestamp with the converted Date
    if (isValid) {
      entry.timestamp = convertedDate;
    }
    
    return isValid;
  });

  console.log(`✓ Filtered to ${validData.length} valid entries`);

  if (validData.length === 0) {
    console.warn(`❌ No valid timestamps found! Returning defaults.`);
    return {
      topHours: ['12:00'],
      avgInterval: 3,
      distribution: 'no valid data',
      patterns: 'insufficient data',
      totalEntries: 0,
      daySpread: 0,
      earliestTime: '00:00',
      latestTime: '00:00'
    };
  }

  validData.forEach((entry, index) => {
    try {
      const hour = entry.timestamp.getHours();
      const minutes = entry.timestamp.getMinutes();
      const day = entry.timestamp.getDay();
      
      if (index < 3) {
        console.log(`Processing ${index}: ${entry.timestamp.toISOString()} → hour: ${hour}`);
      }
      
      if (hour >= 0 && hour <= 23) {
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        earliestHour = Math.min(earliestHour, hour);
        latestHour = Math.max(latestHour, hour);
      }
      
      if (day >= 0 && day <= 6) {
        dayPatterns[day] = (dayPatterns[day] || 0) + 1;
      }

      if (index > 0 && validData[index - 1].timestamp) {
        const intervalHours = Math.abs(entry.timestamp - validData[index - 1].timestamp) / (1000 * 60 * 60);
        if (intervalHours > 0 && intervalHours < 24) {
          intervals.push(intervalHours);
        }
      }
    } catch (error) {
      console.warn(`Error processing entry at index ${index}:`, error);
    }
  });

  const topHours = Object.keys(hourCounts).length > 0 
    ? Object.entries(hourCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([hour]) => `${hour.toString().padStart(2, '0')}:00`)
    : getDefaultTopHours(reminderType);

  const avgInterval = intervals.length > 0 
    ? (intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(1)
    : getDefaultInterval(reminderType);

  console.log(`Hour counts:`, hourCounts);
  console.log(`Top hours: ${topHours.join(', ')}`);
  console.log(`Average interval: ${avgInterval} hours`);

  return {
    topHours,
    avgInterval,
    earliestTime: earliestHour !== 24 ? `${earliestHour.toString().padStart(2, '0')}:00` : '00:00',
    latestTime: latestHour !== 0 ? `${latestHour.toString().padStart(2, '0')}:00` : '00:00',
    distribution: Object.keys(hourCounts).length > 6 ? 'spread throughout day' : 'concentrated in specific hours',
    patterns: intervals.length > 0 ? `${avgInterval}h average intervals` : 'establishing patterns',
    totalEntries: validData.length,
    daySpread: Object.keys(dayPatterns).length
  };
};

// Helper functions for better defaults
const getDefaultTopHours = (reminderType) => {
  switch (reminderType) {
    case 'feeding':
      return ['07:00', '12:00', '17:00'];
    case 'diaper':
      return ['08:00', '14:00', '20:00'];
    case 'nap':
      return ['10:00', '14:00'];
    default:
      return ['12:00'];
  }
};

const getDefaultInterval = (reminderType) => {
  switch (reminderType) {
    case 'feeding':
      return '3.5'; // 3.5 hours between feedings
    case 'diaper':
      return '2.5'; // 2.5 hours between changes
    case 'nap':
      return '4.0'; // 4 hours between naps
    default:
      return '3.0';
  }
};
  
  // Default times based on reminder type and best practices
  const getDefaultTimes = (reminderType) => {
    switch (reminderType) {
      case 'feeding':
        return ['07:00', '11:00', '15:00', '19:00']; // Every 4 hours
      case 'diaper':
        return ['08:00', '12:00', '16:00', '20:00']; // Every 4 hours
      case 'nap':
        return ['10:00', '14:00']; // Morning and afternoon naps
      default:
        return ['12:00'];
    }
  };

  // Local pattern analysis (privacy-focused approach)
  const analyzePatterns = (data, reminderType) => {
    if (!data || data.length === 0) {
      return {
        times: ['12:00'],
        explanation: `No data available for ${reminderType} analysis.`,
        frequency: 'daily'
      };
    }

    const hourCounts = {};
    const intervalCounts = {};
    
    // Analyze timing patterns with error handling
    data.forEach((entry, index) => {
      try {
        if (!entry.timestamp || !(entry.timestamp instanceof Date)) {
          console.warn(`Invalid timestamp at index ${index}:`, entry.timestamp);
          return;
        }
        
        const hour = entry.timestamp.getHours();
        if (hour >= 0 && hour <= 23) {
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }
      } catch (error) {
        console.warn(`Error processing entry at index ${index}:`, error);
      }
    });

    // Calculate intervals between activities with error handling
    for (let i = 1; i < data.length; i++) {
      try {
        const currentEntry = data[i-1];
        const previousEntry = data[i];
        
        if (!currentEntry.timestamp || !previousEntry.timestamp || 
            !(currentEntry.timestamp instanceof Date) || 
            !(previousEntry.timestamp instanceof Date)) {
          continue;
        }
        
        const interval = Math.round((currentEntry.timestamp - previousEntry.timestamp) / (1000 * 60 * 60));
        if (interval > 0 && interval < 12) {
          intervalCounts[interval] = (intervalCounts[interval] || 0) + 1;
        }
      } catch (error) {
        console.warn(`Error calculating interval at index ${i}:`, error);
      }
    }

    // Find most common times
    const sortedHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    const recommendedTimes = sortedHours.map(([hour]) => {
      const h = parseInt(hour);
      return `${h.toString().padStart(2, '0')}:00`;
    });

    // Find most common interval
    const mostCommonInterval = Object.entries(intervalCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || '3';

    let explanation;
    const dataCount = data.length;
    const validHours = Object.keys(hourCounts).length;

    if (validHours === 0) {
      // Fallback if no valid timestamps
      return {
        times: ['12:00'],
        explanation: `No valid timestamp data found for ${reminderType}. Using default schedule.`,
        frequency: 'daily'
      };
    }

    switch (reminderType) {
      case 'feeding':
        explanation = `Based on ${dataCount} feeding logs, optimal times are ${recommendedTimes.join(', ')} with ${mostCommonInterval}hr intervals.`;
        break;
      case 'diaper':
        explanation = `Analysis of ${dataCount} diaper changes suggests checking every ${mostCommonInterval} hours.`;
        break;
      case 'nap':
        explanation = `Sleep pattern analysis shows best nap times at ${recommendedTimes.join(', ')}.`;
        break;
      default:
        explanation = 'Pattern-based recommendation';
    }

    return {
      times: recommendedTimes.length > 0 ? recommendedTimes : ['12:00'],
      explanation,
      frequency: 'daily'
    };
  };

  // Schedule multiple notifications for user-specified times
  const scheduleNotifications = async (reminderType, times, useAI = false) => {
    const reminder = reminderTypes.find(r => r.key === reminderType);
    const notificationIds = [];
    const currentReminder = reminders[reminderType];
    
    console.log(`\n📅 Scheduling ${reminderType} notifications for times:`, times);
    
    for (const time of times) {
      const [hours, minutes] = time.split(':').map(Number);
      
      console.log(`Setting up notification for ${formatTime12Hour(time)}`);
      
      // Create trigger for daily repeat at specific time
      const trigger = {
        hour: hours,
        minute: minutes,
        repeats: true, // Daily repeat
      };

      // Create notification content
      const timeFormatted = formatTime12Hour(time);
      let notificationTitle;
      let notificationBody;
      
      if (useAI && currentReminder?.aiPattern) {
        // AI-based notification
        switch (reminderType) {
          case 'feeding':
            notificationTitle = '🍼 Feeding Time!';
            notificationBody = currentReminder.confidence === 'high'
              ? `${name} typically feeds around now based on their routine. Time for feeding!`
              : `Suggested feeding time for ${name} based on age-appropriate schedule.`;
            break;
          case 'diaper':
            notificationTitle = '👶 Diaper Check';
            notificationBody = currentReminder.confidence === 'high'
              ? `Time to check ${name}'s diaper - staying on schedule!`
              : `Recommended diaper check time for ${name}.`;
            break;
          case 'nap':
            notificationTitle = '😴 Nap Time';
            notificationBody = currentReminder.confidence === 'high'
              ? `${name} is likely getting sleepy. Optimal nap time!`
              : `Suggested nap time for ${name} based on age.`;
            break;
          default:
            notificationTitle = `🤖 ${reminder.title} Reminder`;
            notificationBody = `AI suggests it's time for ${reminder.title.toLowerCase()}.`;
        }
        
        if (currentReminder.parentTip && currentReminder.confidence === 'high') {
          notificationBody += `\n\n💡 ${currentReminder.parentTip}`;
        }
      } else {
        // Manual notification
        switch (reminderType) {
          case 'feeding':
            notificationTitle = `🍼 ${name}'s Feeding Time`;
            notificationBody = `Time for ${name}'s feeding!`;
            break;
          case 'diaper':
            notificationTitle = `👶 ${name}'s Diaper Change`;
            notificationBody = `Time to check ${name}'s diaper!`;
            break;
          case 'nap':
            notificationTitle = `😴 ${name}'s Nap Time`;
            notificationBody = `Time for ${name}'s nap!`;
            break;
          default:
            notificationTitle = `${name}'s ${reminder.title}`;
            notificationBody = `Time for ${name}'s ${reminder.title.toLowerCase()}!`;
        }
      }

      try {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: notificationTitle,
            body: notificationBody,
            data: { 
              childId, 
              childName: name,
              reminderType, 
              useAI,
              time: timeFormatted,
              confidence: currentReminder?.confidence,
              scheduledFor: `${hours}:${minutes.toString().padStart(2, '0')}`
            },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            badge: 1,
          },
          trigger, // This schedules it for the specific hour and minute, repeating daily
        });
        
        notificationIds.push(notificationId);
        console.log(`✅ Scheduled ${reminderType} notification at ${timeFormatted} (ID: ${notificationId})`);
      } catch (error) {
        console.error(`❌ Error scheduling notification for ${timeFormatted}:`, error);
      }
    }

    console.log(`✅ Total ${notificationIds.length} notifications scheduled for ${reminderType}\n`);
    return notificationIds;
  };

  // Cancel multiple scheduled notifications
  const cancelNotifications = async (notificationIds) => {
    for (const id of notificationIds) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch (error) {
        console.error('Error canceling notification:', error);
      }
    }
  };

  // Send immediate notification
const sendImmediateReminder = async (reminderType) => {
  const reminder = reminderTypes.find(r => r.key === reminderType);
  const currentReminder = reminders[reminderType];
  
  let notificationBody;
  if (currentReminder.useAI && currentReminder.aiPattern) {
    notificationBody = `Immediate reminder: ${currentReminder.aiPattern}`;
    if (currentReminder.parentTip) {
      notificationBody += `\n💡 ${currentReminder.parentTip}`;
    }
  } else {
    notificationBody = `Manual reminder for ${name}'s ${reminder.title.toLowerCase()}`;
  }
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: currentReminder.useAI 
          ? `🤖 ${reminder.title} - Test Reminder` 
          : `${reminder.title} Reminder`,
        body: notificationBody,
        data: { childId, reminderType, immediate: true, useAI: currentReminder.useAI },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately - this is the key difference
    });

    Alert.alert('Test Sent!', `Test ${reminder.title.toLowerCase()} notification sent to your device.`);
  } catch (error) {
    console.error('Error sending test reminder:', error);
    Alert.alert('Error', 'Failed to send test notification.');
  }
};


// ============================================================================
// OPTIONAL: If you want to add a "Schedule Notifications" button later,
// create this function (add it to your component):
// ============================================================================

const scheduleAllNotifications = async () => {
  try {
    // Cancel any existing scheduled notifications first
    for (const [type, reminder] of Object.entries(reminders)) {
      if (reminder.notificationIds && reminder.notificationIds.length > 0) {
        await cancelNotifications(reminder.notificationIds);
      }
    }

    // Schedule new notifications for enabled reminders
    const updatedReminders = { ...reminders };
    
    for (const [type, reminder] of Object.entries(reminders)) {
      if (reminder.enabled) {
        const timesToUse = reminder.useAI && reminder.aiRecommendedTimes.length > 0
          ? reminder.aiRecommendedTimes 
          : reminder.customTimes;
        
        const notificationIds = await scheduleNotifications(type, timesToUse, reminder.useAI);
        updatedReminders[type] = {
          ...reminder,
          notificationIds
        };
      }
    }
    
    setReminders(updatedReminders);
    Alert.alert('Success', 'All reminders scheduled!');
  } catch (error) {
    console.error('Error scheduling notifications:', error);
    Alert.alert('Error', 'Failed to schedule notifications.');
  }
};

const toggleReminder = async (type) => {
  const currentReminder = reminders[type];
  const newEnabled = !currentReminder.enabled;

  setReminders(prev => ({
    ...prev,
    [type]: {
      ...prev[type],
      enabled: newEnabled,
      notificationIds: [] // Keep empty - don't schedule yet
    }
  }));
};

const toggleAI = async (type) => {
  const currentReminder = reminders[type];
  const newUseAI = !currentReminder.useAI;

  // If trying to enable AI but no consent, show modal
  if (newUseAI && !aiConsent) {
    setShowAiConsentModal(true);
    return;
  }
  
  // If trying to disable AI, just turn it off
  if (!newUseAI) {
    setReminders(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        useAI: false
      }
    }));
    return;
  }

  // If enabling AI with consent, get recommendations
  if (newUseAI && aiConsent) {
    const aiRecommendation = await getAIRecommendations(type);
    
    if (aiRecommendation) {
      setReminders(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          useAI: true,
          aiRecommendedTimes: aiRecommendation.times,
          aiPattern: aiRecommendation.explanation,
          confidence: aiRecommendation.confidence,
          insights: aiRecommendation.insights,
          parentTip: aiRecommendation.parentTip,
          nextOptimization: aiRecommendation.nextOptimization
        }
      }));
    }
  }
};
  const handleAiConsentToggle = async (value) => {
    if (!value) {
      // If disabling AI consent, disable AI for all reminders
      const updatedReminders = { ...reminders };
      
      for (const [key, reminder] of Object.entries(reminders)) {
        if (reminder.useAI && reminder.enabled) {
          await cancelNotifications(reminder.notificationIds);
          const notificationIds = await scheduleNotifications(key, reminder.customTimes, false);
          updatedReminders[key] = {
            ...reminder,
            useAI: false,
            notificationIds
          };
        } else {
          updatedReminders[key] = {
            ...reminder,
            useAI: false
          };
        }
      }
      
      setReminders(updatedReminders);
    }
    setAiConsent(value);
  };

  const openTimePicker = (type, index, currentTime) => {
    const [hours, minutes] = currentTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    
    setTempTime(date);
    setCurrentEditingType({ type, index });
    setShowTimePicker(true);
  };

  const handleTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    if (selectedTime && currentEditingType) {
      const timeString = selectedTime.toTimeString().substring(0, 5);
      setTempTime(selectedTime);
      
      if (Platform.OS === 'android') {
        updateCustomTime(currentEditingType, timeString);
      }
    }
  };

const confirmTimeChange = () => {
  if (currentEditingType) {
    const timeString = tempTime.toTimeString().substring(0, 5);
    updateCustomTime(currentEditingType, timeString);
  }
  setShowTimePicker(false);
  setCurrentEditingType(null);
};

const updateCustomTime = async (typeAndIndex, newTime) => {
  const { type, index } = typeAndIndex;
  const currentReminder = reminders[type];
  
  const newTimes = [...currentReminder.customTimes];
  newTimes[index] = newTime;
  
  setReminders(prev => ({
    ...prev,
    [type]: {
      ...prev[type],
      customTimes: newTimes
    }
  }));

};
const saveReminders = async () => {
  if (!auth.currentUser) {
    Alert.alert('Error', 'You must be logged in to save reminders.');
    return;
  }

  try {
    // Clean the reminder data to remove undefined values
    const cleanedReminders = cleanReminderData(reminders);
    
    const reminderData = {
      childId,
      reminders: cleanedReminders,
      aiConsent,
      expoPushToken: expoPushToken || '',
      userId: auth.currentUser.uid,
      updatedAt: new Date().toISOString()
    };
    
    console.log('Saving cleaned reminder data:', reminderData);
    
    await setDoc(doc(db, 'reminders', childId), reminderData);
    
    // Count enabled reminders
    const enabledCount = Object.values(reminders)
      .filter(r => r.enabled).length;
    
    Alert.alert(
      'Settings Saved!', 
      `${enabledCount} reminder${enabledCount !== 1 ? 's' : ''} configured.\n\nReminders are saved but not scheduled yet.\n\nUse "Send Now" buttons to test each reminder type.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  } catch (error) {
    console.error('Error saving reminders:', error);
    Alert.alert('Error', 'Failed to save reminders. Please try again.');
  }
};

  return (
    <LinearGradient 
      colors={theme.backgroundGradient} 
      start={{ x: 0, x: 0.5 }} 
      end={{ y: 1, y: 0.5 }}
      style={styles.gradient}
    >
      <View style={styles.container}>
        {/* Header - Now with proper dark mode support */}
        <View style={[styles.header, { backgroundColor: darkMode ? 'transparent' : 'transparent' }]}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <BlurView intensity={20} tint={darkMode ? "dark" : "light"} style={styles.backButtonBlur}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity onPress={saveReminders} style={[styles.saveButtonContainer, { backgroundColor: darkMode ? '#667eea' : '#007AFF' }]}>
            <Text style={styles.saveButton}>Save</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: theme.textPrimary }]}>{name}'s Reminders</Text>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* AI Consent Section */}
          <View style={[styles.aiConsentContainer, { backgroundColor: darkMode ? '#2c2c2c' : '#FFF' }]}>
            <View style={styles.consentHeader}>
              <MaterialCommunityIcons name="robot" size={24} color="#FF9800" />
              <Text style={[styles.consentTitle, { color: theme.textPrimary }]}>AI-Powered Smart Scheduling</Text>
            </View>
            <Text style={[styles.consentDescription, { color: theme.textSecondary }]}>
              Enable AI to analyze your baby's care patterns and suggest optimal reminder times.
            </Text>
            <View style={styles.consentRow}>
              <Text style={[styles.consentLabel, { color: theme.textPrimary }]}>Enable AI scheduling assistance</Text>
              <Switch
                value={aiConsent}
                onValueChange={(value) => {
                  if (value) {
                    setShowAiConsentModal(true);
                  } else {
                    handleAiConsentToggle(false);
                  }
                }}
                trackColor={{ false: '#D0D0D0', true: '#FFA726' }}
                thumbColor={aiConsent ? '#FFFFFF' : '#F4F4F4'}
                ios_backgroundColor="#D0D0D0"
              />
            </View>
          </View>

          {/* Reminder Cards */}
          {reminderTypes.map((reminderType) => (
            <ReminderCard
              key={reminderType.key}
              reminder={reminderType}
              type={reminderType.key}
              reminders={reminders}
              setReminders={setReminders}
              toggleReminder={toggleReminder}
              toggleAI={toggleAI}
              sendImmediateReminder={sendImmediateReminder}
              openTimePicker={openTimePicker}
              aiConsent={aiConsent}
              aiLoading={aiLoading}
              reminderTypes={reminderTypes}
              darkMode={darkMode}
              theme={theme}
            />
          ))}
          <View style={styles.bottomPadding} />

          {/* Schedule Notifications Button */}
          {Object.values(reminders).some(r => r.enabled) && (
            <View style={styles.scheduleSection}>
              <View style={[
                styles.scheduleInfoBox,
                { backgroundColor: darkMode ? '#2c2c2c' : '#F0F7FF' }
              ]}>
                <MaterialCommunityIcons 
                  name="information-outline" 
                  size={20} 
                  color={darkMode ? '#64B5F6' : '#1976D2'} 
                />
                <Text style={[
                  styles.scheduleInfoText,
                  { color: darkMode ? '#B0B0B0' : '#666' }
                ]}>
                  Your reminders are configured but not scheduled yet. 
                  Tap below to schedule notifications at your chosen times.
                </Text>
              </View>
              
              <TouchableOpacity 
                style={[
                  styles.scheduleAllButton,
                  { backgroundColor: darkMode ? '#667eea' : '#007AFF' }
                ]}
                onPress={async () => {
                  Alert.alert(
                    'Schedule Notifications?',
                    'This will schedule all enabled reminders to send at their designated times daily.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Schedule Now', 
                        onPress: async () => {
                          try {
                            // Cancel existing
                            for (const [type, reminder] of Object.entries(reminders)) {
                              if (reminder.notificationIds?.length > 0) {
                                await cancelNotifications(reminder.notificationIds);
                              }
                            }
                            
                            // Schedule new
                            const updatedReminders = { ...reminders };
                            let totalScheduled = 0;
                            
                            for (const [type, reminder] of Object.entries(reminders)) {
                              if (reminder.enabled) {
                                const timesToUse = reminder.useAI && reminder.aiRecommendedTimes.length > 0
                                  ? reminder.aiRecommendedTimes 
                                  : reminder.customTimes;
                                
                                const notificationIds = await scheduleNotifications(type, timesToUse, reminder.useAI);
                                updatedReminders[type] = { ...reminder, notificationIds };
                                totalScheduled += notificationIds.length;
                              }
                            }
                            
                            setReminders(updatedReminders);
                            
                            Alert.alert(
                              '✅ Notifications Scheduled!', 
                              `${totalScheduled} notification${totalScheduled !== 1 ? 's' : ''} will be sent at your specified times daily.\n\nUse "Send Now" buttons to test.`
                            );
                          } catch (error) {
                            console.error('Error scheduling:', error);
                            Alert.alert('Error', 'Failed to schedule notifications. Please try again.');
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <MaterialCommunityIcons name="calendar-clock" size={20} color="#FFF" />
                <Text style={styles.scheduleAllButtonText}>Schedule All Notifications</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <AIConsentModal />

        {/* Time Picker Modal */}
        {showTimePicker && (
          <Modal transparent visible={showTimePicker} animationType="slide">
            <TouchableOpacity 
              style={styles.modalOverlay} 
              activeOpacity={1} 
              onPress={() => {
                if (Platform.OS === 'android') {
                  setShowTimePicker(false);
                }
              }}
            >
              <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                <View style={[styles.timePickerModal, { 
                  backgroundColor: darkMode ? '#2c2c2c' : '#FFF',
                  borderWidth: darkMode ? 1 : 0,
                  borderColor: darkMode ? '#444' : 'transparent'
                }]}>
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Select Reminder Time</Text>
                  <View style={styles.timePickerContainer}>
                    <DateTimePicker
                      value={tempTime}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleTimeChange}
                      textColor={theme.textPrimary}
                    />
                  </View>
                  {Platform.OS === 'ios' && (
                    <View style={styles.modalButtons}>
                      <TouchableOpacity 
                        style={[styles.modalButton, { backgroundColor: darkMode ? '#444' : '#F0F0F0' }]}
                        onPress={() => {
                          setShowTimePicker(false);
                          setCurrentEditingType(null);
                        }}
                      >
                        <Text style={[styles.modalButtonText, { color: theme.textPrimary }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.modalButton, styles.confirmButton]}
                        onPress={confirmTimeChange}
                      >
                        <Text style={[styles.modalButtonText, styles.confirmButtonText]}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
  },
  backButtonBlur: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  saveButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 16,
  },
  saveButton: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  aiConsentContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  consentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  consentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#333',
  },
  consentDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 15,
  },
  consentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  consentLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  reminderCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  reminderHeader: {
    marginBottom: 8,
  },
  reminderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  reminderDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  reminderSettings: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  sendNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  sendNowText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  timeText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  aiPatternContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  aiPatternContent: {
    marginLeft: 8,
    flex: 1,
  },
  aiPatternText: {
    fontSize: 14,
    color: '#FF9800',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  aiTimeText: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 4,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
timePickerModal: {
  backgroundColor: '#FFF',
  borderRadius: 16,
  padding: 20,
  minWidth: 300,
  maxWidth: 340,
  alignSelf: 'center',
},
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    fontSize: 16,
    color: '#333',
  },
  confirmButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  // Add these to your existing styles object
statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  quickActionsRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  insightsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFF3E0',
    flex: 1,
  },
  insightsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    color: '#FF9800',
  },
  settingLabelContainer: {
    marginLeft: 8,
    flex: 1,
  },
  settingSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  loadingIndicator: {
    marginRight: 8,
  },
  aiSection: {
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 3,
  },
  aiMainInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  aiMainContent: {
    marginLeft: 8,
    flex: 1,
  },
  aiTimesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  aiTimeChip: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiTimeText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#666',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  confidenceText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold',
  },
  expandedInsights: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFE0B2',
  },
  insightsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 8,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  insightText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    lineHeight: 18,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E8F5E8',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#2E7D32',
    marginLeft: 6,
    flex: 1,
    fontStyle: 'italic',
    lineHeight: 18,
  },
aiConsentModal: {
  backgroundColor: '#FFF',
  borderRadius: 20,
  margin: 20,
  maxHeight: '80%',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 8,
  elevation: 8,
},
modalHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 20,
  paddingBottom: 10,
  borderBottomWidth: 1,
  borderBottomColor: '#F0F0F0',
},
modalHeaderText: {
  fontSize: 20,
  fontWeight: 'bold',
  marginLeft: 12,
  color: '#333',
},
consentModalContent: {
  padding: 20,
  maxHeight: 400,
},
consentModalTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#333',
  marginBottom: 10,
},
consentModalText: {
  fontSize: 14,
  color: '#666',
  lineHeight: 20,
  marginBottom: 15,
},
consentSection: {
  marginBottom: 20,
},
consentSectionTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#333',
  marginBottom: 8,
},
modalButtons: {
  flexDirection: 'row',
  padding: 20,
  paddingTop: 10,
  borderTopWidth: 1,
  borderTopColor: '#F0F0F0',
},
modalCancelButton: {
  flex: 1,
  paddingVertical: 12,
  paddingHorizontal: 20,
  backgroundColor: '#F5F5F5',
  borderRadius: 8,
  marginRight: 10,
},
modalAcceptButton: {
  flex: 1,
  paddingVertical: 12,
  paddingHorizontal: 20,
  backgroundColor: '#FF9800',
  borderRadius: 8,
  marginLeft: 10,
},
modalCancelButtonText: {
  textAlign: 'center',
  fontSize: 16,
  fontWeight: '600',
  color: '#666',
},
modalAcceptButtonText: {
  textAlign: 'center',
  fontSize: 16,
  fontWeight: '600',
  color: '#FFF',
},
privacyInfoButton: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 10,
  padding: 8,
},
privacyInfoText: {
  fontSize: 12,
  color: '#666',
  marginLeft: 4,
  textDecorationLine: 'underline',
},
manualTimesSection: {
  marginTop: 8,
},
manualTimesSectionHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 8,
},
sectionHeaderText: {
  fontSize: 14,
  fontWeight: '600',
  color: '#666',
  marginLeft: 6,
},
manualTimeContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 12,
  borderRadius: 8,
  marginBottom: 8,
  borderLeftWidth: 3,
  borderLeftColor: '#4CAF50',
},
timeActions: {
  flexDirection: 'row',
  gap: 8,
},
editTimeButton: {
  backgroundColor: '#007AFF',
  width: 28,
  height: 28,
  borderRadius: 14,
  justifyContent: 'center',
  alignItems: 'center',
},
deleteTimeButton: {
  backgroundColor: '#F44336',
  width: 28,
  height: 28,
  borderRadius: 14,
  justifyContent: 'center',
  alignItems: 'center',
},
addTimeButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 10,
  marginTop: 8,
  marginBottom: 12,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#4CAF50',
  borderStyle: 'dashed',
},
addTimeButtonText: {
  fontSize: 14,
  fontWeight: '600',
  color: '#4CAF50',
  marginLeft: 6,
},
timePickerContainer: {
  backgroundColor: 'transparent',
  borderRadius: 12,
  overflow: 'hidden',
  marginVertical: 10,
},
aiInfoNote: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 8,
  borderRadius: 6,
  marginTop: 8,
  marginBottom: 8,
},
aiInfoNoteText: {
  fontSize: 12,
  color: '#F57C00',
  marginLeft: 6,
  flex: 1,
  lineHeight: 16,
},
confidenceExplanation: {
  fontSize: 11,
  color: '#E65100',
  fontStyle: 'italic',
  marginTop: 4,
  width: '100%',
},
nextReminderContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 8,
  paddingVertical: 6,
  borderRadius: 6,
  marginTop: 8,
  marginBottom: 4,
},
nextReminderText: {
  fontSize: 12,
  fontWeight: '600',
  marginLeft: 6,
  flex: 1,
},
improvementTipContainer: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  padding: 8,
  borderRadius: 6,
  marginTop: 8,
  gap: 6,
},
improvementTipText: {
  fontSize: 11,
  flex: 1,
  lineHeight: 16,
},
scheduleSection: {
  marginTop: 20,
  marginBottom: 10,
},
scheduleInfoBox: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  padding: 12,
  borderRadius: 12,
  marginBottom: 12,
  gap: 10,
},
scheduleInfoText: {
  flex: 1,
  fontSize: 13,
  lineHeight: 18,
},
scheduleAllButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#007AFF',
  padding: 16,
  borderRadius: 12,
  gap: 8,
},
scheduleAllButtonText: {
  color: '#FFF',
  fontSize: 16,
  fontWeight: '600',
},
});