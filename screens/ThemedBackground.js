import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { useDarkMode } from '../screens/DarkMode';

export const appTheme = {
  light: {
    backgroundGradient: ['#B2EBF2', '#FCE4EC', '#F3E5F5'], // pastel gradient
    textPrimary: '#2E3A59',
    textSecondary: '#7C8B9A',
    card: '#FFF9B0',
    input: '#F0F8FF',
  },
  dark: {
    backgroundGradient: ['#0f2027', '#05090b', '#020404'], // dark gradient
    textPrimary: '#EAEAEA',
    textSecondary: '#9E9E9E',
    card: '#a4a4b6ff',
    input: '#333',
  },
};

export default function ThemedBackground({ children, style }) {
  const { darkMode } = useDarkMode() || {}; // fallback if undefined
  const currentTheme = darkMode ? appTheme.dark : appTheme.light;

  // ✅ Ensure colors is always an array
  const gradientColors = Array.isArray(currentTheme.backgroundGradient)
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