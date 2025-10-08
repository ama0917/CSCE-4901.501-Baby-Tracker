import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { DarkModeProvider } from './screens/DarkMode'; 
import { ActiveChildProvider } from './src/contexts/ActiveChildContext';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

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
import RemindersScreen from './screens/RemindersScreen';
import MfaEnterCode from './screens/MfaEnterCode';

const Stack = createStackNavigator();

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const Notifications = require('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch (e) {
      console.log("Notifications not available:", e);
    }

    // Listen for Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (initializing) setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  if (initializing) {
    // Optional: show a splash screen here
    return null;
  }

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
            <Stack.Screen name="AddChild" component={AddChildScreen} />
            <Stack.Screen name="ReportsScreen" component={ReportsScreen} />
            <Stack.Screen name="FeedingForm" component={FeedingForm} />
            <Stack.Screen name="DiaperChangeForm" component={DiaperChangeForm} />
            <Stack.Screen name="SleepingForm" component={SleepingForm} />
            <Stack.Screen name="EditChild" component={EditChildScreen} />
            <Stack.Screen name="RemindersScreen" component={RemindersScreen} />
            <Stack.Screen name="AcceptInvite" component={AcceptInvite} options={{ title: 'Accept Invite' }} />
            <Stack.Screen name="InviteCaregiver" component={InviteCaregiver} options={{ headerShown: true, title: 'Invite Caregiver' }} />
            <Stack.Screen name="ManageCaregivers" component={ManageCaregivers} options={{ title: 'Manage Caregivers' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </ActiveChildProvider>
    </DarkModeProvider>
  );
}
