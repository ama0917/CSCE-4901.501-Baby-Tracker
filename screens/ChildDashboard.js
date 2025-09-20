import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { LinearGradient} from 'expo-linear-gradient';
import { getFirestore, collection, query, where, orderBy, limit, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { app } from '../firebaseConfig';
import useUserRole from './useUserRole';
import { getAuth } from 'firebase/auth';


const db = getFirestore(app);

const getTodayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`; // e.g., "2025-09-20"
};


export default function ChildDashboard() {
  const navigation = useNavigation();
  const route = useRoute();
  const { name, childId, image } = route.params || {};

  const { role } = useUserRole();
  const isCaregiver = role === 'caregiver';

  const uid = getAuth().currentUser?.uid;
  const [canView, setCanView] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [canLog, setCanLog] = useState(true); // parents true, caregivers only when ON

  useEffect(() => {
    if (!childId || !uid) { setCanView(false); setIsOwner(false); setCanLog(false); return; }

    const ref = doc(db, 'children', childId);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() || {};
      const val = data?.caregiverPerms?.[uid];
      const owner = data?.userId === uid;
      setIsOwner(owner);
      // View:
      setCanView(owner || val === 'on' || val === 'log');
      // Log:
      setCanLog(owner || val === 'on' || val === 'log');
    });
    return () => unsub();
  }, [childId, uid]);


  const getTodayBounds = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  };

  const [activities, setActivities] = useState([]);
  const [history, setHistory] = useState([]);

  useFocusEffect(
    React.useCallback(() => {
      if (!childId) {
        Alert.alert('Error', 'Child ID is missing. Please return to Home and try again.');
        navigation.goBack();
      } else {
        fetchChildData();
        if (isCaregiver) {
          (async () => {
            try {
              const snap = await getDocs(query(collection(db, 'children'), where('__name__', '==', childId)));
              const doc = snap.docs[0];
              if (doc) {
                const data = doc.data() || {};
                const perms = (data.caregiverPerms || {})[/* current user */ (await import('firebase/auth')).getAuth().currentUser?.uid];
                setCanLog(perms === 'on' || perms === 'log');
              }
            } catch (e) {
              console.log('perm check error', e);
              setCanLog(false);
            }
          })();
        }
      }
    }, [childId])
  );

  const formatTime = (timestamp) => {
    const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    return new Date(timestamp).toLocaleTimeString([], options);
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours > 0 ? `${hours} hr` : ''} ${mins} min`;
  };

  const fetchChildData = async () => {
    try {
      console.log("Fetching data for child ID:", childId);

      const { start, end } = getTodayBounds();

      const fetchedActivities = [
        { type: 'Feeding', time: '3:00 PM' },
        { type: 'Diaper Change', time: '2:30 PM' },
        { type: 'Nap', time: '12:00 PM' }
      ];
      setActivities(fetchedActivities);

      if (!childId) {
        console.error("Child ID is missing");
        setHistory([]);
        return;
      }

      // Diaper logs
      const diaperLogsQuery = query(
        collection(db, 'diaperLogs'),
        where('childId', '==', childId),
        ...(isCaregiver ? [where('logDate', '==', getTodayStr())] : []),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const diaperSnapshot = await getDocs(diaperLogsQuery);
      const diaperLogs = diaperSnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'Diaper Change',
        subtype: doc.data().stoolType,
        time: formatTime(doc.data().timestamp?.toDate()) || 'Unknown',
        timestamp: doc.data().timestamp?.toDate() || new Date(0)
      }));

      // Feeding logs
      const feedingLogsQuery = query(
        collection(db, 'feedLogs'),
        where('childId', '==', childId),
        ...(isCaregiver ? [where('logDate', '==', getTodayStr())] : []),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const feedingSnapshot = await getDocs(feedingLogsQuery);
      const feedLogs = feedingSnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'Feeding',
        subtype: doc.data().feedType,
        time: formatTime(doc.data().timestamp?.toDate()) || 'Unknown',
        timestamp: doc.data().timestamp?.toDate() || new Date(0)
      }));

      // Sleep logs
      const sleepLogsQuery = query(
        collection(db, 'sleepLogs'),
        where('childId', '==', childId),
        ...(isCaregiver ? [where('logDate', '==', getTodayStr())] : []),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const sleepSnapshot = await getDocs(sleepLogsQuery);
      const sleepLogs = sleepSnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'Sleep',
        subtype: formatDuration(doc.data().duration),
        time: formatTime(doc.data().timestamp?.toDate()) || 'Unknown',
        timestamp: doc.data().timestamp?.toDate() || new Date(0)
      }));

      // Combine and sort all logs by timestamp
      const combinedLogs = [...diaperLogs, ...feedLogs, ...sleepLogs].sort(
        (a, b) => b.timestamp - a.timestamp
      );

      // Set the latest 5 logs to history
      setHistory(combinedLogs.slice(0, 5));
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Unable to fetch data.');
    }
  };

  if (!canView) {
    return (
      <LinearGradient colors={['#E3F2FD', '#FFFFFF']} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ margin: 20, backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
          <Text style={{ color: '#2E3A59', marginBottom: 12 }}>Access is turned off by the parent.</Text>
          <TouchableOpacity
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
            style={{ padding: 12, backgroundColor: '#CFD8DC', borderRadius: 10, alignItems: 'center' }}
          >
            <Text style={{ color: '#2E3A59', fontWeight: '700' }}>Back</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }


  return (
    <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={styles.gradient}>
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Home</Text>
        </TouchableOpacity>
        <Image source={require('../assets/logo.png')} style={styles.logo} />
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.settings}>⚙</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{name}'s Dashboard</Text>
      {image ? (
        <Image source={{ uri: image}} style={styles.profileImage} />
      ) : (
      <Image source={require('../assets/default-profile.png')} style={styles.profileImage} />
      )}
      <Text style={styles.sectionTitle}>Log Activities</Text>
      {(isOwner || canLog) ? (
        <View style={styles.activitiesContainer}>
        <TouchableOpacity style={styles.activityButton} onPress={() => navigation.navigate('FeedingForm', { childId, name })}>
          <Image source={require('../assets/bottle.png')} style={styles.activityIcon} />
          <Text style={styles.activityText}>Feeding</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.activityButton} 
          onPress={() => {
            console.log('Navigating to DiaperChangeForm with childId:', childId);
            navigation.navigate('DiaperChangeForm', { childId, name });
          }}>
          <Image source={require('../assets/diaper.png')} style={styles.activityIcon} />
          <Text style={styles.activityText}>Diaper</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.activityButton} onPress={() => navigation.navigate('SleepingForm', { childId, name })}>
          <Image source={require('../assets/sleep.png')} style={styles.activityIcon} />
          <Text style={styles.activityText}>Sleep</Text>
        </TouchableOpacity>
      </View>
      ) : (
        <View style={{ padding: 12, backgroundColor: '#FFF9B0', borderRadius: 10, marginBottom: 10 }}>
          <Text style={{ color: '#2E3A59' }}>View-only access. Ask the parent for logging permission.</Text>
        </View>
      )}

      {isOwner && (
        <TouchableOpacity
          style={styles.reportsButton}
          onPress={() => navigation.navigate('ReportsScreen', { childId, name })}
    >
        <Text style={styles.reportsText}>View Reports</Text>
        </TouchableOpacity>
   )}


      <Text style={styles.sectionTitle}>History</Text>
      <ScrollView style={styles.historyContainer}>
        {history.length > 0 ? (
          history.map((item, index) => (
            <View key={index} style={styles.historyItem}>
              <Image 
                source={ 
                  item.type === 'Feeding' ? require('../assets/bottle.png') : 
                  item.type === 'Diaper Change' ? require('../assets/diaper.png') : 
                  require('../assets/sleep.png')
                } 
                style={styles.historyIcon} 
              />
              <View>
                <Text style={styles.historyText}>{`${item.type} - ${item.time}`}</Text>
                {item.subtype && <Text style={styles.subText}>{item.subtype}</Text>}
                {item.mealType && item.type === 'Feeding' && <Text style={styles.subText}>{`Meal: ${item.mealType}`}</Text>}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.historyText}>No activities logged yet.</Text>
        )}
      </ScrollView>
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
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 40,
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
  logo: {
    width: 65,
    height: 65,
    resizeMode: 'contain',
    marginLeft: -20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 10,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginVertical: 10,
    resizeMode: 'cover',
    borderWidth: 2,
    borderColor: '#fff'
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
  reportsButton: {
    backgroundColor: '#90CAF9',
    padding: 10,
    borderRadius: 20,
    marginBottom: 10,
  },
  reportsText: {
    color: '#fff',
    fontWeight: 'bold',
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
    fontWeight: '500',
  },
  subText: {
    fontSize: 12,
    color: '#555',
  },
});
