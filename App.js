import React, { useEffect } from 'react';
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

const Stack = createStackNavigator();

export default function App() {
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
  }, []);
  return (
    <ActiveChildProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
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

      </Stack.Navigator>
    </NavigationContainer>
    </ActiveChildProvider>
  );
}
