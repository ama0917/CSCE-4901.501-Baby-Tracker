// RegularReminders.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';  // adjust path to your firebase config

const TAB_OPTIONS = ['Diapers', 'Feeding', 'Nap/Sleep'];

export default function RegularReminders() {
  const [childrenList, setChildrenList] = useState([]);
  const [activeChildKey, setActiveChildKey] = useState(null); // unique key per child

  const [activeTab, setActiveTab] = useState(TAB_OPTIONS[0]);
  const [times, setTimes] = useState([null, null, null]); // 3 possible reminders
  const [showPickerIndex, setShowPickerIndex] = useState(null);

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
      const storageKey = `reminders:${activeChild.userId}:${activeTab}`;

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
    if (!activeChildKey) {
      Alert.alert('Error', 'Please select a child before saving reminders.');
      return;
    }

    const activeChildIndex = childrenList.findIndex((child, index) =>
      `${child.userId}-${child.name}-${index}` === activeChildKey
    );
    if (activeChildIndex === -1) return;

    const activeChild = childrenList[activeChildIndex];
    const storageKey = `reminders:${activeChild.userId}:${activeTab}`;
    const storageIdsKey = `remindersIds:${activeChild.userId}:${activeTab}`;

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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Child Selector */}
      <View style={styles.childSelectorContainer}>
        {childrenList.length > 0 ? (
          childrenList.map((child, index) => {
            const childKey = `${child.userId}-${child.name}-${index}`;
            return (
              <TouchableOpacity
                key={childKey}
                style={[styles.childButton, activeChildKey === childKey && styles.childButtonActive]}
                onPress={() => setActiveChildKey(childKey)}
              >
                <Text style={[styles.childText, activeChildKey === childKey && styles.childTextActive]}>
                  {child.name || 'Unnamed'}
                </Text>
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={styles.noChildrenText}>No children added yet.</Text>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TAB_OPTIONS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Time Pickers */}
      <View style={{ marginTop: 20, gap: 16 }}>
        {[0, 1, 2].map(i => (
          <TouchableOpacity
            key={i}
            style={styles.timeButton}
            onPress={() => setShowPickerIndex(i)}
          >
            <Text style={styles.timeButtonText}>
              {times[i] ? times[i].toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `Set Reminder ${i + 1}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {showPickerIndex !== null && (
        <DateTimePicker
          value={times[showPickerIndex] || new Date()}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(e, t) => handleTimeChange(e, t, showPickerIndex)}
        />
      )}

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={scheduleNotifications}>
        <LinearGradient colors={['#5aececff', '#62a8e5ff']} style={styles.saveGradient}>
          <Text style={styles.saveText}>Save Reminders</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18 },
  childSelectorContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  childButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#ccc', alignItems: 'center' },
  childButtonActive: { backgroundColor: '#62a8e5ff' },
  childText: { fontWeight: '600', color: '#333' },
  childTextActive: { color: '#fff' },
  noChildrenText: { color: '#999', fontStyle: 'italic', fontSize: 16 },
  tabs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  tabButton: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#ccc', marginHorizontal: 4, alignItems: 'center' },
  tabActive: { backgroundColor: '#62a8e5ff' },
  tabText: { fontWeight: '600', color: '#333' },
  tabTextActive: { color: '#fff' },
  timeButton: { paddingVertical: 14, borderRadius: 12, backgroundColor: '#f0f2f5', alignItems: 'center' },
  timeButtonText: { fontSize: 16, fontWeight: '600' },
  saveButton: { marginTop: 30, borderRadius: 14, overflow: 'hidden' },
  saveGradient: { paddingVertical: 14, alignItems: 'center', borderRadius: 14 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
