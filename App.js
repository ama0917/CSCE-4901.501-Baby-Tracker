import React from 'react';
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
import InviteCaregiver from './screens/InviteCaregiver';
import AcceptInvite from './screens/AcceptInvite';
import ManageCaregivers from './screens/ManageCaregivers';

const Stack = createStackNavigator();

export default function App() {
  return (
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
        <Stack.Screen name="AcceptInvite" component={AcceptInvite} options={{ title: 'Accept Invite' }} />
        <Stack.Screen name="InviteCaregiver" component={InviteCaregiver} options={{ headerShown: true, title: 'Invite Caregiver' }} />
        <Stack.Screen name="ManageCaregivers" component={ManageCaregivers} options={{ title: 'Manage Caregivers' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
