import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import NewPasswordScreen from '../screens/auth/NewPasswordScreen';

// Main Screens
import JourneyScreen from '../screens/main/JourneyScreen';
import DeliveryScreen from '../screens/main/DeliveryScreen';
import ToursScreen from '../screens/main/ToursScreen';

import { ActiveTourProvider } from '../utils/ActiveTourContext';

// In Expo, @expo/vector-icons is already installed.
import { Feather } from '@expo/vector-icons';

const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#ef4444',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 88 : 76,
          paddingBottom: Platform.OS === 'ios' ? 24 : 14,
          paddingTop: 8,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f3f4f6',
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: any;
          if (route.name === 'Trajet') {
            iconName = 'map';
          } else if (route.name === 'Mes Tournées') {
            iconName = 'truck';
          }
          return <Feather name={iconName} size={20} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Trajet" component={JourneyScreen} options={{ title: 'GPS / Carte' }} />
      <Tab.Screen name="Mes Tournées" component={ToursScreen} options={{ title: 'Mes Tournées' }} />
    </Tab.Navigator>
  );
}

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Otp" component={OtpScreen} />
      <AuthStack.Screen name="NewPassword" component={NewPasswordScreen} />
    </AuthStack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <ActiveTourProvider>
      <NavigationContainer>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {/* The Auth flow is the initial route. Once complete, we navigate to Main */}
          <RootStack.Screen name="Auth" component={AuthStackNavigator} />
          <RootStack.Screen name="Main" component={MainTabNavigator} />
        </RootStack.Navigator>
      </NavigationContainer>
    </ActiveTourProvider>
  );
}
