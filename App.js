import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
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
import { ActiveChildProvider } from './src/contexts/ActiveChildContext';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

const Stack = createStackNavigator();

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Defer importing expo-notifications to runtime only (guarded).
    try {
      const Notifications = require('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
      });
    } catch (e) {
      // ignore in non-Expo environments (tests, node)
    }
    // Listen for Firebase auth state changes to implement login persistence.
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (initializing) setInitializing(false);
    });
    return () => unsubscribe();
  }, []);
  if (initializing) {
    // Optionally render nothing while checking auth status to avoid flicker
    return null;
  }

  return (
    <ActiveChildProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // If user is authenticated, make Home the initial route
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="ChildDashboard" component={ChildDashboard} />
            <Stack.Screen name="Settings" component={SettingsScreen}/>
            <Stack.Screen name="AddChild" component={AddChildScreen} />
            <Stack.Screen name="ReportsScreen" component={ReportsScreen} />
            <Stack.Screen name="FeedingForm" component={FeedingForm} />
            <Stack.Screen name="DiaperChangeForm" component={DiaperChangeForm} />
            <Stack.Screen name="SleepingForm" component={SleepingForm} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="EditChild" component={EditChildScreen}/>
          </>
        ) : (
          // Not signed in: show auth flow
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        )}
        </Stack.Navigator>
      </NavigationContainer>
    </ActiveChildProvider>
  );
}
