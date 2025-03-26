import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function ChildDashboard() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={styles.backButton}>« Back to Home</Text>
        </TouchableOpacity>
        <Image source={require('../assets/baby-icon.png')} style={styles.babyIcon} />
        <TouchableOpacity>
          <Text style={styles.settings}>⚙ Settings</Text>
        </TouchableOpacity>
      </View>
      
      {/* Baby Name and Profile */}
      <Text style={styles.title}>Baby #1 Dashboard</Text>
      <Image source={require('../assets/happy-baby.png')} style={styles.profileImage} />
      
      {/* Log Activities */}
      <Text style={styles.sectionTitle}>Log Activities</Text>
      <View style={styles.activitiesContainer}>
        <TouchableOpacity style={styles.activityButton}>
          <Image source={require('../assets/diaper.png')} style={styles.activityIcon} />
          <Text style={styles.activityText}>Diaper Change/Potty</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.activityButton}>
          <Image source={require('../assets/bottle.png')} style={styles.activityIcon} />
          <Text style={styles.activityText}>Feeding</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.activityButton}>
          <Image source={require('../assets/sleep.png')} style={styles.activityIcon} />
          <Text style={styles.activityText}>Sleep</Text>
        </TouchableOpacity>
      </View>
      
      {/* History Section with Scroll */}
      <Text style={styles.sectionTitle}>History</Text>
      <ScrollView style={styles.historyContainer}>
        <View style={styles.historyItem}>
          <Image source={require('../assets/bottle.png')} style={styles.historyIcon} />
          <Text style={styles.historyText}>Feeding - 3:00 PM</Text>
        </View>
        <View style={styles.historyItem}>
          <Image source={require('../assets/diaper.png')} style={styles.historyIcon} />
          <Text style={styles.historyText}>Diaper Change - 2:30 PM</Text>
        </View>
        <View style={styles.historyItem}>
          <Image source={require('../assets/sleep.png')} style={styles.historyIcon} />
          <Text style={styles.historyText}>Nap - 12:00 PM</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    alignItems: 'center',
  },
  backButton: {
    fontSize: 16,
    color: '#000',
  },
  settings: {
    fontSize: 16,
    color: '#000',
  },
  babyIcon: {
    width: 40,
    height: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 10,
  },
  profileImage: {
    width: 80,
    height: 80,
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
  },
  activitiesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '90%',
    marginVertical: 10,
  },
  activityButton: {
    alignItems: 'center',
  },
  activityIcon: {
    width: 50,
    height: 50,
  },
  activityText: {
    fontSize: 12,
    textAlign: 'center',
  },
  historyContainer: {
    width: '90%',
    maxHeight: 200,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    padding: 10,
    marginVertical: 10,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  historyIcon: {
    width: 30,
    height: 30,
    marginRight: 10,
  },
  historyText: {
    fontSize: 14,
  },
});
