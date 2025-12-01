import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
  Modal
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useDarkMode } from './DarkMode';
import { appTheme } from './ThemedBackground';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ArrowLeft } from 'lucide-react-native';
import * as XLSX from 'xlsx';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { AntDesign, FontAwesome5 } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_GRADIENT_DARK = ['#1f1f1f', '#2c2c2c']; 
const ACTION_GRADIENT = ['#1976d2', '#1565c0'];

const darkModeGradients = {
  feeding: ['#00c6ff', '#0072ff'],
  diaper: ['#ff6a00', '#ee0979'],
  sleep: ['#8e2de2', '#4a00e0'],
  card: ['#1f1f1f', '#2c2c2c'],
  profile: ['#ff00cc', '#333399'],
};

// Extended CDC Growth Data - Weight in kg (0-240 months / 0-20 years)
const CDC_WEIGHT_PERCENTILES = {
  male: {
    0: { p3: 2.5, p5: 2.6, p10: 2.8, p25: 3.0, p50: 3.3, p75: 3.7, p85: 3.9, p90: 4.1, p95: 4.4, p97: 4.6 },
    1: { p3: 3.4, p5: 3.5, p10: 3.8, p25: 4.1, p50: 4.5, p75: 5.0, p85: 5.3, p90: 5.5, p95: 5.8, p97: 6.1 },
    2: { p3: 4.3, p5: 4.5, p10: 4.8, p25: 5.2, p50: 5.6, p75: 6.2, p85: 6.5, p90: 6.8, p95: 7.1, p97: 7.5 },
    3: { p3: 5.0, p5: 5.2, p10: 5.5, p25: 5.9, p50: 6.4, p75: 7.0, p85: 7.4, p90: 7.7, p95: 8.0, p97: 8.4 },
    4: { p3: 5.6, p5: 5.8, p10: 6.1, p25: 6.6, p50: 7.0, p75: 7.7, p85: 8.1, p90: 8.4, p95: 8.7, p97: 9.1 },
    5: { p3: 6.0, p5: 6.2, p10: 6.6, p25: 7.1, p50: 7.5, p75: 8.2, p85: 8.6, p90: 9.0, p95: 9.3, p97: 9.7 },
    6: { p3: 6.4, p5: 6.6, p10: 7.0, p25: 7.5, p50: 7.9, p75: 8.7, p85: 9.1, p90: 9.5, p95: 9.8, p97: 10.2 },
    9: { p3: 7.5, p5: 7.7, p10: 8.2, p25: 8.7, p50: 9.2, p75: 10.1, p85: 10.5, p90: 10.9, p95: 11.3, p97: 11.7 },
    12: { p3: 8.4, p5: 8.6, p10: 9.1, p25: 9.6, p50: 10.2, p75: 11.1, p85: 11.6, p90: 12.0, p95: 12.4, p97: 12.9 },
    15: { p3: 9.2, p5: 9.4, p10: 9.9, p25: 10.5, p50: 11.1, p75: 12.1, p85: 12.6, p90: 13.1, p95: 13.5, p97: 14.0 },
    18: { p3: 9.8, p5: 10.1, p10: 10.6, p25: 11.2, p50: 11.8, p75: 12.9, p85: 13.5, p90: 13.9, p95: 14.3, p97: 14.9 },
    21: { p3: 10.4, p5: 10.7, p10: 11.2, p25: 11.9, p50: 12.5, p75: 13.7, p85: 14.3, p90: 14.8, p95: 15.2, p97: 15.8 },
    24: { p3: 10.9, p5: 11.2, p10: 11.8, p25: 12.5, p50: 13.0, p75: 14.3, p85: 15.0, p90: 15.5, p95: 15.8, p97: 16.5 },
    30: { p3: 12.0, p5: 12.3, p10: 12.9, p25: 13.7, p50: 14.3, p75: 15.8, p85: 16.5, p90: 17.1, p95: 17.8, p97: 18.5 },
    36: { p3: 12.7, p5: 13.1, p10: 13.8, p25: 14.6, p50: 15.3, p75: 17.0, p85: 17.8, p90: 18.5, p95: 19.2, p97: 20.0 },
    48: { p3: 13.9, p5: 14.4, p10: 15.2, p25: 16.2, p50: 17.1, p75: 19.2, p85: 20.3, p90: 21.2, p95: 22.4, p97: 23.5 },
    60: { p3: 15.2, p5: 15.8, p10: 16.8, p25: 18.0, p50: 19.1, p75: 21.7, p85: 23.2, p90: 24.4, p95: 26.0, p97: 27.5 },
    72: { p3: 16.6, p5: 17.3, p10: 18.5, p25: 20.0, p50: 21.4, p75: 24.5, p85: 26.5, p90: 28.1, p95: 30.3, p97: 32.2 },
    84: { p3: 18.1, p5: 18.9, p10: 20.4, p25: 22.2, p50: 24.0, p75: 27.7, p85: 30.3, p90: 32.4, p95: 35.4, p97: 37.9 },
    96: { p3: 19.8, p5: 20.7, p10: 22.5, p25: 24.7, p50: 26.9, p75: 31.4, p85: 34.7, p90: 37.4, p95: 41.3, p97: 44.7 },
    108: { p3: 21.6, p5: 22.7, p10: 24.8, p25: 27.4, p50: 30.2, p75: 35.6, p85: 39.7, p90: 43.2, p95: 48.1, p97: 52.6 },
    120: { p3: 23.6, p5: 24.9, p10: 27.4, p25: 30.5, p50: 34.0, p75: 40.3, p85: 45.3, p90: 49.8, p95: 55.9, p97: 61.5 },
    132: { p3: 25.9, p5: 27.4, p10: 30.3, p25: 34.0, p50: 38.4, p75: 45.7, p85: 51.5, p90: 56.8, p95: 64.1, p97: 70.8 },
    144: { p3: 28.5, p5: 30.3, p10: 33.6, p25: 38.0, p50: 43.4, p75: 51.7, p85: 58.2, p90: 64.4, p95: 72.8, p97: 80.5 },
    156: { p3: 31.6, p5: 33.6, p10: 37.4, p25: 42.5, p50: 48.8, p75: 57.9, p85: 65.0, p90: 71.9, p95: 81.0, p97: 89.3 },
    168: { p3: 35.1, p5: 37.4, p10: 41.6, p25: 47.4, p50: 54.4, p75: 64.1, p85: 71.6, p90: 78.9, p95: 88.4, p97: 96.9 },
    180: { p3: 38.9, p5: 41.5, p10: 46.0, p25: 52.4, p50: 59.9, p75: 69.9, p85: 77.6, p90: 85.1, p95: 94.6, p97: 103.2 },
    192: { p3: 42.8, p5: 45.6, p10: 50.4, p25: 57.3, p50: 65.2, p75: 75.3, p85: 83.0, p90: 90.4, p95: 99.7, p97: 108.1 },
    204: { p3: 46.6, p5: 49.5, p10: 54.5, p25: 61.8, p50: 70.1, p75: 80.1, p85: 87.6, p90: 94.7, p95: 103.8, p97: 111.8 },
    216: { p3: 50.1, p5: 53.1, p10: 58.2, p25: 65.9, p50: 74.4, p75: 84.1, p85: 91.4, p90: 98.2, p95: 106.9, p97: 114.4 },
    228: { p3: 53.2, p5: 56.2, p10: 61.4, p25: 69.3, p50: 78.0, p75: 87.4, p85: 94.4, p90: 101.0, p95: 109.3, p97: 116.3 },
    240: { p3: 56.0, p5: 59.0, p10: 64.2, p25: 72.3, p50: 81.0, p75: 90.1, p85: 96.8, p90: 103.2, p95: 111.2, p97: 117.8 }
  },
  female: {
    0: { p3: 2.4, p5: 2.5, p10: 2.7, p25: 2.9, p50: 3.2, p75: 3.6, p85: 3.8, p90: 4.0, p95: 4.2, p97: 4.5 },
    1: { p3: 3.2, p5: 3.3, p10: 3.6, p25: 3.9, p50: 4.2, p75: 4.7, p85: 5.0, p90: 5.2, p95: 5.5, p97: 5.8 },
    2: { p3: 3.9, p5: 4.0, p10: 4.4, p25: 4.7, p50: 5.1, p75: 5.7, p85: 6.1, p90: 6.3, p95: 6.6, p97: 7.0 },
    3: { p3: 4.5, p5: 4.6, p10: 5.0, p25: 5.4, p50: 5.8, p75: 6.5, p85: 6.9, p90: 7.2, p95: 7.5, p97: 7.9 },
    4: { p3: 5.0, p5: 5.1, p10: 5.5, p25: 5.9, p50: 6.4, p75: 7.1, p85: 7.5, p90: 7.8, p95: 8.2, p97: 8.6 },
    5: { p3: 5.4, p5: 5.5, p10: 6.0, p25: 6.4, p50: 6.9, p75: 7.6, p85: 8.1, p90: 8.4, p95: 8.8, p97: 9.2 },
    6: { p3: 5.7, p5: 5.9, p10: 6.3, p25: 6.8, p50: 7.3, p75: 8.1, p85: 8.6, p90: 8.9, p95: 9.3, p97: 9.8 },
    9: { p3: 6.9, p5: 7.0, p10: 7.5, p25: 8.0, p50: 8.6, p75: 9.5, p85: 10.1, p90: 10.5, p95: 10.9, p97: 11.4 },
    12: { p3: 7.7, p5: 7.9, p10: 8.4, p25: 9.0, p50: 9.6, p75: 10.6, p85: 11.2, p90: 11.7, p95: 12.1, p97: 12.7 },
    15: { p3: 8.5, p5: 8.7, p10: 9.2, p25: 9.8, p50: 10.5, p75: 11.6, p85: 12.3, p90: 12.8, p95: 13.3, p97: 13.9 },
    18: { p3: 9.1, p5: 9.4, p10: 9.9, p25: 10.6, p50: 11.3, p75: 12.5, p85: 13.2, p90: 13.8, p95: 14.3, p97: 15.0 },
    21: { p3: 9.7, p5: 10.0, p10: 10.6, p25: 11.3, p50: 12.0, p75: 13.3, p85: 14.1, p90: 14.7, p95: 15.3, p97: 16.0 },
    24: { p3: 10.2, p5: 10.5, p10: 11.1, p25: 11.8, p50: 12.6, p75: 14.0, p85: 14.8, p90: 15.5, p95: 16.1, p97: 16.9 },
    30: { p3: 11.2, p5: 11.5, p10: 12.2, p25: 13.0, p50: 13.9, p75: 15.5, p85: 16.5, p90: 17.2, p95: 18.0, p97: 18.9 },
    36: { p3: 11.9, p5: 12.3, p10: 13.0, p25: 13.9, p50: 14.9, p75: 16.7, p85: 17.8, p90: 18.6, p95: 19.5, p97: 20.5 },
    48: { p3: 13.1, p5: 13.6, p10: 14.5, p25: 15.6, p50: 16.8, p75: 19.1, p85: 20.6, p90: 21.7, p95: 23.1, p97: 24.5 },
    60: { p3: 14.4, p5: 15.0, p10: 16.1, p25: 17.4, p50: 19.0, p75: 21.8, p85: 23.7, p90: 25.2, p95: 27.2, p97: 29.1 },
    72: { p3: 15.8, p5: 16.5, p10: 17.8, p25: 19.5, p50: 21.4, p75: 24.9, p85: 27.4, p90: 29.3, p95: 32.0, p97: 34.5 },
    84: { p3: 17.3, p5: 18.1, p10: 19.7, p25: 21.8, p50: 24.1, p75: 28.3, p85: 31.4, p90: 33.9, p95: 37.4, p97: 40.6 },
    96: { p3: 18.9, p5: 19.9, p10: 21.8, p25: 24.4, p50: 27.2, p75: 32.2, p85: 36.0, p90: 39.2, p95: 43.6, p97: 47.6 },
    108: { p3: 20.7, p5: 21.9, p10: 24.1, p25: 27.2, p50: 30.5, p75: 36.4, p85: 40.9, p90: 44.8, p95: 50.2, p97: 55.1 },
    120: { p3: 22.8, p5: 24.1, p10: 26.7, p25: 30.3, p50: 34.1, p75: 40.9, p85: 46.0, p90: 50.6, p95: 57.1, p97: 62.8 },
    132: { p3: 25.1, p5: 26.7, p10: 29.6, p25: 33.7, p50: 38.1, p75: 45.6, p85: 51.3, p90: 56.5, p95: 63.9, p97: 70.2 },
    144: { p3: 27.8, p5: 29.5, p10: 32.8, p25: 37.4, p50: 42.3, p75: 50.3, p85: 56.5, p90: 62.1, p95: 70.0, p97: 76.7 },
    156: { p3: 30.6, p5: 32.5, p10: 36.2, p25: 41.2, p50: 46.6, p75: 54.7, p85: 61.1, p90: 66.9, p95: 75.2, p97: 82.1 },
    168: { p3: 33.5, p5: 35.5, p10: 39.5, p25: 44.9, p50: 50.6, p75: 58.6, p85: 65.0, p90: 70.8, p95: 79.1, p97: 85.9 },
    180: { p3: 36.2, p5: 38.3, p10: 42.5, p25: 48.2, p50: 54.0, p75: 61.9, p85: 68.1, p90: 73.8, p95: 81.9, p97: 88.4 },
    192: { p3: 38.6, p5: 40.8, p10: 45.1, p25: 51.0, p50: 56.9, p75: 64.6, p85: 70.6, p90: 76.1, p95: 83.9, p97: 90.1 },
    204: { p3: 40.7, p5: 42.9, p10: 47.3, p25: 53.3, p50: 59.2, p75: 66.8, p85: 72.6, p90: 77.9, p95: 85.4, p97: 91.3 },
    216: { p3: 42.4, p5: 44.7, p10: 49.1, p25: 55.2, p50: 61.0, p75: 68.4, p85: 74.0, p90: 79.2, p95: 86.4, p97: 92.0 },
    228: { p3: 43.8, p5: 46.1, p10: 50.5, p25: 56.6, p50: 62.3, p75: 69.5, p85: 74.9, p90: 80.0, p95: 86.9, p97: 92.3 },
    240: { p3: 45.0, p5: 47.2, p10: 51.6, p25: 57.7, p50: 63.2, p75: 70.2, p85: 75.5, p90: 80.5, p95: 87.2, p97: 92.4 }
  }
};

