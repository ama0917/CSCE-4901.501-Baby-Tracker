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

const OPENAI_API_KEY = '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';
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const formatTime12Hour = (time24) => {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
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

const ReminderCard = ({ reminder, type, reminders, setReminders, toggleReminder, toggleAI, sendImmediateReminder, openTimePicker, aiConsent, aiLoading, reminderTypes }) => {
  const currentReminder = reminders[type];
  const [showInsights, setShowInsights] = useState(false);
  
  return (
    <View style={styles.reminderCard}>
      <View style={styles.reminderHeader}>
        <View style={styles.reminderTitleRow}>
          <View style={[styles.iconContainer, { backgroundColor: reminder.color + '20' }]}>
            <MaterialCommunityIcons name={reminder.icon} size={24} color={reminder.color} />
          </View>
          <View style={styles.reminderInfo}>
            <Text style={styles.reminderTitle}>{reminder.title}</Text>
            <Text style={styles.reminderDescription}>{reminder.description}</Text>
            {currentReminder.enabled && (
              <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: reminder.color }]} />
                <Text style={styles.statusText}>
                  {currentReminder.useAI ? 'AI-Optimized' : 'Manual Schedule'}
                </Text>
              </View>
            )}
          </View>
          <Switch
            value={currentReminder.enabled}
            onValueChange={() => toggleReminder(type)}
            trackColor={{ false: '#E0E0E0', true: reminder.color + '40' }}
            thumbColor={currentReminder.enabled ? reminder.color : '#F4F4F4'}
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
                style={styles.insightsButton}
                onPress={() => setShowInsights(!showInsights)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons 
                  name={showInsights ? "chevron-up" : "lightbulb-outline"} 
                  size={16} 
                  color="#FF9800" 
                />
                <Text style={styles.insightsButtonText}>
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
                <Text style={styles.settingLabel}>Manual Time Setting</Text>
                <Text style={styles.settingSubtext}>Set specific reminder times</Text>
              </View>
            </View>
            <Switch
              value={!currentReminder.useAI}
              onValueChange={() => {
                if (currentReminder.useAI) {
                  toggleAI(type); // Turn off AI, turn on manual
                }
              }}
              trackColor={{ false: '#E0E0E0', true: '#FFF9C4' }}
              thumbColor={!currentReminder.useAI ? '#F9A825' : '#F4F4F4'}
              disabled={!aiConsent || aiLoading}
            />
          </View>

          {currentReminder.useAI && currentReminder.enabled && (
            <View style={styles.aiInfoNote}>
              <MaterialCommunityIcons name="information-outline" size={14} color="#FF9800" />
              <Text style={styles.aiInfoNoteText}>
                AI times are loaded. Click "Send Now" to test or "Save" to schedule.
              </Text>
            </View>
          )}

          {!currentReminder.useAI && currentReminder.customTimes && (
            <View style={styles.manualTimesSection}>
              <View style={styles.manualTimesSectionHeader}>
                <MaterialCommunityIcons name="clock" size={16} color="#666" />
                <Text style={styles.sectionHeaderText}>Reminder Times:</Text>
              </View>
              {currentReminder.customTimes.map((time, index) => (
                <View key={index} style={styles.manualTimeContainer}>
                  <Text style={styles.timeText}>{formatTime12Hour(time)}</Text>
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
                <Text style={styles.settingLabel}>
                  AI Pattern Recognition
                </Text>
                <Text style={styles.settingSubtext}>
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
              trackColor={{ false: '#E0E0E0', true: '#FFF9C4' }}
              thumbColor={currentReminder.useAI ? '#F9A825' : '#F4F4F4'}
              disabled={!aiConsent || aiLoading}
            />
          </View>

          {/* AI Insights Section */}
          {currentReminder.useAI && aiConsent && currentReminder.aiRecommendedTimes && (
            <View style={styles.aiSection}>
              <View style={styles.aiMainInfo}>
                <MaterialCommunityIcons name="robot" size={16} color="#FF9800" />
                <View style={styles.aiMainContent}>
                  <Text style={styles.aiPatternText}>{currentReminder.aiPattern}</Text>
                  <View style={styles.aiTimesContainer}>
                    {currentReminder.aiRecommendedTimes.map((time, index) => (
                      <View key={index} style={styles.aiTimeChip}>
                        <Text style={styles.aiTimeText}>{formatTime12Hour(time)}</Text>
                      </View>
                    ))}
                  </View>
                  {currentReminder.confidence && (
                    <View style={styles.confidenceContainer}>
                      <Text style={styles.confidenceLabel}>Data Quality: </Text>
                      <View style={[
                        styles.confidenceBadge,
                        { backgroundColor: getConfidenceColor(currentReminder.confidence) }
                      ]}>
                        <Text style={styles.confidenceText}>
                          {currentReminder.confidence === 'high' ? 'EXCELLENT' : 
                          currentReminder.confidence === 'medium' ? 'GOOD' : 'BUILDING'}
                        </Text>
                      </View>
                      <Text style={styles.confidenceExplanation}>
                        {currentReminder.confidence === 'high' ? ' - Strong pattern detected' : 
                        currentReminder.confidence === 'medium' ? ' - Pattern forming' : 
                        ' - Keep logging for better predictions'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Expandable Insights */}
              {showInsights && currentReminder.insights && (
                <View style={styles.expandedInsights}>
                  <Text style={styles.insightsTitle}>AI Analysis</Text>
                  {currentReminder.insights.map((insight, index) => (
                    <View key={index} style={styles.insightRow}>
                      <MaterialCommunityIcons name="circle-small" size={16} color="#FF9800" />
                      <Text style={styles.insightText}>{insight}</Text>
                    </View>
                  ))}
                  {currentReminder.parentTip && (
                    <View style={styles.tipContainer}>
                      <MaterialCommunityIcons name="lightbulb" size={16} color="#4CAF50" />
                      <Text style={styles.tipText}>{currentReminder.parentTip}</Text>
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
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;
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
      
      // Migrate old data structure to new structure
      const migratedReminders = {};
      for (const [key, reminder] of Object.entries(loadedReminders)) {
        migratedReminders[key] = {
          ...reminder,
          // Convert old customTime to new customTimes array
          customTimes: reminder.customTimes 
            ? reminder.customTimes 
            : (reminder.customTime ? [reminder.customTime] : ['12:00'])
        };
      }
      
      setReminders(migratedReminders);
      setAiConsent(data.aiConsent || false);
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
// Replace the getChildHistoricalData function with this improved version:
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
      
      if (!timestampField) {
        console.warn(`Missing timestamp field ${reminderConfig.timestampField} in document:`, doc.id);
        return;
      }

      let timestamp;

      try {
        if (typeof timestampField.toDate === 'function') {
          // Firestore Timestamp object
          timestamp = timestampField.toDate();
        } else if (
          timestampField &&
          typeof timestampField === 'object' &&
          typeof timestampField.seconds === 'number'
        ) {
          // Plain object from Firestore with seconds
          timestamp = new Date(timestampField.seconds * 1000);
        } else if (timestampField instanceof Date) {
          timestamp = timestampField;
        } else if (typeof timestampField === 'string') {
          timestamp = new Date(timestampField);
        } else if (typeof timestampField === 'number') {
          // Unix timestamp
          timestamp = new Date(timestampField);
        } else {
          console.warn('Unrecognized timestamp format:', timestampField);
          return;
        }

        // Validate the resulting timestamp
        if (!timestamp || isNaN(timestamp.getTime())) {
          console.warn('Invalid timestamp created from:', timestampField);
          return;
        }
        
        logs.push({
          id: doc.id,
          timestamp,
          ...data
        });
      } catch (error) {
        console.error('Error processing timestamp for doc:', doc.id, error);
      }
    });

    console.log(`Successfully fetched ${logs.length} valid logs for ${reminderType} analysis`);
    return logs.sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first
  } catch (error) {
    console.error('Error fetching historical data:', error);
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
              • Your baby's feeding, sleep, and diaper change timestamps are sent to OpenAI's servers for analysis{'\n'}
              • Data is used only to generate personalized scheduling recommendations{'\n'}
              • No personal information (names, locations) is included in the analysis
            </Text>
          </View>
          
          <View style={styles.consentSection}>
            <Text style={styles.consentSectionTitle}>Privacy & Security:</Text>
            <Text style={styles.consentModalText}>
              • Data transmission is encrypted and secure{'\n'}
              • OpenAI may retain data for up to 30 days per their policy{'\n'}
              • You can disable AI analysis at any time{'\n'}
              • Local pattern analysis is available as an alternative
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
  try {
    console.log('Making OpenAI API request...');
    
    if (!OPENAI_API_KEY || !OPENAI_API_KEY.startsWith('sk-')) {
      throw new Error('Invalid API key format. OpenAI API keys should start with "sk-"');
    }

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
            content: 'You are a helpful assistant for baby care scheduling. You must respond with ONLY valid JSON, no additional text or formatting.' 
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

// Enhanced local analysis as a reliable fallback
const generateLocalRecommendations = (analysisData, reminderType, dataCount) => {
  const { topHours, avgInterval, distribution, totalEntries } = analysisData;
  
  let confidence = 'low';
  if (totalEntries >= 10) confidence = 'medium';
  if (totalEntries >= 20) confidence = 'high';
  
  const getTypeSpecificInsights = (type, hours, interval, count) => {
    switch (type) {
      case 'feeding':
        return [
          `Your baby typically feeds at ${hours.slice(0, 2).join(' and ')} based on ${count} feeding logs`,
          `Average ${interval} hours between feedings suggests a good routine`,
          count < 10 ? 'More feeding data will improve recommendations' : 'Feeding pattern is well established'
        ];
      case 'diaper':
        return [
          `Diaper changes most needed around ${hours.slice(0, 2).join(' and ')}`,
          `${interval}-hour intervals between changes is typical`,
          'Regular timing helps maintain comfort and hygiene'
        ];
      case 'nap':
        return [
          `Best nap times appear to be ${hours.slice(0, 2).join(' and ')}`,
          `${interval} hours between sleep periods follows natural rhythms`,
          'Consistent nap timing supports better nighttime sleep'
        ];
      default:
        return ['Pattern analysis based on your data', 'Timing shows developing routine', 'Consistency will improve outcomes'];
    }
  };

  const getParentTip = (type) => {
    const tips = {
      feeding: 'Watch for hunger cues 15-30 minutes before scheduled feeding times',
      diaper: 'Check diapers before and after feeds, and when baby seems fussy',
      nap: 'Look for sleepy cues like yawning or rubbing eyes before nap times'
    };
    return tips[type] || 'Maintain consistent timing to help establish healthy routines';
  };
  
  return {
    times: topHours.slice(0, 3),
    explanation: `Local analysis of ${totalEntries} ${reminderType} entries shows optimal times`,
    frequency: 'daily',
    confidence,
    insights: getTypeSpecificInsights(reminderType, topHours, avgInterval, totalEntries),
    parentTip: getParentTip(reminderType),
    nextOptimization: 'Review patterns weekly as routines develop'
  };
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

    const analysisData = prepareAnalysisData(historicalData, reminderType);
    console.log('Analysis data prepared:', analysisData);
    
    // Fixed prompt without placeholder examples
    const prompt = `You are analyzing a baby's ${reminderType} patterns. Based on this data, provide specific recommendations.

Data Analysis:
- Total entries: ${historicalData.length} ${reminderType} records
- Most common times: ${analysisData.topHours.join(', ')}
- Average interval: ${analysisData.avgInterval} hours
- Pattern type: ${analysisData.distribution}

Respond with valid JSON only:
{
  "times": [actual recommended times based on the data],
  "explanation": "specific analysis of what the data shows",
  "frequency": "daily",
  "confidence": "low/medium/high based on data quality",
  "insights": [
    "specific observation about timing patterns",
    "specific observation about frequency patterns", 
    "specific recommendation for improvement"
  ],
  "nextOptimization": "when to review these recommendations",
  "parentTip": "practical advice based on the specific patterns found"
}

Use the actual data provided above. Do not use placeholder text.`;

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
      
      // Validate that we don't have placeholder text
      if (parsed.insights && parsed.insights.some(insight => 
          insight.includes('insight 1') || 
          insight.includes('insight 2') || 
          insight.includes('insight 3'))) {
        throw new Error('AI returned placeholder text instead of actual insights');
      }
      
      if (!parsed.times || !Array.isArray(parsed.times)) {
        throw new Error('Invalid response structure: missing or invalid times array');
      }
      
      setAiLoading(false);
      return {
        ...parsed,
        rawData: analysisData
      };
    } catch (apiError) {
      console.log(`AI API failed for ${reminderType}, using local analysis:`, apiError.message);
      const localResult = generateLocalRecommendations(analysisData, reminderType, historicalData.length);
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
// Replace the prepareAnalysisData function with this safer version:
const prepareAnalysisData = (data, reminderType) => {
  const hourCounts = {};
  const intervals = [];
  const dayPatterns = {};

  // Filter out entries without valid timestamps first
  const validData = data.filter(entry => {
    return entry.timestamp && 
           entry.timestamp instanceof Date && 
           !isNaN(entry.timestamp.getTime());
  });

  console.log(`Analyzing ${validData.length} valid entries out of ${data.length} total for ${reminderType}`);

  if (validData.length === 0) {
    return {
      topHours: ['12:00'],
      avgInterval: 3,
      distribution: 'no valid data',
      patterns: 'insufficient data',
      totalEntries: 0,
      daySpread: 0
    };
  }

  validData.forEach((entry, index) => {
    try {
      const hour = entry.timestamp.getHours();
      const day = entry.timestamp.getDay(); // 0-6 (Sunday-Saturday)
      
      if (hour >= 0 && hour <= 23) {
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
      
      if (day >= 0 && day <= 6) {
        dayPatterns[day] = (dayPatterns[day] || 0) + 1;
      }

      // Calculate intervals only with valid consecutive entries
      if (index > 0 && validData[index - 1].timestamp) {
        const intervalHours = Math.abs(entry.timestamp - validData[index - 1].timestamp) / (1000 * 60 * 60);
        if (intervalHours > 0 && intervalHours < 24) { // Increased max interval to 24 hours
          intervals.push(intervalHours);
        }
      }
    } catch (error) {
      console.warn(`Error processing entry at index ${index}:`, error);
    }
  });

  // Get top 3 hours, fallback to common times if no data
  const topHours = Object.keys(hourCounts).length > 0 
    ? Object.entries(hourCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([hour]) => `${hour.toString().padStart(2, '0')}:00`)
    : getDefaultTopHours(reminderType);

  const avgInterval = intervals.length > 0 
    ? (intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(1)
    : getDefaultInterval(reminderType);

  return {
    topHours,
    avgInterval,
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

  // Schedule multiple notifications for AI recommendations
const scheduleNotifications = async (reminderType, times, useAI = false) => {
  const reminder = reminderTypes.find(r => r.key === reminderType);
  const notificationIds = [];
  const currentReminder = reminders[reminderType];
  
  for (const time of times) {
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create trigger for daily repeat at specific time
    const trigger = {
      hour: hours,
      minute: minutes,
      repeats: true,
    };

    // Create notification content (same as before)
    let notificationBody;
    if (useAI && currentReminder?.aiPattern) {
      const timeFormatted = formatTime12Hour(time);
      
      switch (reminderType) {
        case 'feeding':
          notificationBody = currentReminder.confidence === 'high'
            ? `${timeFormatted}: Perfect time for ${name}'s feeding based on their routine! 🍼`
            : `${timeFormatted}: AI suggests feeding time for ${name} based on recent patterns.`;
          break;
        case 'diaper':
          notificationBody = currentReminder.confidence === 'high'
            ? `${timeFormatted}: Time for ${name}'s diaper check - staying ahead of their schedule! 👶`
            : `${timeFormatted}: AI recommends checking ${name}'s diaper based on timing patterns.`;
          break;
        case 'nap':
          notificationBody = currentReminder.confidence === 'high'
            ? `${timeFormatted}: ${name} is likely getting sleepy - optimal nap time! 😴`
            : `${timeFormatted}: AI suggests nap time for ${name} based on sleep patterns.`;
          break;
        default:
          notificationBody = `AI suggests it's time for ${reminder.title.toLowerCase()}. Based on ${name}'s patterns.`;
      }
      
      if (currentReminder.parentTip) {
        notificationBody += `\n💡 Tip: ${currentReminder.parentTip}`;
      }
    } else {
      const timeFormatted = formatTime12Hour(time);
      notificationBody = `${timeFormatted}: Time for ${name}'s ${reminder.title.toLowerCase()}!`;
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: useAI 
            ? `🤖 Smart Reminder: ${reminder.title}` 
            : `${name}'s ${reminder.title} Reminder`,
          body: notificationBody,
          data: { 
            childId, 
            reminderType, 
            useAI,
            time,
            confidence: currentReminder?.confidence,
            aiPattern: currentReminder?.aiPattern
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          badge: 1,
        },
        trigger, // This ensures it only fires at the scheduled time, not immediately
      });
      
      notificationIds.push(notificationId);
      console.log(`Scheduled ${reminderType} notification for ${time}`);
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  }

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
      trigger: null, // Send immediately
    });

    Alert.alert('Reminder Sent!', `Immediate ${reminder.title.toLowerCase()} reminder sent.`);
  } catch (error) {
    console.error('Error sending immediate reminder:', error);
    Alert.alert('Error', 'Failed to send reminder notification.');
  }
};

  const toggleReminder = async (type) => {
    const currentReminder = reminders[type];
    const newEnabled = !currentReminder.enabled;

    if (newEnabled) {
      // Schedule notifications
      setReminders(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          enabled: true,
          notificationIds: []
        }
      }));
    } else {
      // Cancel notifications
      await cancelNotifications(currentReminder.notificationIds);
      
      setReminders(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          enabled: false,
          notificationIds: []
        }
      }));
    }
  };

const toggleAI = async (type) => {
  if (!aiConsent) {
    Alert.alert(
      'AI Consent Required',
      'Please enable AI consent first to use AI-powered reminder patterns.',
      [{ text: 'OK' }]
    );
    return;
  }

  const currentReminder = reminders[type];
  const newUseAI = !currentReminder.useAI;

  if (newUseAI) {
    // Get AI recommendations with enhanced data
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
  } else {
    // Switch back to manual mode
    setReminders(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        useAI: false
      }
    }));
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

  // Note: Don't reschedule here - wait for user to save
};
const saveReminders = async () => {
  if (!auth.currentUser) {
    Alert.alert('Error', 'You must be logged in to save reminders.');
    return;
  }

  try {
    // Schedule notifications for all enabled reminders
    const updatedReminders = { ...reminders };
    
    for (const [type, reminder] of Object.entries(reminders)) {
      if (reminder.enabled) {
        // Cancel existing notifications first
        if (reminder.notificationIds.length > 0) {
          await cancelNotifications(reminder.notificationIds);
        }
        
        // Schedule new notifications based on current settings
        const timesToUse = reminder.useAI && reminder.aiRecommendedTimes.length > 0
          ? reminder.aiRecommendedTimes 
          : reminder.customTimes;
        
        const notificationIds = await scheduleNotifications(type, timesToUse, reminder.useAI);
        
        // Clean the reminder object to remove undefined fields
        updatedReminders[type] = {
          enabled: reminder.enabled,
          useAI: reminder.useAI,
          customTimes: reminder.customTimes || ['12:00'],
          aiPattern: reminder.aiPattern || '',
          notificationIds,
          aiRecommendedTimes: reminder.aiRecommendedTimes || [],
          frequency: reminder.frequency || 'daily',
          // Only include optional fields if they exist
          ...(reminder.confidence && { confidence: reminder.confidence }),
          ...(reminder.insights && { insights: reminder.insights }),
          ...(reminder.parentTip && { parentTip: reminder.parentTip }),
          ...(reminder.nextOptimization && { nextOptimization: reminder.nextOptimization })
        };
      }
    }
    
    setReminders(updatedReminders);
    
    const reminderData = {
      childId,
      reminders: updatedReminders,
      aiConsent,
      expoPushToken,
      userId: auth.currentUser.uid,
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'reminders', childId), reminderData);
    
    Alert.alert('Success', 'Reminder preferences saved and scheduled!', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  } catch (error) {
    console.error('Error saving reminders:', error);
    Alert.alert('Error', 'Failed to save reminders. Please try again.');
  }
};

  return (
    <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={styles.gradient}>
      <ThemedBackground>
        <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <BlurView intensity={20} tint="light" style={styles.backButtonBlur}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity onPress={saveReminders} style={styles.saveButtonContainer}>
            <Text style={styles.saveButton}>Save</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{name}'s Reminders</Text>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* AI Consent Section */}
    <View style={styles.aiConsentContainer}>
    <View style={styles.consentHeader}>
        <MaterialCommunityIcons name="robot" size={24} color="#FF9800" />
        <Text style={styles.consentTitle}>AI-Powered Smart Scheduling</Text>
    </View>
    <Text style={styles.consentDescription}>
        Enable AI to analyze your baby's care patterns and suggest optimal reminder times. 
        AI uses your historical data to identify patterns and recommend personalized schedules that adapt to your baby's natural rhythms.
    </Text>
    <View style={styles.consentRow}>
        <Text style={styles.consentLabel}>Enable AI scheduling assistance</Text>
        <Switch
        value={aiConsent}
        onValueChange={(value) => {
            if (value) {
            setShowAiConsentModal(true);
            } else {
            handleAiConsentToggle(false);
            }
        }}
        trackColor={{ false: '#E0E0E0', true: '#FF9800' }}
        thumbColor={aiConsent ? '#FF9800' : '#F4F4F4'}
        />
    </View>
    {aiConsent && (
        <TouchableOpacity 
        style={styles.privacyInfoButton}
        onPress={() => setShowAiConsentModal(true)}
        >
        <MaterialCommunityIcons name="information-outline" size={16} color="#666" />
        <Text style={styles.privacyInfoText}>View privacy & data usage details</Text>
        </TouchableOpacity>
    )}
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
            />
          ))}
          <View style={styles.bottomPadding} />
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
        <View style={styles.timePickerModal}>
          <Text style={styles.modalTitle}>Select Reminder Time</Text>
          <View style={styles.timePickerContainer}>
            <DateTimePicker
              value={tempTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
              textColor="#000000"
              themeVariant="light"
            />
          </View>
          {Platform.OS === 'ios' && (
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => {
                  setShowTimePicker(false);
                  setCurrentEditingType(null);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
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
      </ThemedBackground>
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
    color: '#333',
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
  manualTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  loadingIndicator: {
    marginRight: 8,
  },
  aiSection: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
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
    marginTop: 8,
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#666',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
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
  backgroundColor: '#F8F9FA',
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
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  overflow: 'hidden',
  marginVertical: 10,
},
aiInfoNote: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FFF8E1',
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
  color: '#666',
  marginLeft: 4,
  fontStyle: 'italic',
},
});