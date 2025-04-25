import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, TextInput, StyleSheet, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from 'react-native-paper';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [darkMode, setDarkMode] = useState(false);
  const [mfa, setMfa] = useState(false);
  const [notifications, setNotifications] = useState(true);

  return (
    <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={styles.gradient}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Section */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Home</Text>
          </TouchableOpacity>

          <Image source={require('../assets/logo.png')} style={styles.logo} />
          <TouchableOpacity style={styles.signOutButton} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Settings</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Dark Mode 🌙</Text>
          <Switch value={darkMode} onValueChange={setDarkMode} />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Multi-Factor Authentication 🔐</Text>
          <Switch value={mfa} onValueChange={setMfa} />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Notifications & Reminders 🔔</Text>
          <Switch value={notifications} onValueChange={setNotifications} />
        </View>

        <TouchableOpacity style={styles.remindersButton}>
          <Text style={styles.remindersText}>Set Reminders</Text>
        </TouchableOpacity>

        <View style={styles.passwordSection}>
          <Text style={styles.sectionTitle}>Change Password 🔑</Text>

          <TextInput placeholder="Current Password" style={styles.input} secureTextEntry />
          <TextInput placeholder="New Password" style={styles.input} secureTextEntry />
          <TextInput placeholder="Confirm New Password" style={styles.input} secureTextEntry />

          <TouchableOpacity style={styles.resetButton}>
            <Text style={styles.resetText}>Reset Password</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 30,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  backButton: {
    alignSelf: 'flex-start',
    color: '#007AFF',
    fontSize: 14,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 15,
  },
  settingItem: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF9B0',
    padding: 15,
    borderRadius: 20,
    marginVertical: 10,
  },
  settingText: {
    fontSize: 16,
  },
  remindersButton: {
    backgroundColor: '#C6F6D5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginVertical: 15,
  },
  remindersText: {
    fontSize: 16,
    color: '#333',
  },
  passwordSection: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 30,
    padding: 20,
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#F0F8FF',
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginVertical: 8,
  },
  resetButton: {
    backgroundColor: '#FFCDD2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 15,
  },
  resetText: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  logo: {
    width: 65,
    height: 65,
    resizeMode: 'contain',
    marginTop: 10,
  },
  signOutButton: {
    backgroundColor: '#FFCDD2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: 'bold',
  },
});