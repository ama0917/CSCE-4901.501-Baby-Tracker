import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider } from './contexts/useAuthContext';
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
import useTokenRefresh from './hooks/useTokenRefresh';
import { addChild } from './api';

const Stack = createStackNavigator();

export default function App() {
  useTokenRefresh();

  return (
    <AuthProvider>
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="ChildDashboard" component={ChildDashboard} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="AddChild" component={AddChildScreen} />
        <Stack.Screen name="ReportsScreen" component={ReportsScreen} />
        <Stack.Screen name="FeedingForm" component={FeedingForm} />
        <Stack.Screen name="DiaperChangeForm" component={DiaperChangeForm} />
        <Stack.Screen name="SleepingForm" component={SleepingForm} />
        
      </Stack.Navigator>
    </NavigationContainer>
    </AuthProvider>
  );
}
