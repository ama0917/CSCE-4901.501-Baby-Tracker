import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, DefaultTheme, DarkTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const Stack = createStackNavigator();

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      const themePref = await AsyncStorage.getItem('theme');
      setIsDarkMode(themePref === 'dark');
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(!isDarkMode);
    await AsyncStorage.setItem('theme', newTheme);
  };

  return (
    <PaperProvider theme={isDarkMode ? DarkTheme : DefaultTheme}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} toggleTheme={toggleTheme} />}
          </Stack.Screen>
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="Home">
            {(props) => <HomeScreen {...props} toggleTheme={toggleTheme} />}
          </Stack.Screen>
          <Stack.Screen name="ChildDashboard" component={ChildDashboard} />
          <Stack.Screen name="Settings">
            {(props) => <SettingsScreen {...props} toggleTheme={toggleTheme} />}
          </Stack.Screen>
          <Stack.Screen name="AddChild" component={AddChildScreen} />
          <Stack.Screen name="ReportsScreen" component={ReportsScreen} />
          <Stack.Screen name="FeedingForm" component={FeedingForm} />
          <Stack.Screen name="DiaperChangeForm" component={DiaperChangeForm} />
          <Stack.Screen name="SleepingForm" component={SleepingForm} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="EditChild" component={EditChildScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