// Extended CDC Height Data - Height in cm (0-240 months / 0-20 years)
const CDC_HEIGHT_PERCENTILES = {
  male: {
    0: { p3: 46.1, p5: 46.8, p10: 47.8, p25: 48.9, p50: 49.9, p75: 51.0, p85: 51.8, p90: 52.4, p95: 53.7, p97: 54.4 },
    1: { p3: 50.8, p5: 51.5, p10: 52.6, p25: 53.7, p50: 54.7, p75: 55.8, p85: 56.5, p90: 57.2, p95: 58.6, p97: 59.4 },
    2: { p3: 54.4, p5: 55.0, p10: 56.2, p25: 57.4, p50: 58.4, p75: 59.5, p85: 60.3, p90: 61.0, p95: 62.4, p97: 63.3 },
    3: { p3: 57.3, p5: 58.0, p10: 59.2, p25: 60.4, p50: 61.4, p75: 62.6, p85: 63.4, p90: 64.1, p95: 65.5, p97: 66.4 },
    4: { p3: 59.7, p5: 60.4, p10: 61.6, p25: 62.9, p50: 63.9, p75: 65.1, p85: 66.0, p90: 66.7, p95: 68.0, p97: 69.0 },
    5: { p3: 61.7, p5: 62.4, p10: 63.7, p25: 65.0, p50: 66.0, p75: 67.3, p85: 68.2, p90: 68.9, p95: 70.1, p97: 71.1 },
    6: { p3: 63.3, p5: 64.0, p10: 65.3, p25: 66.6, p50: 67.6, p75: 68.9, p85: 69.8, p90: 70.6, p95: 72.0, p97: 73.0 },
    9: { p3: 67.7, p5: 68.5, p10: 69.8, p25: 71.2, p50: 72.3, p75: 73.6, p85: 74.6, p90: 75.4, p95: 76.9, p97: 78.0 },
    12: { p3: 71.0, p5: 71.8, p10: 73.1, p25: 74.5, p50: 75.7, p75: 77.1, p85: 78.1, p90: 79.0, p95: 80.5, p97: 81.7 },
    15: { p3: 74.0, p5: 74.8, p10: 76.2, p25: 77.6, p50: 78.9, p75: 80.3, p85: 81.4, p90: 82.3, p95: 83.9, p97: 85.1 },
18: { p3: 76.6, p5: 77.5, p10: 78.9, p25: 80.4, p50: 81.7, p75: 83.2, p85: 84.3, p90: 85.2, p95: 86.9, p97: 88.1 },
    21: { p3: 79.0, p5: 79.9, p10: 81.3, p25: 82.8, p50: 84.2, p75: 85.7, p85: 86.8, p90: 87.8, p95: 89.5, p97: 90.7 },
    24: { p3: 81.2, p5: 82.1, p10: 83.5, p25: 85.1, p50: 86.5, p75: 88.1, p85: 89.2, p90: 90.2, p95: 92.0, p97: 93.2 },
    30: { p3: 85.3, p5: 86.2, p10: 87.7, p25: 89.4, p50: 90.9, p75: 92.6, p85: 93.8, p90: 94.9, p95: 96.8, p97: 98.1 },
    36: { p3: 88.9, p5: 89.9, p10: 91.4, p25: 93.2, p50: 94.8, p75: 96.6, p85: 97.9, p90: 99.0, p95: 101.0, p97: 102.4 },
    48: { p3: 95.4, p5: 96.5, p10: 98.2, p25: 100.3, p50: 102.2, p75: 104.4, p85: 105.9, p90: 107.2, p95: 109.5, p97: 111.2 },
    60: { p3: 101.2, p5: 102.5, p10: 104.4, p25: 106.9, p50: 109.2, p75: 111.8, p85: 113.6, p90: 115.2, p95: 117.9, p97: 119.9 },
    72: { p3: 106.5, p5: 108.0, p10: 110.2, p25: 113.0, p50: 115.7, p75: 118.8, p85: 120.9, p90: 122.7, p95: 125.9, p97: 128.2 },
    84: { p3: 111.4, p5: 113.1, p10: 115.6, p25: 118.8, p50: 121.9, p75: 125.5, p85: 128.0, p90: 130.1, p95: 133.8, p97: 136.5 },
    96: { p3: 116.1, p5: 118.0, p10: 120.8, p25: 124.4, p50: 127.9, p75: 132.1, p85: 135.0, p90: 137.4, p95: 141.7, p97: 144.8 },
    108: { p3: 120.7, p5: 122.8, p10: 125.9, p25: 130.0, p50: 134.0, p75: 138.8, p85: 142.2, p90: 145.0, p95: 149.8, p97: 153.4 },
    120: { p3: 125.4, p5: 127.6, p10: 131.1, p25: 135.7, p50: 140.2, p75: 145.6, p85: 149.4, p90: 152.6, p95: 158.0, p97: 162.0 },
    132: { p3: 130.3, p5: 132.8, p10: 136.6, p25: 141.8, p50: 146.7, p75: 152.6, p85: 156.8, p90: 160.3, p95: 166.2, p97: 170.6 },
    144: { p3: 135.7, p5: 138.4, p10: 142.5, p25: 148.1, p50: 153.3, p75: 159.5, p85: 163.9, p90: 167.6, p95: 173.6, p97: 178.1 },
    156: { p3: 141.8, p5: 144.6, p10: 148.9, p25: 154.6, p50: 159.9, p75: 166.0, p85: 170.3, p90: 173.9, p95: 179.7, p97: 184.0 },
    168: { p3: 148.3, p5: 151.1, p10: 155.3, p25: 160.8, p50: 165.9, p75: 171.6, p85: 175.5, p90: 178.8, p95: 184.2, p97: 188.2 },
    180: { p3: 154.6, p5: 157.2, p10: 161.2, p25: 166.3, p50: 171.1, p75: 176.3, p85: 179.9, p90: 182.9, p95: 187.8, p97: 191.4 },
    192: { p3: 160.2, p5: 162.7, p10: 166.4, p25: 171.2, p50: 175.6, p75: 180.4, p85: 183.7, p90: 186.4, p95: 190.8, p97: 194.1 },
    204: { p3: 164.9, p5: 167.2, p10: 170.7, p25: 175.2, p50: 179.3, p75: 183.8, p85: 186.9, p90: 189.3, p95: 193.4, p97: 196.4 },
    216: { p3: 168.6, p5: 170.7, p10: 174.1, p25: 178.3, p50: 182.2, p75: 186.5, p85: 189.3, p90: 191.6, p95: 195.4, p97: 198.2 },
    228: { p3: 171.3, p5: 173.3, p10: 176.5, p25: 180.5, p50: 184.2, p75: 188.3, p85: 191.0, p90: 193.1, p95: 196.7, p97: 199.3 },
    240: { p3: 173.2, p5: 175.1, p10: 178.2, p25: 182.1, p50: 185.7, p75: 189.7, p85: 192.2, p90: 194.3, p95: 197.7, p97: 200.2 }
  },
  female: {
    0: { p3: 45.4, p5: 46.1, p10: 47.1, p25: 48.2, p50: 49.1, p75: 50.2, p85: 51.0, p90: 51.7, p95: 52.9, p97: 53.7 },
    1: { p3: 50.0, p5: 50.7, p10: 51.8, p25: 52.9, p50: 53.7, p75: 54.8, p85: 55.6, p90: 56.2, p95: 57.6, p97: 58.4 },
    2: { p3: 53.4, p5: 54.1, p10: 55.2, p25: 56.4, p50: 57.1, p75: 58.3, p85: 59.1, p90: 59.8, p95: 61.1, p97: 62.1 },
    3: { p3: 56.2, p5: 56.9, p10: 58.0, p25: 59.2, p50: 59.8, p75: 61.1, p85: 61.9, p90: 62.6, p95: 63.4, p97: 64.5 },
    4: { p3: 58.5, p5: 59.2, p10: 60.4, p25: 61.6, p50: 62.1, p75: 63.4, p85: 64.3, p90: 65.0, p95: 66.4, p97: 67.5 },
    5: { p3: 60.5, p5: 61.2, p10: 62.4, p25: 63.7, p50: 64.2, p75: 65.5, p85: 66.4, p90: 67.2, p95: 68.5, p97: 69.7 },
    6: { p3: 62.2, p5: 62.9, p10: 64.1, p25: 65.4, p50: 65.7, p75: 67.3, p85: 68.2, p90: 69.0, p95: 69.8, p97: 71.1 },
    9: { p3: 66.8, p5: 67.5, p10: 68.8, p25: 70.2, p50: 70.4, p75: 72.0, p85: 73.0, p90: 73.9, p95: 75.0, p97: 76.4 },
    12: { p3: 69.8, p5: 70.6, p10: 71.9, p25: 73.4, p50: 74.0, p75: 75.6, p85: 76.7, p90: 77.6, p95: 78.9, p97: 80.3 },
    15: { p3: 72.6, p5: 73.4, p10: 74.8, p25: 76.3, p50: 76.9, p75: 78.6, p85: 79.7, p90: 80.7, p95: 82.1, p97: 83.6 },
    18: { p3: 75.2, p5: 76.0, p10: 77.4, p25: 79.0, p50: 79.6, p75: 81.4, p85: 82.5, p90: 83.5, p95: 85.0, p97: 86.5 },
    21: { p3: 77.6, p5: 78.4, p10: 79.9, p25: 81.5, p50: 82.1, p75: 84.0, p85: 85.1, p90: 86.2, p95: 87.7, p97: 89.3 },
    24: { p3: 79.7, p5: 80.6, p10: 82.1, p25: 83.7, p50: 84.4, p75: 86.2, p85: 87.4, p90: 88.5, p95: 90.1, p97: 91.7 },
    30: { p3: 83.8, p5: 84.7, p10: 86.3, p25: 88.0, p50: 88.9, p75: 90.8, p85: 92.1, p90: 93.2, p95: 94.9, p97: 96.6 },
    36: { p3: 87.4, p5: 88.3, p10: 90.0, p25: 91.7, p50: 92.8, p75: 94.8, p85: 96.1, p90: 97.3, p95: 99.1, p97: 100.9 },
    48: { p3: 93.9, p5: 95.0, p10: 96.9, p25: 99.0, p50: 100.3, p75: 102.7, p85: 104.3, p90: 105.6, p95: 107.9, p97: 109.8 },
    60: { p3: 99.7, p5: 101.0, p10: 103.2, p25: 105.7, p50: 107.4, p75: 110.2, p85: 112.1, p90: 113.7, p95: 116.5, p97: 118.7 },
    72: { p3: 105.0, p5: 106.5, p10: 109.0, p25: 111.9, p50: 114.0, p75: 117.2, p85: 119.5, p90: 121.4, p95: 124.8, p97: 127.3 },
    84: { p3: 110.0, p5: 111.7, p10: 114.5, p25: 117.8, p50: 120.3, p75: 124.0, p85: 126.6, p90: 128.8, p95: 132.8, p97: 135.6 },
    96: { p3: 114.8, p5: 116.7, p10: 119.8, p25: 123.5, p50: 126.4, p75: 130.6, p85: 133.6, p90: 136.2, p95: 140.7, p97: 144.0 },
    108: { p3: 119.5, p5: 121.6, p10: 125.0, p25: 129.1, p50: 132.4, p75: 137.1, p85: 140.5, p90: 143.4, p95: 148.5, p97: 152.2 },
    120: { p3: 124.2, p5: 126.5, p10: 130.3, p25: 134.8, p50: 138.4, p75: 143.5, p85: 147.2, p90: 150.4, p95: 155.9, p97: 159.9 },
    132: { p3: 129.1, p5: 131.6, p10: 135.6, p25: 140.4, p50: 144.2, p75: 149.5, p85: 153.3, p90: 156.7, p95: 162.2, p97: 166.3 },
    144: { p3: 134.1, p5: 136.7, p10: 140.8, p25: 145.7, p50: 149.5, p75: 154.7, p85: 158.4, p90: 161.7, p95: 166.9, p97: 170.7 },
    156: { p3: 138.8, p5: 141.4, p10: 145.4, p25: 150.2, p50: 153.9, p75: 158.8, p85: 162.2, p90: 165.3, p95: 170.1, p97: 173.6 },
    168: { p3: 142.7, p5: 145.2, p10: 149.1, p25: 153.7, p50: 157.2, p75: 161.8, p85: 165.0, p90: 167.9, p95: 172.3, p97: 175.5 },
    180: { p3: 145.7, p5: 148.1, p10: 151.8, p25: 156.2, p50: 159.5, p75: 163.9, p85: 166.9, p90: 169.6, p95: 173.7, p97: 176.7 },
    192: { p3: 147.8, p5: 150.0, p10: 153.6, p25: 157.8, p50: 161.0, p75: 165.2, p85: 168.0, p90: 170.6, p95: 174.5, p97: 177.3 },
    204: { p3: 149.2, p5: 151.3, p10: 154.8, p25: 158.9, p50: 162.0, p75: 166.0, p85: 168.7, p90: 171.2, p95: 175.0, p97: 177.6 },
    216: { p3: 150.1, p5: 152.1, p10: 155.5, p25: 159.5, p50: 162.5, p75: 166.4, p85: 169.0, p90: 171.4, p95: 175.0, p97: 177.6 },
    228: { p3: 150.7, p5: 152.6, p10: 156.0, p25: 159.9, p50: 162.8, p75: 166.7, p85: 169.2, p90: 171.6, p95: 175.1, p97: 177.6 },
    240: { p3: 151.0, p5: 152.9, p10: 156.2, p25: 160.1, p50: 163.0, p75: 166.8, p85: 169.3, p90: 171.7, p95: 175.2, p97: 177.6 }
  }
};

const MeasurementsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { childId, name } = route.params || {};
  const { darkMode } = useDarkMode();
  const theme = darkMode ? appTheme.dark : appTheme.light;
  const [showExportModal, setShowExportModal] = useState(false);
  const [childData, setChildData] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [showAddMeasurement, setShowAddMeasurement] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [newWeight, setNewWeight] = useState('');
  const [newHeight, setNewHeight] = useState('');
  const [measurementDate, setMeasurementDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (childId) {
      loadData();
    }
  }, [childId]);
const loadData = async () => {
  try {
    setIsLoading(true);
    
    // Load child data
    const childDoc = await getDoc(doc(db, 'children', childId));
    if (childDoc.exists()) {
      const data = childDoc.data();
      const childInfo = {
        ...data,
        sex: data.sex || data.gender,
        birthdate: data.birthdate || data.birthDate
      };
      setChildData(childInfo);
      
      // Pre-populate weight/height from child profile ONLY if no measurements exist yet
      // We'll check measurements first, then decide whether to preload
    }

    // Load measurements - Try with orderBy, fallback without
    let measurementsData = [];
    try {
      const measurementsQuery = query(
        collection(db, 'measurements'),
        where('childId', '==', childId),
        orderBy('date', 'asc')
      );
      const measurementsSnapshot = await getDocs(measurementsQuery);
      measurementsData = measurementsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (orderByError) {
      console.log('OrderBy failed, trying without:', orderByError);
      const measurementsQuery = query(
        collection(db, 'measurements'),
        where('childId', '==', childId)
      );
      const measurementsSnapshot = await getDocs(measurementsQuery);
      measurementsData = measurementsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }
    
    // Sort manually
    measurementsData.sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return dateA - dateB;
    });
    
    setMeasurements(measurementsData);
    
    // Only preload from profile if there are no measurements AND profile has data
    if (measurementsData.length === 0 && childDoc.exists()) {
      const data = childDoc.data();
      if (data.weight) {
        setNewWeight(String(data.weight));
      }
      if (data.height) {
        setNewHeight(String(data.height));
      }
      // Auto-open the form if there's data to preload
      if (data.weight || data.height) {
        setShowAddMeasurement(true);
      }
    }
  } catch (error) {
    console.error('Error loading data:', error);
    Alert.alert('Error', 'Failed to load measurements. Please try again.');
  } finally {
    setIsLoading(false);
  }
};

    const exportMeasurementsAsPDF = async (options) => {
  try {
    const date = new Date().toLocaleDateString();
    const { includeGrowthCharts, includeHistory } = options;
    
    // Calculate latest measurements and percentiles
    const latestMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;
    const ageMonths = latestMeasurement ? calculateAge(childData.birthdate, latestMeasurement.date) : calculateAge(childData.birthdate, new Date());
    
    let weightPercentile = 'N/A';
    let heightPercentile = 'N/A';
    
    if (latestMeasurement && childData) {
      weightPercentile = getPercentile(
        latestMeasurement.weight,
        ageMonths,
        childData.sex,
        'weight'
      ) || 'N/A';
      
      heightPercentile = getPercentile(
        latestMeasurement.height,
        ageMonths,
        childData.sex,
        'height'
      ) || 'N/A';
    }
    
    let htmlContent = `
      <html>
        <head>
          <style>
            body { 
              font-family: 'Helvetica', Arial, sans-serif; 
              padding: 30px;
              color: #333;
            }
            h1 { 
              color: #1976d2; 
              text-align: center;
              border-bottom: 3px solid #1976d2;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .header-info {
              text-align: center;
              color: #666;
              margin-bottom: 30px;
              font-size: 14px;
            }
            .current-stats {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin: 30px 0;
            }
            .stat-card {
              background: #f5f5f5;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #1976d2;
            }
            .stat-title {
              font-size: 14px;
              color: #666;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .stat-value {
              font-size: 32px;
              font-weight: bold;
              color: #1976d2;
              margin-bottom: 8px;
            }
            .stat-subtitle {
              font-size: 13px;
              color: #888;
            }
            .percentile-badge {
              display: inline-block;
              background: #e3f2fd;
              color: #1976d2;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 600;
              margin-top: 8px;
            }
            .section { 
              margin-top: 30px;
              page-break-inside: avoid;
            }
            .section-title { 
              font-size: 18px; 
              font-weight: bold; 
              color: #1976d2;
              border-bottom: 2px solid #e0e0e0;
              padding-bottom: 8px;
              margin-bottom: 15px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background: #1976d2;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: 600;
              font-size: 13px;
            }
            td {
              padding: 10px 12px;
              border-bottom: 1px solid #e0e0e0;
              font-size: 13px;
            }
            tr:nth-child(even) {
              background: #f8f9fa;
            }
            .growth-info {
              background: #e8f5e9;
              padding: 15px;
              border-radius: 8px;
              border-left: 3px solid #4caf50;
              margin: 20px 0;
              font-size: 13px;
              line-height: 1.6;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              text-align: center;
              color: #888;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <h1>${name}'s Growth Report</h1>
          <div class="header-info">
            Generated on ${date}<br>
            Current Age: ${Math.floor(ageMonths / 12)}y ${ageMonths % 12}m
          </div>
    `;

    // Current Measurements
    if (latestMeasurement) {
      htmlContent += `
        <div class="current-stats">
          <div class="stat-card">
            <div class="stat-title">📏 Current Weight</div>
            <div class="stat-value">${latestMeasurement.weight}</div>
            <div class="stat-subtitle">${latestMeasurement.weightUnit || 'lbs'}</div>
            <div class="percentile-badge">${weightPercentile} percentile</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">📐 Current Height</div>
            <div class="stat-value">${latestMeasurement.height}</div>
            <div class="stat-subtitle">${latestMeasurement.heightUnit || 'in'}</div>
            <div class="percentile-badge">${heightPercentile} percentile</div>
          </div>
        </div>
      `;
    }

    // Growth Information
    if (includeGrowthCharts) {
      htmlContent += `
        <div class="growth-info">
          <strong>About Growth Percentiles:</strong><br>
          Percentiles compare your child's measurements to CDC growth standards. A child at the 50th percentile 
          is exactly average - half of children are larger and half are smaller. Healthy children can be at any 
          percentile. What matters most is consistent growth over time along their own growth curve.
          <br><br>
          <strong>CDC Data Source:</strong> Centers for Disease Control and Prevention (cdc.gov/growthcharts)
        </div>
      `;
    }

    // Measurement History
    if (includeHistory && measurements.length > 0) {
      htmlContent += `
        <div class="section">
          <div class="section-title">📊 Measurement History</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Age</th>
                <th>Weight</th>
                <th>Height</th>
                <th>Weight %ile</th>
                <th>Height %ile</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      measurements.slice().reverse().forEach(m => {
        const mDate = m.date?.toDate ? m.date.toDate() : new Date(m.date);
        const mAge = m.ageAtMeasurement !== undefined 
          ? m.ageAtMeasurement 
          : calculateAge(childData.birthdate, mDate);
        
        const wPercentile = getPercentile(m.weight, mAge, childData.sex, 'weight') || 'N/A';
        const hPercentile = getPercentile(m.height, mAge, childData.sex, 'height') || 'N/A';
        
        htmlContent += `
          <tr>
            <td>${mDate.toLocaleDateString()}</td>
            <td>${Math.floor(mAge / 12)}y ${mAge % 12}m</td>
            <td>${m.weight} ${m.weightUnit || 'lbs'}</td>
            <td>${m.height} ${m.heightUnit || 'in'}</td>
            <td>${wPercentile}</td>
            <td>${hPercentile}</td>
          </tr>
        `;
      });
      
      htmlContent += `
            </tbody>
          </table>
        </div>
      `;
    }

    htmlContent += `
          <div class="footer">
            Growth Report generated by Baby Tracker App<br>
            Data compared to CDC Growth Charts
          </div>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    await Sharing.shareAsync(uri);
  } catch (err) {
    console.error("PDF Export Error:", err);
    Alert.alert("Error", "Could not generate PDF: " + err.message);
  }
};

const exportMeasurementsAsExcel = async (options) => {
  try {
    const { includeGrowthCharts, includeHistory } = options;
    
    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet
    const latestMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;
    const ageMonths = latestMeasurement ? calculateAge(childData.birthdate, latestMeasurement.date) : calculateAge(childData.birthdate, new Date());
    
    const summaryData = [
      [`${name}'s Growth Report`],
      [`Generated: ${new Date().toLocaleString()}`],
      [`Current Age: ${Math.floor(ageMonths / 12)}y ${ageMonths % 12}m`],
      [''],
      ['Current Measurements'],
      ['Metric', 'Value', 'Unit', 'Percentile'],
    ];

    if (latestMeasurement && childData) {
      const weightPercentile = getPercentile(latestMeasurement.weight, ageMonths, childData.sex, 'weight') || 'N/A';
      const heightPercentile = getPercentile(latestMeasurement.height, ageMonths, childData.sex, 'height') || 'N/A';
      
      summaryData.push(
        ['Weight', latestMeasurement.weight, latestMeasurement.weightUnit || 'lbs', weightPercentile],
        ['Height', latestMeasurement.height, latestMeasurement.heightUnit || 'in', heightPercentile]
      );
    }

    summaryData.push(
      [''],
      ['Total Measurements', measurements.length],
      [''],
      ['ℹ️ About Percentiles:'],
      ['Percentiles compare your child to CDC growth standards.'],
      ['What matters most is consistent growth along their own curve.']
    );

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    // 2. Measurement History Sheet
    if (includeHistory && measurements.length > 0) {
      const historyData = [
        ['Date', 'Age (months)', 'Age Display', 'Weight', 'Weight Unit', 'Weight Percentile', 'Height', 'Height Unit', 'Height Percentile'],
        ...measurements.map(m => {
          const mDate = m.date?.toDate ? m.date.toDate() : new Date(m.date);
          const mAge = m.ageAtMeasurement !== undefined 
            ? m.ageAtMeasurement 
            : calculateAge(childData.birthdate, mDate);
          
          const wPercentile = getPercentile(m.weight, mAge, childData.sex, 'weight') || 'N/A';
          const hPercentile = getPercentile(m.height, mAge, childData.sex, 'height') || 'N/A';
          
          return [
            mDate.toLocaleDateString(),
            mAge,
            `${Math.floor(mAge / 12)}y ${mAge % 12}m`,
            m.weight,
            m.weightUnit || 'lbs',
            wPercentile,
            m.height,
            m.heightUnit || 'in',
            hPercentile
          ];
        })
      ];
      
      const historySheet = XLSX.utils.aoa_to_sheet(historyData);
      historySheet['!cols'] = [
        { wch: 15 }, { wch: 12 }, { wch: 15 }, 
        { wch: 10 }, { wch: 12 }, { wch: 18 },
        { wch: 10 }, { wch: 12 }, { wch: 18 }
      ];
      XLSX.utils.book_append_sheet(wb, historySheet, "Measurement History");
    }

    // 3. Growth Reference Sheet (if included)
    if (includeGrowthCharts && childData) {
      const referenceData = [
        ['CDC Growth Reference Data'],
        [`Sex: ${childData.sex}`],
        [''],
        ['Age (months)', 'Weight 3rd %ile', 'Weight 50th %ile', 'Weight 97th %ile', 'Height 3rd %ile', 'Height 50th %ile', 'Height 97th %ile'],
      ];
      
      const genderDataWeight = CDC_WEIGHT_PERCENTILES[childData.sex.toLowerCase() === 'male' ? 'male' : 'female'];
      const genderDataHeight = CDC_HEIGHT_PERCENTILES[childData.sex.toLowerCase() === 'male' ? 'male' : 'female'];
      
      // Add key age milestones
      const keyAges = [0, 3, 6, 9, 12, 18, 24, 36, 48, 60, 72, 84, 96, 108, 120];
      keyAges.forEach(age => {
        if (genderDataWeight[age] && genderDataHeight[age]) {
          const weightUnit = childData.weightUnit === 'kg' ? 'kg' : 'lbs';
          const heightUnit = childData.heightUnit === 'cm' ? 'cm' : 'in';
          
          // Convert if needed
          const w3 = weightUnit === 'kg' ? genderDataWeight[age].p3 : genderDataWeight[age].p3 * 2.20462;
          const w50 = weightUnit === 'kg' ? genderDataWeight[age].p50 : genderDataWeight[age].p50 * 2.20462;
          const w97 = weightUnit === 'kg' ? genderDataWeight[age].p97 : genderDataWeight[age].p97 * 2.20462;
          
          const h3 = heightUnit === 'cm' ? genderDataHeight[age].p3 : genderDataHeight[age].p3 / 2.54;
          const h50 = heightUnit === 'cm' ? genderDataHeight[age].p50 : genderDataHeight[age].p50 / 2.54;
          const h97 = heightUnit === 'cm' ? genderDataHeight[age].p97 : genderDataHeight[age].p97 / 2.54;
          
          referenceData.push([
            age,
            `${w3.toFixed(1)} ${weightUnit}`,
            `${w50.toFixed(1)} ${weightUnit}`,
            `${w97.toFixed(1)} ${weightUnit}`,
            `${h3.toFixed(1)} ${heightUnit}`,
            `${h50.toFixed(1)} ${heightUnit}`,
            `${h97.toFixed(1)} ${heightUnit}`
          ]);
        }
      });
      
      referenceData.push(
        [''],
        ['Data Source: CDC Growth Charts (cdc.gov/growthcharts)']
      );
      
      const referenceSheet = XLSX.utils.aoa_to_sheet(referenceData);
      referenceSheet['!cols'] = [
        { wch: 12 }, { wch: 15 }, { wch: 16 }, { wch: 16 },
        { wch: 15 }, { wch: 16 }, { wch: 16 }
      ];
      XLSX.utils.book_append_sheet(wb, referenceSheet, "Growth Reference");
    }

    // Write and share
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const fileName = `${name}_Growth_Report.xlsx`;
    const uri = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(uri, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri);
    } else {
      Alert.alert('Success', `Report saved to ${uri}`);
    }
  } catch (err) {
    console.error('Excel Export Error:', err);
    Alert.alert('Error', `Failed to export Excel file: ${err.message}`);
  }
};

