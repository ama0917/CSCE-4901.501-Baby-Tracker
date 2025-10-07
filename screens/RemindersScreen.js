import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Switch } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Clock, Bot, User, Pill, Utensils, Baby, Moon, ChevronRight, Settings, Toilet } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';

export default function RemindersScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { childId, name } = route.params || {};

  const { darkMode } = useDarkMode();
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;

  const [reminders, setReminders] = useState({
    feeding: {
      enabled: false,
      useAI: false,
      customTime: '12:00',
      aiPattern: 'Every 3-4 hours'
    },
    diaper: {
      enabled: false,
      useAI: false,
      customTime: '10:00',
      aiPattern: 'Every 2-3 hours'
    },
    nap: {
      enabled: false,
      useAI: false,
      customTime: '14:00',
      aiPattern: 'Based on sleep patterns'
    }
  });

  const [aiConsent, setAiConsent] = useState(false);

  const reminderTypes = [
    {
      key: 'feeding',
      title: 'Feeding',
      icon: Utensils,
      color: '#4ECDC4',
      description: 'Never miss feeding time'
    },
    {
      key: 'diaper',
      title: 'Diaper Change',
      icon: Toilet,
      color: '#45B7D1',
      description: 'Stay on top of diaper changes'
    },
    {
      key: 'nap',
      title: 'Nap Time',
      icon: Moon,
      color: '#96CEB4',
      description: 'Maintain healthy sleep schedules'
    }
  ];

  const toggleReminder = (type) => {
    setReminders(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        enabled: !prev[type].enabled
      }
    }));
  };

  const toggleAI = (type) => {
    if (!aiConsent) {
      Alert.alert(
        'AI Consent Required',
        'Please enable AI consent first to use AI-powered reminder patterns.',
        [{ text: 'OK' }]
      );
      return;
    }

    setReminders(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        useAI: !prev[type].useAI
      }
    }));
  };

  const handleAiConsentToggle = (value) => {
    if (!value) {
      // If disabling AI consent, disable AI for all reminders
      setReminders(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          updated[key].useAI = false;
        });
        return updated;
      });
    }
    setAiConsent(value);
  };

  const saveReminders = () => {
    // Here is where to save to Firebase!!
    Alert.alert('Success', 'Reminder preferences saved!', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  };

  const ReminderCard = ({ reminder, type }) => {
    const IconComponent = reminder.icon;
    
    return (
      <View style={[styles.reminderCard, {backgroundColor: darkMode ? '#1f1f1f' : '#fff'}
      ]}>
        <View style={styles.reminderHeader}>
          <View style={styles.reminderTitleRow}>
            <View style={[styles.iconContainer, { backgroundColor: reminder.color + '20' }]}>
              <IconComponent size={24} color={reminder.color} />
            </View>
            <View style={styles.reminderInfo}>
              <Text style={[styles.reminderTitle, { color: currentTheme.textPrimary }]}>{reminder.title}</Text>
              <Text style={[styles.reminderDescription, { color: currentTheme.textSecondary }]}>{reminder.description}</Text>
            </View>
            <Switch
              value={reminders[type].enabled}
              onValueChange={() => toggleReminder(type)}
              trackColor={{ false: '#E0E0E0', true: reminder.color + '40' }}
              thumbColor={reminders[type].enabled ? reminder.color : '#F4F4F4'}
            />
          </View>
        </View>
        
        {reminders[type].enabled && (
          <View style={styles.reminderSettings}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <User size={20} color={currentTheme.textSecondary}/> 
                <Text style={[styles.settingLabel, { color: currentTheme.textPrimary}]}>Manual Time Setting</Text>
              </View>
              <Switch
                value={!reminders[type].useAI}
                onValueChange={() => toggleAI(type)}
                trackColor={{ false: '#E0E0E0', true: '#4CAF50' }}
                thumbColor={!reminders[type].useAI ? '#4CAF50' : '#F4F4F4'}
              />
            </View>

            {!reminders[type].useAI && (
              <View style={[styles.timeContainer, {backgroundColor: darkMode ? '#2c2c2c' : '#f8f8f8'}]}>
                <Clock size={16} color={currentTheme.textSecondary} />
                <Text style={[styles.timeText, { color: currentTheme.textPrimary}]}>Time: {reminders[type].customTime}</Text>
                <TouchableOpacity style={styles.editButton}>
                  <ChevronRight size={16} color={currentTheme.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Bot size={20} color={currentTheme.textSecondary} />
                <Text style={[styles.settingLabel, {color: currentTheme.textPrimary}]}>AI Pattern Recognition</Text>
              </View>
              <Switch
                value={reminders[type].useAI}
                onValueChange={() => toggleAI(type)}
                trackColor={{ false: '#E0E0E0', true: '#FF9800' }}
                thumbColor={reminders[type].useAI ? '#FF9800' : '#F4F4F4'}
                disabled={!aiConsent}
              />
            </View>

            {reminders[type].useAI && aiConsent && (
              <View style={styles.aiPatternContainer}>
                <Bot size={16} color="#FF9800" />
                <Text style={styles.aiPatternText}>{reminders[type].aiPattern}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <ThemedBackground>
      <View style={styles.container}>
        <View style={styles.header}>
            <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
            >
                <BlurView intensity={20} tint={darkMode ? 'dark' : 'light'} style={styles.backButtonBlur}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={ darkMode ? '#fff' : "#333"} />
                </BlurView>
            </TouchableOpacity>
          <TouchableOpacity onPress={saveReminders}>
            <Text style={[styles.saveButton, { color: darkMode ? '#81D4FA' : '#007AFF'}]}>Save</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: currentTheme.textPrimary}]}>{name}'s Reminders</Text>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={[styles.aiConsentContainer, { backgroundColor: darkMode ? '#1f1f1f' : '#fff'}]}>
            <View style={styles.consentHeader}>
              <Bot size={24} color="#FF9800" />
              <Text style={[styles.consentTitle, { color: currentTheme.textPrimary}]}>AI Pattern Recognition</Text>
            </View>
            <Text style={[styles.consentDescription, { color: currentTheme.textSecondary}]}>
              Allow AI to analyze your child's patterns and suggest optimal reminder times based on historical data.
            </Text>
            <View style={styles.consentRow}>
              <Text style={[styles.consentLabel, { color: currentTheme.textPrimary}]}>I consent to AI analysis</Text>
              <Switch
                value={aiConsent}
                onValueChange={handleAiConsentToggle}
                trackColor={{ false: '#E0E0E0', true: '#FF9800' }}
                thumbColor={aiConsent ? '#FF9800' : '#F4F4F4'}
              />
            </View>
          </View>

          {reminderTypes.map((reminderType) => (
            <ReminderCard
              key={reminderType.key}
              reminder={reminderType}
              type={reminderType.key}
            />
          ))}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
    </ThemedBackground>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saveButton: {
    fontSize: 16,
    color: '#007AFF',
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
    backgroundColor: '#1454ddff',
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
    padding: 4,
  },
  aiPatternContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  aiPatternText: {
    fontSize: 14,
    color: '#FF9800',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  bottomPadding: {
    height: 20,
  },
});