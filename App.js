import React, { useEffect, useState } from 'react';
import { Platform, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';
import { DarkModeProvider } from './screens/DarkMode';
import { ActiveChildProvider } from './src/contexts/ActiveChildContext';

// Screens
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import HomeScreen from './screens/HomeScreen';
import ChildDashboard from './screens/ChildDashboard';
import SettingsScreen from './screens/SettingsScreen';
import AddChildScreen from './screens/AddChildScreen';
import ReportsScreen from './screens/ReportsScreen';
import FeedingForm from './screens/FeedingForm';
import DiaperChangeForm from './screens/DiaperChangeForm';
import SleepingForm from './screens/SleepingForm';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import EditChildScreen from './screens/EditChildScreen';
import InviteCaregiver from './screens/InviteCaregiver';
import AcceptInvite from './screens/AcceptInvite';
import ManageCaregivers from './screens/ManageCaregivers';
import RegularReminders from './screens/RegularReminders';  
import RemindersScreen from './screens/RemindersScreen';
import MfaEnterCode from './screens/MfaEnterCode';
import MemoriesScreen from './screens/MemoriesScreen';
import ChangePasswordScreen from './screens/ChangePasswordScreen';
import CalendarScreen from './screens/CalendarScreen';
import WelcomeTour from './screens/WelcomeTour';

const Stack = createStackNavigator();

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  LogBox.ignoreLogs(['FirebaseError:', 'auth/']);

  useEffect(() => {
    // Configure notification behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Request notification permissions
    const registerForPushNotifications = async () => {
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('Failed to get push notification permissions!');
          return;
        }

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }
      } else {
        console.log('Must use a physical device for notifications');
      }
    };

    registerForPushNotifications();

    // Listen for Firebase auth changes
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (initializing) setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  if (initializing) return null;

  return (
    <DarkModeProvider>
      <ActiveChildProvider>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{ headerShown: false }}
            initialRouteName={user ? 'Home' : 'Login'}
          >
            {/* Auth screens */}
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="MfaEnterCode" component={MfaEnterCode} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

            {/* Main app screens */}
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="ChildDashboard" component={ChildDashboard} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="WelcomeTour" component={WelcomeTour} />
            <Stack.Screen name="AddChild" component={AddChildScreen} />
            <Stack.Screen name="ReportsScreen" component={ReportsScreen} />
            <Stack.Screen name="FeedingForm" component={FeedingForm} />
            <Stack.Screen name="DiaperChangeForm" component={DiaperChangeForm} />
            <Stack.Screen name="SleepingForm" component={SleepingForm} />
            <Stack.Screen name="EditChild" component={EditChildScreen} />

            {/* Regular Reminders section */}
            <Stack.Screen
              name="RegularReminders"
              component={RegularReminders}
              options={{ headerShown: true, title: 'Reminders' }}
            />
            <Stack.Screen name="RemindersScreen" component={RemindersScreen} />
            <Stack.Screen name="MemoriesScreen" component={MemoriesScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="CalendarScreen" component={CalendarScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AcceptInvite" component={AcceptInvite} options={{ title: 'Accept Invite' }} />
            <Stack.Screen name="InviteCaregiver" component={InviteCaregiver} options={{ headerShown: true, title: 'Invite Caregiver' }} />
            <Stack.Screen name="ManageCaregivers" component={ManageCaregivers} options={{ title: 'Manage Caregivers' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </ActiveChildProvider>
    </DarkModeProvider>
  );
}