const handleExportMeasurements = async (options) => {
  if (options.format === 'pdf') {
    await exportMeasurementsAsPDF(options);
  } else {
    await exportMeasurementsAsExcel(options);
  }
};

const ExportMeasurementsModal = ({ visible, onClose }) => {
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [includeGrowthCharts, setIncludeGrowthCharts] = useState(true);
  const [includeHistory, setIncludeHistory] = useState(true);

  const handleExport = () => {
    const options = {
      format: selectedFormat,
      includeGrowthCharts,
      includeHistory,
    };
    
    handleExportMeasurements(options);
    onClose();
    
    // Reset options
    setSelectedFormat('pdf');
    setIncludeGrowthCharts(true);
    setIncludeHistory(true);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.exportModalOverlay}>
        <View style={[
          styles.exportModalContainer,
          { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }
        ]}>
          <View style={styles.exportModalHeader}>
            <Text style={[styles.exportModalTitle, { color: theme.textPrimary }]}>
              Export Growth Report
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.exportModalContent}>
            {/* Format Selection */}
            <Text style={[styles.exportSectionTitle, { color: theme.textPrimary }]}>
              Format
            </Text>
            <View style={styles.formatOptions}>
              <TouchableOpacity
                style={[
                  styles.formatOption,
                  selectedFormat === 'pdf' && styles.formatOptionSelected,
                  { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }
                ]}
                onPress={() => setSelectedFormat('pdf')}
              >
                <AntDesign 
                  name="file-pdf" 
                  size={24} 
                  color={selectedFormat === 'pdf' ? '#E53935' : theme.textSecondary} 
                />
                <Text style={[
                  styles.formatOptionText,
                  { color: selectedFormat === 'pdf' ? '#E53935' : theme.textPrimary }
                ]}>
                  PDF
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.formatOption,
                  selectedFormat === 'excel' && styles.formatOptionSelected,
                  { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }
                ]}
                onPress={() => setSelectedFormat('excel')}
              >
                <FontAwesome5 
                  name="file-excel" 
                  size={24} 
                  color={selectedFormat === 'excel' ? '#2E7D32' : theme.textSecondary} 
                />
                <Text style={[
                  styles.formatOptionText,
                  { color: selectedFormat === 'excel' ? '#2E7D32' : theme.textPrimary }
                ]}>
                  Excel
                </Text>
              </TouchableOpacity>
            </View>

            {/* Content Options */}
            <Text style={[styles.exportSectionTitle, { color: theme.textPrimary }]}>
              Include in Report
            </Text>
            
            <TouchableOpacity
              style={[
                styles.checkboxOption,
                { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }
              ]}
              onPress={() => setIncludeGrowthCharts(!includeGrowthCharts)}
            >
              <Ionicons 
                name={includeGrowthCharts ? 'checkbox' : 'square-outline'} 
                size={24} 
                color="#1976d2" 
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.checkboxLabel, { color: theme.textPrimary }]}>
                  Growth Chart Information
                </Text>
                <Text style={[styles.checkboxDescription, { color: theme.textSecondary }]}>
                  Include CDC percentile information and guidance
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.checkboxOption,
                { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }
              ]}
              onPress={() => setIncludeHistory(!includeHistory)}
            >
              <Ionicons 
                name={includeHistory ? 'checkbox' : 'square-outline'} 
                size={24} 
                color="#1976d2" 
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.checkboxLabel, { color: theme.textPrimary }]}>
                  Measurement History
                </Text>
                <Text style={[styles.checkboxDescription, { color: theme.textSecondary }]}>
                  Include all {measurements.length} recorded measurements
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.exportModalActions}>
            <TouchableOpacity
              style={[
                styles.exportCancelButton,
                { backgroundColor: darkMode ? '#2a2a2a' : '#f0f0f0' }
              ]}
              onPress={onClose}
            >
              <Text style={[styles.exportCancelText, { color: theme.textPrimary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.exportConfirmButton,
                { backgroundColor: '#1976d2' }
              ]}
              onPress={handleExport}
            >
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.exportConfirmText}>
                Export {selectedFormat.toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

    const calculateAge = (birthdate, measurementDate) => {
    try {
        // Handle various date formats
        let birth;
        if (birthdate?.toDate) {
        birth = birthdate.toDate();
        } else if (birthdate instanceof Date) {
        birth = birthdate;
        } else {
        birth = new Date(birthdate);
        }
        
        let measure;
        if (measurementDate?.toDate) {
        measure = measurementDate.toDate();
        } else if (measurementDate instanceof Date) {
        measure = measurementDate;
        } else {
        measure = new Date(measurementDate);
        }
        
        // Validate dates
        if (isNaN(birth.getTime()) || isNaN(measure.getTime())) {
        console.error('Invalid dates:', { birthdate, measurementDate });
        return 0;
        }
        
        const diffMonths = (measure.getFullYear() - birth.getFullYear()) * 12 + 
                        (measure.getMonth() - birth.getMonth());
        return Math.max(0, diffMonths); // Ensure non-negative
    } catch (error) {
        console.error('Error calculating age:', error);
        return 0;
    }
    };

  const getClosestAgeData = (ageMonths, genderData) => {
    const ages = Object.keys(genderData).map(Number).sort((a, b) => a - b);
    
    // Find the two closest ages for interpolation
    let lowerAge = ages[0];
    let upperAge = ages[ages.length - 1];
    
    for (let i = 0; i < ages.length - 1; i++) {
      if (ageMonths >= ages[i] && ageMonths <= ages[i + 1]) {
        lowerAge = ages[i];
        upperAge = ages[i + 1];
        break;
      }
    }
    
    // If exact match, return it
    if (genderData[ageMonths]) {
      return genderData[ageMonths];
    }
    
    // Linear interpolation
    const lowerData = genderData[lowerAge];
    const upperData = genderData[upperAge];
    const ratio = (ageMonths - lowerAge) / (upperAge - lowerAge);
    
    const interpolated = {};
    Object.keys(lowerData).forEach(percentile => {
      interpolated[percentile] = lowerData[percentile] + 
        (upperData[percentile] - lowerData[percentile]) * ratio;
    });
    
    return interpolated;
  };

    const getPercentile = (value, ageMonths, sex, type) => {
        const data = type === 'weight' ? CDC_WEIGHT_PERCENTILES : CDC_HEIGHT_PERCENTILES;
        
        let genderData;
        if (sex === 'Other') {
            // Average male and female percentiles for "Other" gender
            const maleData = data.male;
            const femaleData = data.female;
            genderData = {};
            
            // Get all age keys from male data (they're the same for both)
            Object.keys(maleData).forEach(ageKey => {
            genderData[ageKey] = {};
            Object.keys(maleData[ageKey]).forEach(percentile => {
                genderData[ageKey][percentile] = 
                (maleData[ageKey][percentile] + femaleData[ageKey][percentile]) / 2;
            });
            });
        } else {
            genderData = data[sex === 'Male' ? 'male' : 'female'];
        }
        
        const percentiles = getClosestAgeData(ageMonths, genderData);
        if (!percentiles) return null;
    
    // Convert value to metric if needed
    let metricValue = value;
    if (type === 'weight' && childData?.weightUnit === 'lbs') {
      metricValue = value * 0.453592; // lbs to kg
    } else if (type === 'height' && childData?.heightUnit === 'in') {
      metricValue = value * 2.54; // inches to cm
    }
    
    // Determine percentile range
    if (metricValue < percentiles.p3) return '< 3rd';
    if (metricValue < percentiles.p5) return '3-5th';
    if (metricValue < percentiles.p10) return '5-10th';
    if (metricValue < percentiles.p25) return '10-25th';
    if (metricValue < percentiles.p50) return '25-50th';
    if (metricValue < percentiles.p75) return '50-75th';
    if (metricValue < percentiles.p85) return '75-85th';
    if (metricValue < percentiles.p90) return '85-90th';
    if (metricValue < percentiles.p95) return '90-95th';
    if (metricValue < percentiles.p97) return '95-97th';
    return '> 97th';
  };

    const addMeasurement = async () => {
        const parsedWeight = newWeight && !isNaN(parseFloat(newWeight))
            ? parseFloat(newWeight)
            : null;

        const parsedHeight = newHeight && !isNaN(parseFloat(newHeight))
            ? parseFloat(newHeight)
            : null;

        if (parsedWeight === null && parsedHeight === null) {
            Alert.alert('Invalid Entry', 'Please enter valid numbers for weight or height.');
            return;
        }

        try {
            // Calculate the age at the time of this measurement
            const ageAtMeasurement = calculateAge(childData.birthdate, measurementDate);
            
            const measurement = {
            childId,
            weight: parsedWeight,
            weightUnit: childData.weightUnit || 'lbs',
            height: parsedHeight,
            heightUnit: childData.heightUnit || 'in',
            date: measurementDate,
            ageAtMeasurement: ageAtMeasurement,  // Store the calculated age
            createdAt: new Date(),
            };

        await addDoc(collection(db, 'measurements'), measurement);

        await updateDoc(doc(db, 'children', childId), {
        weight: parsedWeight,
        height: parsedHeight,
        lastMeasured: measurementDate,
        updatedAt: new Date(),
        });

        Alert.alert('Success', 'Measurement added successfully');
        setShowAddMeasurement(false);
        setNewWeight('');
        setNewHeight('');
        setMeasurementDate(new Date());
        await loadData();
    } catch (error) {
        console.error('Error adding measurement:', error);
        Alert.alert('Error', `Failed to add measurement: ${error.message}`);
    }
    };


    const renderGrowthChart = (type) => {
        if (!childData?.birthdate) {
            return (
            <View style={styles.noDataContainer}>
                <Ionicons name="alert-circle-outline" size={40} color={darkMode ? '#555' : '#ccc'} />
                <Text style={[styles.noDataText, { color: theme.textSecondary }]}>
                Birth date required to show growth chart
                </Text>
            </View>
            );
        }

        const sex = childData?.sex || 'Male';
        const cdcData = type === 'weight' ? CDC_WEIGHT_PERCENTILES : CDC_HEIGHT_PERCENTILES;

        // Determine user's preferred units
        const userWeightUnit = childData?.weightUnit || 'lbs';
        const userHeightUnit = childData?.heightUnit || 'in';
        const isMetricWeight = userWeightUnit === 'kg';
        const isMetricHeight = userHeightUnit === 'cm';

        let genderData;
        if (sex === 'Other') {
            const maleData = cdcData.male;
            const femaleData = cdcData.female;
            genderData = {};
            
            Object.keys(maleData).forEach(ageKey => {
                genderData[ageKey] = {};
                Object.keys(maleData[ageKey]).forEach(percentile => {
                genderData[ageKey][percentile] = 
                    (maleData[ageKey][percentile] + femaleData[ageKey][percentile]) / 2;
                });
            });
        } else {
            genderData = cdcData[sex.toLowerCase() === 'male' ? 'male' : 'female'];
        }

        const currentAge = calculateAge(childData.birthdate, new Date());
        const maxAge = Math.min(Math.max(currentAge + 12, 36), 240);
        
        const agePoints = [];
        const spacing = maxAge <= 36 ? 3 : maxAge <= 120 ? 6 : 12;
        for (let age = 0; age <= maxAge; age += spacing) {
            agePoints.push(age);
        }
        if (!agePoints.includes(maxAge)) {
            agePoints.push(maxAge);
        }

        const labels = agePoints.map(ageMonths => {
            const years = Math.floor(ageMonths / 12);
            const months = ageMonths % 12;
            if (ageMonths === 0) return 'Birth';
            if (years === 0) return `${months}m`;
            if (months === 0) return `${years}y`;
            return `${years}y\n${months}m`;
        });

        // FIXED: Convert CDC percentile data to user's preferred units
        const convertValue = (metricValue) => {
            if (type === 'weight') {
                return isMetricWeight ? metricValue : metricValue * 2.20462; // kg to lbs
            } else {
                return isMetricHeight ? metricValue : metricValue / 2.54; // cm to inches
            }
        };

        const p3Line = agePoints.map(age => {
            const percentiles = getClosestAgeData(age, genderData);
            return percentiles ? convertValue(percentiles.p3) : null;
        });

        const p10Line = agePoints.map(age => {
            const percentiles = getClosestAgeData(age, genderData);
            return percentiles ? convertValue(percentiles.p10) : null;
        });

        const p50Line = agePoints.map(age => {
            const percentiles = getClosestAgeData(age, genderData);
            return percentiles ? convertValue(percentiles.p50) : null;
        });

        const p90Line = agePoints.map(age => {
            const percentiles = getClosestAgeData(age, genderData);
            return percentiles ? convertValue(percentiles.p90) : null;
        });

        const p97Line = agePoints.map(age => {
            const percentiles = getClosestAgeData(age, genderData);
            return percentiles ? convertValue(percentiles.p97) : null;
        });

        // FIXED: Child's measurements - keep in user's preferred units
        const childDataPoints = measurements.map(m => {
        const measDate = m.date?.toDate ? m.date.toDate() : new Date(m.date);
        const ageMonths = calculateAge(childData.birthdate, measDate);

        let value = type === 'weight' ? m.weight : m.height;

        if (!value || isNaN(parseFloat(value))) return null;

        value = parseFloat(value);

        // Apply unit conversion correctly
        if (type === 'weight') {
            if (m.weightUnit === 'kg' && !isMetricWeight) value *= 2.20462;
            if (m.weightUnit === 'lbs' && isMetricWeight) value *= 0.453592;
        } else {
            if (m.heightUnit === 'cm' && !isMetricHeight) value /= 2.54;
            if (m.heightUnit === 'in' && isMetricHeight) value *= 2.54;
        }

        return { x: ageMonths, y: value };
        })
        .sort((a, b) => a.x - b.x);


        const chartData = {
            labels: labels,
            datasets: [
                {
                    data: p3Line,
                    color: () => 'rgba(244, 67, 54, 0.4)',
                    strokeWidth: 2,
                    withDots: false,
                },
                {
                    data: p10Line,
                    color: () => 'rgba(255, 152, 0, 0.4)',
                    strokeWidth: 2,
                    withDots: false,
                },
                {
                    data: p50Line,
                    color: () => 'rgba(76, 175, 80, 0.8)',
                    strokeWidth: 3,
                    withDots: false,
                },
                {
                    data: p90Line,
                    color: () => 'rgba(33, 150, 243, 0.4)',
                    strokeWidth: 2,
                    withDots: false,
                },
                {
                    data: p97Line,
                    color: () => 'rgba(156, 39, 176, 0.4)',
                    strokeWidth: 2,
                    withDots: false,
                },
                {
                    data: childDataPoints.map(p => p.y),
                    strokeWidth: 4,
                    withDots: true,
                    color: () => type === 'weight' ? '#667eea' : '#764ba2',
                }
            ]
        };

        const latestMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;
        const minWidthPerLabel = 60;
        const calculatedWidth = Math.max(width - 60, agePoints.length * minWidthPerLabel);

        // FIXED: Get the correct display value for latest measurement
        let displayValue = null;
        if (latestMeasurement) {
            let value = type === 'weight' ? latestMeasurement.weight : latestMeasurement.height;
            
            if (value) {
                value = parseFloat(value);
                
                // Convert if stored unit differs from display unit
                if (type === 'weight') {
                    if (latestMeasurement.weightUnit === 'kg' && !isMetricWeight) {
                        value = value * 2.20462;
                    } else if (latestMeasurement.weightUnit === 'lbs' && isMetricWeight) {
                        value = value * 0.453592;
                    }
                } else {
                    if (latestMeasurement.heightUnit === 'cm' && !isMetricHeight) {
                        value = value / 2.54;
                    } else if (latestMeasurement.heightUnit === 'in' && isMetricHeight) {
                        value = value * 2.54;
                    }
                }
                
                displayValue = value;
            }
        }

        return (
                <View 
                key={`${type}-chart-${JSON.stringify(measurements)}`}
                style={[styles.chartContainer, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}
                >
                <View style={styles.chartHeader}>
                    <View>
                        <Text style={[styles.chartTitle, { color: theme.textPrimary }]}>
                            {type === 'weight' ? 'Weight' : 'Height'} Growth
                        </Text>
                        {latestMeasurement && (
                            <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
                                Compared to CDC percentiles
                            </Text>
                        )}
                    </View>
                    {displayValue !== null && (
                        <View style={styles.currentValue}>
                            <Text style={[styles.currentValueLabel, { color: theme.textSecondary }]}>Current</Text>
                            <Text style={[styles.currentValueText, { color: theme.textPrimary }]}>
                                {displayValue.toFixed(1)}
                            </Text>
                            <Text style={[styles.currentValueUnit, { color: theme.textSecondary }]}>
                                {type === 'weight' ? userWeightUnit : userHeightUnit}
                            </Text>
                        </View>
                    )}
                </View>

                {measurements.length === 0 ? (
                    <View style={styles.noDataContainer}>
                        <Ionicons name="analytics-outline" size={40} color={darkMode ? '#555' : '#ccc'} />
                        <Text style={[styles.noDataText, { color: theme.textSecondary }]}>
                            No measurements recorded yet
                        </Text>
                        <Text style={[styles.noDataSubtext, { color: theme.textSecondary }]}>
                            Add your first measurement to see growth trends
                        </Text>
                    </View>
                ) : (
                    <>
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={true}
                            style={styles.chartScrollView}
                            contentContainerStyle={styles.chartScrollContent}
                            persistentScrollbar={true}
                        >
                            <View style={styles.chartWithYAxis}>
                                <View style={styles.yAxisLabelContainer}>
                                    <Text style={[styles.yAxisLabel, { color: theme.textSecondary }]}>
                                        {type === 'weight' 
                                            ? `Weight (${userWeightUnit})`
                                            : `Height (${userHeightUnit})`
                                        }
                                    </Text>
                                </View>
                                
                                <LineChart
                                    data={chartData}
                                    width={calculatedWidth}
                                    height={300}
                                    chartConfig={{
                                        backgroundGradientFrom: darkMode ? '#1c1c1c' : '#ffffff',
                                        backgroundGradientTo: darkMode ? '#1c1c1c' : '#ffffff',
                                        color: () => darkMode ? '#ffffff' : '#000000',
                                        labelColor: () => darkMode ? '#eeeeee' : '#555555',
                                        propsForDots: {
                                            r: '6',
                                            strokeWidth: '3',
                                            stroke: type === 'weight' ? '#667eea' : '#764ba2',
                                            fill: darkMode ? '#1c1c1c' : '#ffffff',
                                        },
                                        decimalPlaces: 1,
                                        propsForLabels: {
                                            fontSize: 10,
                                        },
                                        fillShadowGradient: type === 'weight' ? '#667eea' : '#764ba2',
                                        fillShadowGradientOpacity: 0.1,
                                    }}
                                    bezier
                                    style={{
                                        marginVertical: 8,
                                        borderRadius: 16,
                                        paddingRight: 50,
                                        marginLeft: 30,
                                    }}
                                    withVerticalLines={false}
                                    withHorizontalLines={true}
                                    withInnerLines={true}
                                    segments={5}
                                    fromZero={false}
                                    yAxisLabel=""
                                    yAxisSuffix=""
                                    yLabelsOffset={10}
                                    xLabelsOffset={-5}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.xAxisLabelContainer}>
                            <Text style={[styles.xAxisLabel, { color: theme.textSecondary }]}>
                                Age
                            </Text>
                        </View>

                        <View style={styles.legendContainer}>
                            <View style={styles.legendRow}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendLine, { backgroundColor: type === 'weight' ? '#667eea' : '#764ba2' }]} />
                                    <Text style={[styles.legendText, { color: theme.textPrimary, fontWeight: '700' }]}>
                                        {name || 'Child'}
                                    </Text>
                                </View>
                            </View>
                            
                            <Text style={[styles.legendSectionTitle, { color: theme.textSecondary }]}>CDC Percentiles</Text>
                            
                            <View style={styles.legendGrid}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendLine, { backgroundColor: 'rgba(76, 175, 80, 0.8)' }]} />
                                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>50th (Median)</Text>
                                </View>
                                
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendLine, { backgroundColor: 'rgba(33, 150, 243, 0.4)' }]} />
                                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>90th</Text>
                                </View>
                                
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendLine, { backgroundColor: 'rgba(156, 39, 176, 0.4)' }]} />
                                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>97th</Text>
                                </View>
                                
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendLine, { backgroundColor: 'rgba(255, 152, 0, 0.4)' }]} />
                                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>10th</Text>
                                </View>
                                
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendLine, { backgroundColor: 'rgba(244, 67, 54, 0.4)' }]} />
                                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>3rd</Text>
                                </View>
                            </View>
                        </View>

                        {latestMeasurement && (
                            <View style={[styles.percentileInfo, { backgroundColor: darkMode ? '#2a2a2a' : '#f0f7ff' }]}>
                                <LinearGradient
                                    colors={type === 'weight' ? ['#667eea', '#764ba2'] : ['#f093fb', '#f5576c']}
                                    style={styles.percentileIcon}
                                >
                                    <Ionicons name="analytics" size={16} color="#fff" />
                                </LinearGradient>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.percentileLabel, { color: theme.textSecondary }]}>
                                        Latest Percentile
                                    </Text>
                                    <Text style={[styles.percentileValue, { color: theme.textPrimary }]}>
                                        {getPercentile(
                                            type === 'weight' ? latestMeasurement.weight : latestMeasurement.height,
                                            calculateAge(childData.birthdate, latestMeasurement.date.toDate ? latestMeasurement.date.toDate() : new Date(latestMeasurement.date)),
                                            childData.sex,
                                            type
                                        )} percentile
                                    </Text>
                                </View>
                            </View>
                        )}
                    </>
                )}
            </View>
        );
    };

    const renderMeasurementHistory = () => {
        if (measurements.length === 0) return null;

        return (
        <View style={[styles.historyContainer, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Measurement History
            </Text>
            {measurements.slice().reverse().map((measurement, index) => {
            try {
                const date = measurement.date?.toDate ? measurement.date.toDate() : new Date(measurement.date);
                
                // Skip invalid measurements
                if (isNaN(date.getTime())) {
                console.error('Invalid date in measurement:', measurement);
                return null;
                }
                
                // Use the stored age at measurement, or calculate it if not available (for legacy data)
                const ageMonths = measurement.ageAtMeasurement !== undefined 
                    ? measurement.ageAtMeasurement 
                    : calculateAge(childData.birthdate, date);
            
            return (
            <View 
                key={measurement.id || index} 
                style={[
                styles.historyItem,
                { borderBottomColor: darkMode ? '#333' : '#e0e0e0' }
                ]}
            >
                <View style={styles.historyDate}>
                <Text style={[styles.historyDateText, { color: theme.textPrimary }]}>
                    {date.toLocaleDateString()}
                </Text>
                <Text style={[styles.historyAgeText, { color: theme.textSecondary }]}>
                    Age: {Math.floor(ageMonths / 12)}y {ageMonths % 12}m
                </Text>
                </View>
                <View style={styles.historyValues}>
                {measurement.weight != null && !isNaN(parseFloat(measurement.weight)) && (
                    <View style={styles.historyValue}>
                    <Ionicons name="scale-outline" size={16} color="#1976d2" />
                    <Text style={[styles.historyValueText, { color: theme.textPrimary }]}>
                        {parseFloat(measurement.weight).toFixed(1)} {measurement.weightUnit || 'lbs'}
                    </Text>
                    </View>
                )}
                {measurement.height != null && !isNaN(parseFloat(measurement.height)) && (
                    <View style={styles.historyValue}>
                    <Ionicons name="resize-outline" size={16} color="#FF9800" />
                    <Text style={[styles.historyValueText, { color: theme.textPrimary }]}>
                        {parseFloat(measurement.height).toFixed(1)} {measurement.heightUnit || 'in'}
                    </Text>
                    </View>
                )}
                {(measurement.weight == null || isNaN(parseFloat(measurement.weight))) && 
                (measurement.height == null || isNaN(parseFloat(measurement.height))) && (
                    <Text style={[styles.historyValueText, { color: theme.textSecondary, fontStyle: 'italic' }]}>
                    No measurements recorded
                    </Text>
                )}
                </View>
            </View>
            );
        } catch (error) {
            console.error('Error rendering measurement:', error, measurement);
            return null;
        }
        })}
      </View>
    );
  };

  const renderAddMeasurementForm = () => {
    if (!showAddMeasurement) return null;

    return (
      <View style={[styles.addForm, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
        <View style={styles.formHeader}>
          <Text style={[styles.formTitle, { color: theme.textPrimary }]}>
            Add New Measurement
          </Text>
          <TouchableOpacity onPress={() => setShowAddMeasurement(false)}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Date</Text>
          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: darkMode ? '#2a2a2a' : '#f8f9fa' }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#1976d2" />
            <Text style={[styles.dateButtonText, { color: theme.textPrimary }]}>
              {measurementDate.toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={measurementDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                setMeasurementDate(selectedDate);
              }
            }}
            maximumDate={new Date()}
          />
        )}

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: theme.textSecondary }]}>
            Weight ({childData?.weightUnit || 'lbs'})
          </Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: darkMode ? '#2a2a2a' : '#f8f9fa',
              color: theme.textPrimary 
            }]}
            placeholder="0.0"
            placeholderTextColor={darkMode ? '#666' : '#999'}
            keyboardType="decimal-pad"
            value={newWeight}
            onChangeText={setNewWeight}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: theme.textSecondary }]}>
            Height ({childData?.heightUnit || 'in'})
          </Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: darkMode ? '#2a2a2a' : '#f8f9fa',
              color: theme.textPrimary 
            }]}
            placeholder="0.0"
            placeholderTextColor={darkMode ? '#666' : '#999'}
            keyboardType="decimal-pad"
            value={newHeight}
            onChangeText={setNewHeight}
          />
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={addMeasurement}
        >
          <LinearGradient
            colors={['#1976d2', '#1565c0']}
            style={styles.submitButtonGradient}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>Add Measurement</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  const shouldRemindMeasurement = () => {
    if (measurements.length === 0) return true;
    
    const lastMeasurement = measurements[measurements.length - 1];
    const lastDate = lastMeasurement.date.toDate ? lastMeasurement.date.toDate() : new Date(lastMeasurement.date);
    const daysSince = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
    
    const ageMonths = calculateAge(childData?.birthdate, new Date());
    if (ageMonths < 6) return daysSince > 30;
    if (ageMonths < 24) return daysSince > 60;
    return daysSince > 90;
  };

  
  if (isLoading) {
    return (
      <LinearGradient colors={theme.backgroundGradient} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading measurements...
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton} activeOpacity={0.7}>
            <LinearGradient colors={darkMode ? darkModeGradients.card : ['#fff', '#f5f5f5']} style={styles.headerButtonGradient}>
              <ArrowLeft size={20} color={darkMode ? '#fff' : '#2E3A59'} />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            {name}'s Growth
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.scrollView}>
          {shouldRemindMeasurement() && (
            <View style={[styles.reminderBanner, { backgroundColor: darkMode ? '#4a3a1a' : '#FFF9C4' }]}>
              <Ionicons name="notifications-outline" size={20} color="#FF9800" />
              <Text style={[styles.reminderText, { color: darkMode ? '#FFD54F' : '#F57C00' }]}>
                Time to record new measurements!
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: darkMode ? '#1a3a52' : '#1976d2' }]}
            onPress={() => setShowAddMeasurement(!showAddMeasurement)}
          >
            <Ionicons name={showAddMeasurement ? "close" : "add-circle-outline"} size={20} color="#fff" />
            <Text style={styles.addButtonText}>
              {showAddMeasurement ? 'Cancel' : 'Add New Measurement'}
            </Text>
          </TouchableOpacity>

          {renderAddMeasurementForm()}
          {renderGrowthChart('weight')}
          {renderGrowthChart('height')}
          {renderMeasurementHistory()}

          {/* Export Section */}
            {/* {measurements.length > 0 && (
            <View style={[
                styles.exportMeasurementsContainer,
                { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }
            ]}>
                <View style={styles.exportMeasurementsHeader}>
                <View>
                    <Text style={[styles.exportMeasurementsTitle, { color: theme.textPrimary }]}>
                    Export Growth Report
                    </Text>
                    <Text style={[styles.exportMeasurementsSubtitle, { color: theme.textSecondary }]}>
                    Share measurements with your pediatrician
                    </Text>
                </View>
                </View>
                
                <TouchableOpacity
                style={styles.exportMeasurementsButton}
                onPress={() => setShowExportModal(true)}
                >
                <LinearGradient
                    colors={['#1976d2', '#1565c0']}
                    style={styles.exportMeasurementsGradient}
                >
                    <Ionicons name="download-outline" size={20} color="#fff" />
                    <Text style={styles.exportMeasurementsButtonText}>
                    Export Report
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                </LinearGradient>
                </TouchableOpacity>
            </View>
            )} */}

            {/* Export Modal */}
            {/* <ExportMeasurementsModal
            visible={showExportModal}
            onClose={() => setShowExportModal(false)}
            /> */}

                    <View style={[styles.infoCard, { backgroundColor: darkMode ? '#1a2332' : '#f0f7ff' }]}>
                    <LinearGradient
                        colors={['#667eea', '#764ba2']}
                        style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Ionicons name="information-circle" size={20} color="#fff" />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.infoText, { color: theme.textPrimary, fontWeight: '600', marginBottom: 6 }]}>
                        About Growth Charts
                        </Text>
                        <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                        Percentiles compare your child to CDC standards. Consult your pediatrician for personalized guidance.
                        </Text>
                    </View>
                    </View>

                    <View style={[styles.sourceCard, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
                    <Ionicons name="document-text-outline" size={16} color="#666" />
                    <Text style={[styles.sourceText, { color: theme.textSecondary }]}>
                        Data source: CDC Growth Charts (cdc.gov/growthcharts/cdc-data-files.htm)
                    </Text>
                    </View>
                    </ScrollView>
                </SafeAreaView>
                </LinearGradient>
            );
            };

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { 
    flex: 1, 
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight + 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
    paddingHorizontal: 5,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  scrollView: { flex: 1 },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  reminderText: { 
    flex: 1, 
    fontSize: 14, 
    fontWeight: '600',
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 10,
    elevation: 6,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  addButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  addForm: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  formTitle: { 
    fontSize: 20, 
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  formGroup: { marginBottom: 18 },
  formLabel: { 
    fontSize: 14, 
    fontWeight: '700', 
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: { 
    borderRadius: 12, 
    padding: 14, 
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dateButtonText: { 
    fontSize: 16,
    fontWeight: '500',
  },
  submitButton: { 
    borderRadius: 16, 
    overflow: 'hidden', 
    marginTop: 10,
    elevation: 6,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 10,
  },
  submitButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  chartContainer: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'visible',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  chartTitle: { 
    fontSize: 20, 
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  chartSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  currentValue: { alignItems: 'flex-end' },
  currentValueLabel: { 
    fontSize: 11, 
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentValueText: { 
    fontSize: 28, 
    fontWeight: '800',
    marginTop: 4,
  },
  currentValueUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  chartScrollView: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
    marginLeft: -40,
  },
  chartScrollContent: {
    paddingRight: 0,
    paddingLeft: 0,
  },
  legendContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    gap: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendLine: {
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 13,
    fontWeight: '500',
  },
  percentileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
    gap: 12,
  },
  percentileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentileLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  percentileValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  historyContainer: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  historyItem: { 
    paddingVertical: 16, 
    borderBottomWidth: 1,
  },
  historyDate: { marginBottom: 10 },
  historyDateText: { 
    fontSize: 15, 
    fontWeight: '700',
  },
  historyAgeText: { 
    fontSize: 13, 
    marginTop: 4,
    fontWeight: '500',
  },
  historyValues: { 
    flexDirection: 'row', 
    gap: 24,
  },
  historyValue: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
  },
  historyValueText: { 
    fontSize: 15,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(25, 118, 210, 0.1)',
  },
  infoText: { 
    flex: 1, 
    fontSize: 13, 
    lineHeight: 20,
    fontWeight: '500',
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingBottom: 100,
  },
  loadingText: { 
    marginTop: 16, 
    fontSize: 16,
    fontWeight: '600',
  },
  noDataContainer: { 
    padding: 40, 
    alignItems: 'center',
  },
  noDataText: { 
    marginTop: 16, 
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  noDataSubtext: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 30,
    gap: 10,
    opacity: 0.7,
  },
  sourceText: { 
    flex: 1, 
    fontSize: 11, 
    lineHeight: 16,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  legendSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
    },
    legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    rowGap: 10,
    },
    chartWithYAxis: {
    position: 'relative',
    paddingLeft: 0,
    },
    yAxisLabelContainer: {
    position: 'absolute',
    left: -60,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    width: 50,
    zIndex: 10,
    },
    yAxisLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    transform: [{ rotate: '-90deg' }],
    width: 150,
    textAlign: 'center',
    position: 'absolute',
    },
    xAxisLabelContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
    },
    xAxisLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    },
    headerButton: {
        borderRadius: 16,
        elevation: 5,
        left: 15,
    },
    headerButtonGradient: {
        width: 44,
        height: 44,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    exportMeasurementsContainer: {
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: 16,
  marginBottom: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 4,
},
exportMeasurementsHeader: {
  marginBottom: 12,
},
exportMeasurementsTitle: {
  fontSize: 18,
  fontWeight: '700',
  marginBottom: 4,
},
exportMeasurementsSubtitle: {
  fontSize: 13,
  fontStyle: 'italic',
},
exportMeasurementsButton: {
  borderRadius: 12,
  overflow: 'hidden',
  shadowColor: '#1976d2',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 3,
},
exportMeasurementsGradient: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: 14,
  paddingHorizontal: 20,
},
exportMeasurementsButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '700',
  marginLeft: 10,
},
exportModalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'flex-end',
},
exportModalContainer: {
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  maxHeight: '80%',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: -2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 5,
},
exportModalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 20,
  borderBottomWidth: 1,
  borderBottomColor: '#e0e0e0',
},
exportModalTitle: {
  fontSize: 20,
  fontWeight: '700',
},
exportModalContent: {
  padding: 20,
},
exportSectionTitle: {
  fontSize: 16,
  fontWeight: '600',
  marginBottom: 12,
  marginTop: 8,
},
formatOptions: {
  flexDirection: 'row',
  gap: 12,
  marginBottom: 20,
},
formatOption: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  borderRadius: 12,
  gap: 10,
},
formatOptionSelected: {
  borderWidth: 2,
  borderColor: '#1976d2',
},
formatOptionText: {
  fontSize: 16,
  fontWeight: '600',
},
checkboxOption: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 14,
  borderRadius: 10,
  marginBottom: 10,
  gap: 12,
},
checkboxLabel: {
  fontSize: 15,
  fontWeight: '600',
  marginBottom: 4,
},
checkboxDescription: {
  fontSize: 12,
  lineHeight: 16,
},
exportModalActions: {
  flexDirection: 'row',
  padding: 20,
  borderTopWidth: 1,
  borderTopColor: '#e0e0e0',
  gap: 10,
},
exportCancelButton: {
  flex: 1,
  paddingVertical: 14,
  borderRadius: 10,
  alignItems: 'center',
},
exportCancelText: {
  fontSize: 15,
  fontWeight: '600',
},
exportConfirmButton: {
  flex: 2,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 14,
  borderRadius: 10,
  gap: 8,
},
exportConfirmText: {
  color: '#fff',
  fontSize: 15,
  fontWeight: '700',
},
});

export default MeasurementsScreen;