import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { useDarkMode } from '../screens/DarkMode';

export const appTheme = {
  light: {
    backgroundGradient: ['#B2EBF2', '#FCE4EC'], // pastel dashboard style
    textPrimary: '#2E3A59',
    textMuted: '#2E3A59',
    textSecondary: '#7C8B9A',
    card: '#ffffffee',
    input: ['#f0f0f0', '#fff'],

    // new global gradients
    feeding: ['#81D4FA', '#B39DDB'],
    diaper: ['#F8BBD9', '#FFB74D'],
    sleep: ['#A5D6A7', '#81D4FA'],
    profile: ['#81D4FA', '#F8BBD9'],
    reports: ['#90CAF9', '#81D4FA'],
    reminders: ['#FFB74D', '#FF9800'],
    digest: ['#F8BBD9', '#F48FB1'],
  },
  dark: {
    backgroundGradient: ['#0f2027', '#05090b'], // dark gradient
    textPrimary: '#EAEAEA',
    textMuted: '#EAEAEA',
    textSecondary: '#9E9E9E',
    card: ['#1f1f1f', '#2c2c2c'],
    input: ['#3f3e3eff', '#444'],

    // new global gradients
    feeding: ['#00c6ff', '#0072ff'],
    diaper: ['#ff6a00', '#ee0979'],
    sleep: ['#8e2de2', '#4a00e0'],
    profile: ['#ff00cc', '#333399'],
    reports: ['#00c6ff', '#0072ff'],
    reminders: ['#ff6a00', '#ee0979'],
    digest: ['#ff80ab', '#ff4081'],
  },
};

export default function ThemedBackground({ children, style }) {
  const { darkMode } = useDarkMode() || {}; // fallback if undefined
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;


  const gradientColors = (currentTheme && Array.isArray(currentTheme.backgroundGradient))
    ? currentTheme.backgroundGradient
    : ['#000', '#111']; // safe fallback

  return (
    <LinearGradient
      colors={gradientColors}
      style={[styles.container, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});