import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function ChildDashboard() {
  const navigation = useNavigation();
  const route = useRoute();
  const { name } = route.params || { name: "Baby"}; // Just incase there isnt a name issued

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={styles.backButton}>« Home</Text>
        </TouchableOpacity>
        <Image source={require('../assets/logo.png')} style={styles.logo} />
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.settings}>⚙</Text>
        </TouchableOpacity>
      </View>
      
      {/* Baby Name and Profile */}
      <Text style={styles.title}>{name}'s Dashboard</Text>
      <Image source={require('../assets/happy-baby.png')} style={styles.profileImage} />
      
      {/* Log Activities */}
      <Text style={styles.sectionTitle}>Log Activities</Text>
      <View style={styles.activitiesContainer}>
        <TouchableOpacity style={styles.activityButton} onPress={() => navigation.navigate('FeedingForm')}>
          <Image source={require('../assets/bottle.png')} style={styles.activityIcon} />
          <Text style={styles.activityText}>Feeding</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.activityButton} onPress={() => navigation.navigate('DiaperChangeForm')}>
          <Image source={require('../assets/diaper.png')} style={styles.activityIcon} />
          <Text style={styles.activityText}>Diaper</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.activityButton} onPress={() => navigation.navigate('SleepingForm')}>
          <Image source={require('../assets/sleep.png')} style={styles.activityIcon}/>
          <Text style={styles.activityText}>Sleep</Text>
        </TouchableOpacity>
      </View>
      
      {/* View Reports Button */}
      <TouchableOpacity style={styles.reportsButton} onPress={() => navigation.navigate('ReportsScreen')}>
        <Text style={styles.reportsText}>View Reports</Text>
      </TouchableOpacity>


      {/* History Section with Scroll, Information is for testing the look  */}
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
    paddingBottom: 40.
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    fontSize: 14,
    color: '#007AFF',
  },
  settings: {
    fontSize: 30,
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
    width: 90,
    height: 85,
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 30,
    marginBottom: 10,
  },
  activitiesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '90%',
    marginVertical: 20,
  },
  activityButton: {
    alignItems: 'center',
    backgroundColor: '#fffbe6',
    padding: 10,
    borderRadius: 60,
    width: 90,
  },
  activityIcon: {
    width: 40,
    height: 40,
    marginBottom: 5,
  },
  activityText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  historyContainer: {
    width: '90%',
    maxHeight: 220,
    borderRadius: 30,
    backgroundColor: '#FFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginVertical: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  historyIcon: {
    width: 30,
    height: 30,
    marginRight: 10,
  },
  historyText: {
    fontSize: 14,
  },
  logo: {
    width:65,
    height: 65,
    resizeMode: 'contain',
    alignItems: 'center',
    marginTop: 10,
   },
});
