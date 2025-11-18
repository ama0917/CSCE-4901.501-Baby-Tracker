// RegularReminders.js
import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Alert, StatusBar, SafeAreaView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';
import { ArrowLeft, Clock } from 'lucide-react-native';
import { db } from '../firebaseConfig';  // adjust path to your firebase config

const TAB_OPTIONS = ['Diapers', 'Feeding', 'Nap/Sleep'];

export default function RegularReminders({ navigation: navigationProp }) {
  const nav = navigationProp || useNavigation();
  const { darkMode } = useDarkMode();
  const theme = darkMode ? appTheme.dark : appTheme.light;

  const textPrimary = theme?.textPrimary || (darkMode ? '#FFFFFF' : '#2E3A59');
  const textSecondary = theme?.textSecondary || (darkMode ? '#9CA3AF' : '#7C8B9A');
  const cardBg = theme?.cardBackground || (darkMode ? '#0F172A' : '#FFFFFF');
  
  const [childrenList, setChildrenList] = useState([]);
  const [activeChildKey, setActiveChildKey] = useState(null); // unique key per child

  const [activeTab, setActiveTab] = useState(TAB_OPTIONS[0]);
  const [times, setTimes] = useState([null, null, null]); // 3 possible reminders
  const [showPickerIndex, setShowPickerIndex] = useState(null);
  const [tempTime, setTempTime] = useState(new Date());

  // Fetch children from top-level collection filtered by userId
  useEffect(() => {
    (async () => {
      try {
        const user = getAuth().currentUser;
        if (!user) {
          console.warn('No user signed in');
          return;
        }

        const childrenQuery = query(
          collection(db, 'children'),
          where('userId', '==', user.uid)
        );
        const snapshot = await getDocs(childrenQuery);
        const children = snapshot.docs.map(doc => ({
          id: doc.id,              // Firestore document ID
          userId: doc.data().userId,
          ...doc.data(),
        }));

        setChildrenList(children);

        if (children.length > 0) {
          const firstKey = `${children[0].userId}-${children[0].name}-0`;
          setActiveChildKey(prev => prev || firstKey);
        }
      } catch (e) {
        console.warn('Failed to fetch children from Firestore:', e);
      }
    })();
  }, []);

  // Load saved times whenever activeTab or activeChildKey changes
  useEffect(() => {
    (async () => {
      if (!activeChildKey) return;

      // Find the child object based on activeChildKey
      const activeChildIndex = childrenList.findIndex((child, index) =>
        `${child.userId}-${child.name}-${index}` === activeChildKey
      );
      if (activeChildIndex === -1) return;

      const activeChild = childrenList[activeChildIndex];
      const storageKey = `reminders:${activeChild.id}:${activeTab}`;

      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored).map(t => t ? new Date(t) : null);
          setTimes(parsed);
        } else {
          setTimes([null, null, null]);
        }
      } catch (e) {
        console.warn('Failed to load reminders:', e);
      }
    })();
  }, [activeTab, activeChildKey, childrenList]);

  const handleTimeChange = (event, selectedTime, index) => {
    setShowPickerIndex(null);
    if (selectedTime) {
      const newTimes = [...times];
      newTimes[index] = selectedTime;
      setTimes(newTimes);
    }
  };

  const scheduleNotifications = async () => {
    if (showPickerIndex !== null) {
      setShowPickerIndex(null);
    }

    if (!activeChildKey) {
      Alert.alert('Error', 'Please select a child before saving reminders.');
      return;
    }

    const activeChildIndex = childrenList.findIndex((child, index) =>
      `${child.userId}-${child.name}-${index}` === activeChildKey
    );
    if (activeChildIndex === -1) return;

    const activeChild = childrenList[activeChildIndex];
    const storageKey = `reminders:${activeChild.id}:${activeTab}`;
    const storageIdsKey = `remindersIds:${activeChild.id}:${activeTab}`;

    // Cancel previous notifications
    const storedIdsJson = await AsyncStorage.getItem(storageIdsKey);
    if (storedIdsJson) {
      const ids = JSON.parse(storedIdsJson);
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    }

    const newIds = [];
    for (const time of times) {
      if (!time) continue;
      const trigger = new Date(time);
      trigger.setSeconds(0);
      if (trigger < new Date()) {
        trigger.setDate(trigger.getDate() + 1);
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${activeTab} Reminder for ${activeChild.name}`, // <-- Child's name added here
          body: `Time for ${activeTab.toLowerCase()}!`,
          sound: true,
        },
        trigger,
      });
      newIds.push(id);
    }

    await AsyncStorage.setItem(storageKey, JSON.stringify(times));
    await AsyncStorage.setItem(storageIdsKey, JSON.stringify(newIds));

    Alert.alert('Reminders Saved', `Your ${activeTab.toLowerCase()} reminders have been scheduled for ${activeChild.name}.`);
  };

  const confirmTime = () => {
    if (showPickerIndex === null) return;
    const updated = [...times];
    updated[showPickerIndex] = tempTime;
    setTimes(updated);
    setShowPickerIndex(null);
  };

  return (
    <ThemedBackground>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() =>
                  nav?.canGoBack()
                    ? nav.goBack()
                    : nav.navigate('Settings')
                }
                style={styles.headerButton}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={
                    darkMode
                      ? ['#020617', '#1E293B']
                      : ['#FFFFFF', '#E3F2FD']
                  }
                  style={styles.headerButtonGradient}
                >
                  <ArrowLeft size={20} color={darkMode ? '#FFFFFF' : textPrimary} />
                </LinearGradient>
              </TouchableOpacity>

              <Text style={[styles.headerTitle, { color: textPrimary }]}>
                Regular Reminders
              </Text>

              {/* Spacer */}
              <View style={{ width: 44 }} />
            </View>

            {/* Intro */}
            <View style={styles.introBlock}>
              <Text style={[styles.introTitle, { color: textPrimary }]}>
                Create calm, predictable routines
              </Text>
              <Text style={[styles.introSubtitle, { color: textSecondary }]}>
                Choose a child, pick what to track, and set up up to three daily reminders.
              </Text>
            </View>

            {/* Child Selector */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: textSecondary }]}>
                Select child
              </Text>
              <View style={styles.childSelectorContainer}>
                {childrenList.length > 0 ? (
                  childrenList.map((child, index) => {
                    const childKey = `${child.userId}-${child.name}-${index}`;
                    const isActive = activeChildKey === childKey;
                    return (
                      <TouchableOpacity
                        key={childKey}
                        style={[
                          styles.childChip,
                          isActive &&
                            (darkMode
                              ? styles.childChipActiveDark
                              : styles.childChipActiveLight),
                        ]}
                        onPress={() => setActiveChildKey(childKey)}
                        activeOpacity={0.9}
                      >
                        <Text
                          style={[
                            styles.childChipText,
                            {
                              color: isActive
                                ? darkMode
                                  ? '#0B1220'
                                  : '#FFFFFF'
                                : darkMode
                                ? '#E5E7EB'
                                : '#1F2933',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {child.name || 'Unnamed'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={[styles.noChildrenText, { color: textSecondary }]}>
                    No children added yet.
                  </Text>
                )}
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: textSecondary }]}>
                What do you want reminders for?
              </Text>
              <View style={styles.tabs}>
                {TAB_OPTIONS.map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[
                        styles.tabButton,
                        isActive &&
                          (darkMode ? styles.tabActiveDark : styles.tabActiveLight),
                      ]}
                      onPress={() => setActiveTab(tab)}
                      activeOpacity={0.9}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          {
                            color: isActive
                              ? darkMode
                                ? '#0B1220'
                                : '#FFFFFF'
                              : darkMode
                              ? '#E5E7EB'
                              : '#374151',
                          },
                        ]}
                      >
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Time Pickers */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: textSecondary }]}>
                Reminder times
              </Text>
              <View style={{ gap: 12 }}>
                {[0, 1, 2].map((i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.timeCard,
                      { backgroundColor: cardBg },
                      darkMode && { borderColor: '#e8e7e8ff' },
                    ]}
                    onPress={() => {
                      setTempTime(times[i] || new Date());
                      setShowPickerIndex(i);
                    }}
                    activeOpacity={0.9}
                  >
                    <View style={styles.timeLeft}>
                      <View style={styles.timeIconWrap}>
                        <Clock
                          size={18}
                          color={darkMode ? '#E5E7EB' : '#607D8B'}
                          strokeWidth={1.7}
                        />
                      </View>
                      <View>
                        <Text style={[styles.timeLabel, { color: textPrimary }]}>
                          Reminder {i + 1}
                        </Text>
                        <Text
                          style={[
                            styles.timeSubtitle,
                            { color: darkMode ? '#E5E7EB' : textSecondary },
                          ]}
                        >
                          {times[i]
                            ? times[i].toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Tap to set a time'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={scheduleNotifications}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={
                  darkMode ? ['#38BDF8', '#A855F7'] : ['#81D4FA', '#F8BBD9']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveGradient}
              >
                <Text style={styles.saveText}>Save Reminders</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Bottom sheet picker overlay */}
      {showPickerIndex !== null && (
        <View style={styles.pickerOverlay}>
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowPickerIndex(null)}
          />
          <View
            style={[
              styles.pickerContainer,
              darkMode && { backgroundColor: '#020617' },
            ]}
          >
            <DateTimePicker
              value={tempTime}
              mode="time"
              is24Hour={false}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              themeVariant={darkMode ? 'dark' : 'light'}
              onChange={(event, selected) => {
                if (Platform.OS === 'android') {
                  if (event.type === 'dismissed') {
                    setShowPickerIndex(null);
                    return;
                  }
                  const picked = selected || tempTime;
                  const updated = [...times];
                  updated[showPickerIndex] = picked;
                  setTimes(updated);
                  setShowPickerIndex(null);
                } else {
                  if (selected) setTempTime(selected);
                }
              }}
            />

            {Platform.OS === 'ios' && (
              <View style={styles.pickerButtonsRow}>
                <TouchableOpacity
                  onPress={() => setShowPickerIndex(null)}
                  style={styles.cancelButton}
                >
                  <Text
                    style={[
                      styles.cancelText,
                      { color: darkMode ? '#9CA3AF' : '#6B7280' },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={confirmTime} style={styles.doneButton}>
                  <Text
                    style={[
                      styles.doneText,
                      { color: darkMode ? '#38BDF8' : '#007AFF' },
                    ]}
                  >
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  inner: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 20 : (StatusBar.currentHeight || 10),
  },

  // Header
  header: {
    height: 44,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },

  introBlock: {
    marginBottom: 18,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  introSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },

  sectionBlock: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.2,
  },

  // Child chips
  childSelectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  childChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.18)',
  },
  childChipActiveLight: {
    backgroundColor: '#81D4FA',
  },
  childChipActiveDark: {
    backgroundColor: '#38BDF8',
  },
  childChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2933',
  },
  noChildrenText: {
    fontSize: 14,
    fontStyle: 'italic',
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.20)',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActiveLight: {
    backgroundColor: '#FFFFFF',
  },
  tabActiveDark: {
    backgroundColor: '#E5E7EB',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },

  // Time cards
  timeCard: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.30)',
  },
  timeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(148,163,184,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  timeSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  pickerOverlay: {
  ...StyleSheet.absoluteFillObject,
  justifyContent: 'flex-end',
  backgroundColor: 'rgba(0,0,0,0.55)', // darker dim
},
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pickerContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
  },
  pickerButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 20,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  doneButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Save button
  saveButton: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 10,
  },
  saveGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 18,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});