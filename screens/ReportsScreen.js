import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Image,
  Alert,
  Modal
} from 'react-native';
import { ScrollView } from 'react-native';
import * as XLSX from 'xlsx';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { FontAwesome5 } from '@expo/vector-icons';
import StackedBarChart from './StackedBarChart';
import WeeklySummaryCard from '../src/components/WeeklySummaryCard';
import OpenAI from 'openai';
import * as FileSystem from 'expo-file-system/legacy';
import { getAuth } from 'firebase/auth';
import { useDarkMode } from './DarkMode';
import { appTheme } from './ThemedBackground';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EnhancedSummaryCard,
  MetricsGrid,
  enhancedStyles
} from './ReportComponents';
import OverviewTab from './OverviewTab';
import ExportOptionsModal from './ExportOptionsModal';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const { width } = Dimensions.get('window');
const adjustedWidth = width - 40;

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

const getAICalorieEstimate = async (feedType, amount, unit) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a nutritionist. Provide only a single number representing estimated calories. No explanation, just the number.'
          },
          {
            role: 'user',
            content: `Estimate calories for: ${amount || 'one serving'} ${unit || 'serving'} of ${feedType || 'food'}. Reply with only the number.`
          }
        ],
        max_tokens: 20,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    const caloriesText = data.choices[0]?.message?.content?.trim() || '0';
    const calories = parseInt(caloriesText.replace(/[^0-9]/g, '')) || 0;
    return calories;
  } catch (error) {
    console.error('Error getting AI calorie estimate:', error);
    return 0;
  }
};


const FeedingBreakdownPieChart = ({ feedingData, darkMode, theme, hasAIConsent }) => {
  const [calorieData, setCalorieData] = useState({});
  const [isLoadingCalories, setIsLoadingCalories] = useState(false);
  const [caloriesCalculated, setCaloriesCalculated] = useState(false);

  const calculateCalories = async () => {
    if (!hasAIConsent || caloriesCalculated || isLoadingCalories) {
      console.log('Skipping calorie calculation:', { hasAIConsent, caloriesCalculated, isLoadingCalories });
      return;
    }
    
    console.log('Starting calorie calculation for', feedingData.length, 'logs');
    setIsLoadingCalories(true);
    const newCalorieData = {};
    
    try {
      // Process in batches to avoid rate limits
      for (let i = 0; i < feedingData.length; i++) {
        const log = feedingData[i];
        const type = log.feedType || 'Other';
        
        if (!newCalorieData[type]) {
          newCalorieData[type] = { total: 0, count: 0 };
        }
        
        // Get AI estimate for this feeding
        console.log(`Processing ${i + 1}/${feedingData.length}: ${type}`);
        const calories = await getAICalorieEstimate(type, log.amount, log.amountUnit);
        newCalorieData[type].total += calories;
        newCalorieData[type].count++;
        
        // Small delay to avoid rate limiting (every 5 requests)
        if (i % 5 === 4 && i < feedingData.length - 1) {
          console.log('Pausing to avoid rate limit...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log('Calorie calculation complete:', newCalorieData);
      setCalorieData(newCalorieData);
      setCaloriesCalculated(true);
    } catch (error) {
      console.error('Error calculating calories:', error);
      Alert.alert('Error', 'Failed to calculate calorie estimates. Please try again.');
    } finally {
      setIsLoadingCalories(false);
    }
  };

  const feedTypeData = {};
  
  feedingData.forEach(log => {
    const type = log.feedType || 'Other';
    
    if (!feedTypeData[type]) {
      feedTypeData[type] = { count: 0, totalCalories: 0 };
    }
    
    feedTypeData[type].count++;
    
    if (hasAIConsent && calorieData[type]) {
      feedTypeData[type].totalCalories = calorieData[type].total;
    }
  });
  
  const colors = ['#1976d2', '#FF9800', '#4CAF50', '#F44336', '#9C27B0', '#00BCD4'];
  
  const pieData = Object.entries(feedTypeData)
    .map(([type, data], index) => ({
      name: type,
      count: data.count,
      calories: hasAIConsent && calorieData[type] ? Math.round(data.totalCalories) : null,
      color: colors[index % colors.length],
      legendFontColor: darkMode ? '#ddd' : '#333',
      legendFontSize: 12
    }))
    .sort((a, b) => b.count - a.count);
  
  if (pieData.length === 0) {
    return (
      <Text style={[styles.noDataText, { color: theme.textSecondary, textAlign: 'center', marginVertical: 20 }]}>
        No feeding data available for breakdown
      </Text>
    );
  }
  
  return (
    <>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <PieChart
          data={pieData}
          width={adjustedWidth}
          height={220}
          chartConfig={{
            color: (opacity = 1) => darkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor="count"
          backgroundColor="transparent"
          paddingLeft="15"
          center={[adjustedWidth / 4, 0]}
          absolute
          hasLegend={false}
        />
      </View>
      
      <View style={styles.interactiveLegendContainer}>
        {hasAIConsent && (
          <View style={{ marginBottom: 10, alignItems: 'center' }}>
            {/* {!caloriesCalculated && !isLoadingCalories && (
              <TouchableOpacity
                style={[
                  styles.calculateCaloriesButton,
                  { backgroundColor: darkMode ? '#1a3a52' : '#1976d2' }
                ]}
                onPress={calculateCalories}
              >
                <Ionicons name="sparkles" size={16} color="#fff" />
                <Text style={styles.calculateCaloriesButtonText}>
                  Get AI Calorie Estimates
                </Text>
              </TouchableOpacity>
            )} */}
            {isLoadingCalories && (
              <View style={styles.calorieLoadingContainer}>
                <ActivityIndicator size="small" color={darkMode ? '#64b5f6' : '#1976d2'} />
                <Text style={[styles.calorieLoadingText, { color: theme.textSecondary }]}>
                  Calculating calories with AI... ({Object.keys(calorieData).length}/{Object.keys(feedTypeData).length} types)
                </Text>
              </View>
            )}
          </View>
        )}
        
        <Text style={[styles.legendTitle, { color: theme.textSecondary }]}>
          {hasAIConsent && caloriesCalculated
            ? 'Tap to view AI-estimated calories & details' 
            : 'Tap to view feeding frequency details'}
        </Text>
        <View style={styles.legendGrid}>
          {pieData.map((item, index) => {
            const percentage = Math.round((item.count / feedingData.length) * 100);
            
            return (
              <TouchableOpacity 
                key={index}
                style={[
                  styles.legendItemCard, 
                  { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }
                ]}
                onPress={() => {
                  const message = hasAIConsent && item.calories
                    ? `Feedings: ${item.count} (${percentage}%)\nAI-Estimated Calories: ~${item.calories} cal\n\nNote: Calorie estimates are AI-generated approximations. For accurate nutrition tracking, consult your pediatrician.`
                    : `Feedings: ${item.count} (${percentage}%)\n\nThis represents ${percentage}% of all feeding sessions in this period.`;
                  
                  Alert.alert(item.name, message, [{ text: 'OK' }]);
                }}
              >
                <View style={[styles.legendColorDot, { backgroundColor: item.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.legendItemText, { color: theme.textPrimary }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.legendItemCount, { color: theme.textSecondary, fontSize: 10 }]}>
                    {item.count} feedings ({percentage}%)
                  </Text>
                  {hasAIConsent && item.calories && caloriesCalculated && (
                    <Text style={[styles.legendItemCount, { color: theme.textSecondary, fontSize: 9, fontStyle: 'italic' }]}>
                      ~{item.calories} cal (AI est.)
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      
      {hasAIConsent && caloriesCalculated && (
        <View style={[
          styles.calorieDisclaimer,
          { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }
        ]}>
          <Ionicons name="information-circle-outline" size={16} color={darkMode ? '#64b5f6' : '#1976d2'} />
          <Text style={[
            styles.disclaimerText,
            { color: darkMode ? '#bbb' : '#666' }
          ]}>
            Calorie estimates are AI-generated approximations based on typical values. For accurate nutrition tracking, consult your pediatrician.
          </Text>
        </View>
      )}
    </>
  );
};

const SleepMetricsSummary = ({ data, darkMode }) => {
  const totalSleep = data.summary?.find(s => s.key === 'total');
  const nightSleep = data.summary?.find(s => s.key === 'night');
  const naps = data.summary?.find(s => s.key === 'naps');
  const sessions = data.summary?.find(s => s.key === 'sessions');

  const getSleepQualityStatus = (avg, benchmark) => {
    const ratio = parseFloat(avg) / benchmark;
    if (ratio >= 0.95) return { status: 'Excellent', color: '#4CAF50', icon: 'checkmark-circle' };
    if (ratio >= 0.80) return { status: 'Good', color: '#8BC34A', icon: 'checkmark-circle-outline' };
    if (ratio >= 0.65) return { status: 'Fair', color: '#FF9800', icon: 'alert-circle' };
    return { status: 'Needs Attention', color: '#F44336', icon: 'alert-circle' };
  };

  const quality = totalSleep ? getSleepQualityStatus(totalSleep.avg, totalSleep.benchmark) : null;

  return (
    <View style={styles.metricsSummaryContainer}>


      <View style={[
        styles.sleepBreakdownContainer,
        { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }
      ]}>
          <View style={[
            styles.sleepBreakdownItem,
            {
              backgroundColor: darkMode ? '#2a2a2a' : '#fff',
              borderWidth: 1,
              borderColor: darkMode ? '#404040' : '#e0e0e0'
            }
          ]}>
          <View style={styles.sleepBreakdownIcon}>
            <Ionicons name="moon" size={18} color="#1976d2" />
          </View>
          <View style={styles.sleepBreakdownInfo}>
            <Text style={[
              styles.sleepBreakdownLabel,
              { color: darkMode ? '#999' : '#999' }
            ]}>
              Night Sleep
            </Text>
            <Text style={[
              styles.sleepBreakdownValue,
              { color: darkMode ? '#fff' : '#333' }
            ]}>
              {nightSleep?.avg || 0}{nightSleep?.unit || ''}
            </Text>
          </View>
        </View>

        <View style={[
          styles.sleepBreakdownItem,
          {
            backgroundColor: darkMode ? '#2a2a2a' : '#fff',
            borderColor: darkMode ? '#404040' : '#e0e0e0'
          }
        ]}>
          <View style={styles.sleepBreakdownIcon}>
            <Ionicons name="partly-sunny" size={18} color="#FF9800" />
          </View>
          <View style={styles.sleepBreakdownInfo}>
            <Text style={[
              styles.sleepBreakdownLabel,
              { color: darkMode ? '#999' : '#999' }
            ]}>
              Daytime Naps
            </Text>
            <Text style={[
              styles.sleepBreakdownValue,
              { color: darkMode ? '#fff' : '#333' }
            ]}>
              {naps?.avg || 0}{naps?.unit || ''}
            </Text>
          </View>
        </View>

        <View style={[
          styles.sleepBreakdownItem,
          {
            backgroundColor: darkMode ? '#2a2a2a' : '#fff',
            borderColor: darkMode ? '#404040' : '#e0e0e0'
          }
        ]}>
          <View style={styles.sleepBreakdownIcon}>
            <Ionicons name="repeat" size={18} color="#00BCD4" />
          </View>
          <View style={styles.sleepBreakdownInfo}>
            <Text style={[
              styles.sleepBreakdownLabel,
              { color: darkMode ? '#999' : '#999' }
            ]}>
              Total Sessions
            </Text>
            <Text style={[
              styles.sleepBreakdownValue,
              { color: darkMode ? '#fff' : '#333' }
            ]}>
              {sessions?.avg || 0}{sessions?.unit || ''}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const DataSufficiencyWarning = ({ reportRange, childAge, dataCount, darkMode }) => {
  const getWarning = () => {
    // Check if child is younger than report range
    if (reportRange === 'Monthly' && childAge < 1) {
      return {
        show: true,
        message: "Your child is less than 1 month old. Monthly reports may show limited data.",
        severity: 'info'
      };
    }
    
    if (reportRange === 'Annual' && childAge < 12) {
      return {
        show: true,
        message: "Your child is less than 1 year old. Annual reports may show limited data.",
        severity: 'info'
      };
    }
    
    // Check data sufficiency
    const expectedEntries = reportRange === 'Weekly' ? 14 : reportRange === 'Monthly' ? 60 : 365;
    
    if (dataCount < expectedEntries * 0.3) {
      return {
        show: true,
        message: `Limited data available for this ${reportRange.toLowerCase()} period. Insights may be less accurate.`,
        severity: 'warning'
      };
    }
    
    return { show: false };
  };
  
  const warning = getWarning();
  
  if (!warning.show) return null;
  
  const severityColors = {
    info: { bg: darkMode ? '#1a3a52' : '#E3F2FD', border: '#2196F3', icon: 'information-circle' },
    warning: { bg: darkMode ? '#4a3a1a' : '#FFF9C4', border: '#FF9800', icon: 'warning' }
  };
  
  const colors = severityColors[warning.severity];
  
  return (
    <View style={[
      styles.dataSufficiencyWarning,
      { 
        backgroundColor: colors.bg,
        borderLeftColor: colors.border
      }
    ]}>
      <Ionicons name={colors.icon} size={20} color={colors.border} />
      <Text style={[
        styles.dataSufficiencyText,
        { color: darkMode ? '#e0e0e0' : '#333' }
      ]}>
        {warning.message}
      </Text>
    </View>
  );
};

// Feeding Summary Component
const FeedingMetricsSummary = ({ data, darkMode  }) => {
  const perDay = data.summary?.find(s => s.key === 'perDay');
  const avgGap = data.summary?.find(s => s.key === 'avgGap');
  const avgAmount = data.summary?.find(s => s.key === 'avgAmount');
  const mostCommon = data.summary?.find(s => s.key === 'mostCommon');

  const getFeedingStatus = (perDay, avgGap) => {
    const gapHours = parseFloat(avgGap);
    if (gapHours >= 3 && gapHours <= 4 && parseFloat(perDay) >= 5) {
      return { status: 'Regular Pattern', color: '#4CAF50', icon: 'checkmark-circle' };
    }
    if (gapHours > 5) {
      return { status: 'Long Gaps', color: '#FF9800', icon: 'alert-circle' };
    }
    if (gapHours < 2.5) {
      return { status: 'Frequent Feedings', color: '#FF9800', icon: 'alert-circle' };
    }
    return { status: 'Normal Pattern', color: '#4CAF50', icon: 'checkmark-circle' };
  };

  const status = perDay && avgGap ? getFeedingStatus(perDay.avg, avgGap.avg) : null;

  return (
    <View style={styles.metricsSummaryContainer}>
      {status && (
        <View style={[
          styles.qualityStatusBanner, 
          { 
            backgroundColor: status.color + (darkMode ? '25' : '15'),
            borderLeftColor: status.color 
          }
        ]}>
          <Ionicons name={status.icon} size={24} color={status.color} />
          <View style={styles.qualityStatusText}>
            <Text style={[styles.qualityStatusLabel, { color: status.color }]}>
              {status.status}
            </Text>
            <Text style={[
              styles.qualityStatusDescription,
              { color: darkMode ? '#bbb' : '#666' }
            ]}>
              {perDay?.avg || 0} feedings/day, avg {avgGap?.avg || 0}hrs apart
            </Text>
          </View>
        </View>
      )}

      <View style={[
        styles.feedingDetailsContainer,
        { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }
      ]}>
        <View style={[
          styles.feedingDetailRow,
          { borderBottomColor: darkMode ? '#333' : '#f0f0f0' }
        ]}>
          <View style={styles.feedingDetailLabel}>
            <Ionicons name="restaurant" size={18} color="#FF9800" />
            <Text style={[
              styles.feedingDetailText,
              { color: darkMode ? '#e0e0e0' : '#333' }
            ]}>
              Per Day
            </Text>
          </View>
          <Text style={[
            styles.feedingDetailValue,
            { color: darkMode ? '#fff' : '#333' }
          ]}>
            {perDay?.avg || 0} feedings
          </Text>
        </View>

        <View style={[
          styles.feedingDetailRow,
          { borderBottomColor: darkMode ? '#333' : '#f0f0f0' }
        ]}>
          <View style={styles.feedingDetailLabel}>
            <Ionicons name="time" size={18} color="#FF9800" />
            <Text style={[
              styles.feedingDetailText,
              { color: darkMode ? '#e0e0e0' : '#333' }
            ]}>
              Avg Gap
            </Text>
          </View>
          <Text style={[
            styles.feedingDetailValue,
            { color: darkMode ? '#fff' : '#333' }
          ]}>
            {avgGap?.avg || 0}hrs
          </Text>
        </View>

        <View style={[
          styles.feedingDetailRow,
          { borderBottomWidth: 0 }
        ]}>
          <View style={styles.feedingDetailLabel}>
            <Ionicons name="alarm" size={18} color="#FF9800" />
            <Text style={[
              styles.feedingDetailText,
              { color: darkMode ? '#e0e0e0' : '#333' }
            ]}>
              Common Time
            </Text>
          </View>
          <Text style={[
            styles.feedingDetailValue,
            { color: darkMode ? '#fff' : '#333' }
          ]}>
            {mostCommon?.avg || 'N/A'}
          </Text>
        </View>
      </View>
    </View>
  );
};

// Diaper Summary Component
const DiaperMetricsSummary = ({ data, wetPerDay, bmPerDay, darkMode }) => {
  const totalChanges = data.summary?.find(s => s.key === 'total');
  const wetDiapers = data.summary?.find(s => s.key === 'wet');
  const bmDiapers = data.summary?.find(s => s.key === 'bm');

  const textPrimary = darkMode ? '#FFFFFF' : '#1A1A1A';
  const textSecondary = darkMode ? '#CCCCCC' : '#555555';
  const cardBackground = darkMode ? '#2A2A2A' : '#FFFFFF';
  const cardBorder = darkMode ? '#444444' : '#DDDDDD';

  const getHydrationStatus = (wet) => {
    const wetVal = parseFloat(wet);
    if (wetVal >= 5) return { status: 'Well Hydrated', color: '#4CAF50', icon: 'checkmark-circle' };
    if (wetVal >= 4) return { status: 'Adequate', color: '#8BC34A', icon: 'checkmark-circle-outline' };
    return { status: 'Low Hydration', color: '#F44336', icon: 'alert-circle' };
  };

  const getDigestionStatus = (bm) => {
    const bmVal = parseFloat(bm);
    if (bmVal >= 1 && bmVal <= 4) return { status: 'Normal', color: '#4CAF50' };
    if (bmVal > 4) return { status: 'Frequent', color: '#FF9800' };
    if (bmVal > 0) return { status: 'Low', color: '#FF9800' };
    return { status: 'Concern', color: '#F44336' };
  };

  const hydration = getHydrationStatus(wetDiapers?.avg || 0);
  const digestion = getDigestionStatus(bmDiapers?.avg || 0);

  return (
    <View style={styles.metricsSummaryContainer}>

      <View style={styles.diaperStatusRow}>

        <View style={[
          styles.diaperStatusCard,
          { borderLeftColor: hydration.color, backgroundColor: cardBackground, borderColor: cardBorder }
        ]}>
          <View style={styles.diaperCardHeader}>
            <Ionicons name="water" size={20} color={hydration.color} />
            <Text style={[styles.diaperCardTitle, { color: textPrimary }]}>Hydration</Text>
          </View>
          <Text style={[styles.diaperStatusBadge, { color: hydration.color }]}>
            {hydration.status}
          </Text>
          <Text style={[styles.diaperStatusValue, { color: textPrimary }]}>
            {wetPerDay || wetDiapers?.avg || 0} wet/day
          </Text>
          <Text style={[styles.diaperStatusNote, { color: textSecondary }]}>
            Target: 5-7/day
          </Text>
        </View>

        <View style={[
          styles.diaperStatusCard,
          { borderLeftColor: digestion.color, backgroundColor: cardBackground, borderColor: cardBorder }
        ]}>
          <View style={styles.diaperCardHeader}>
            <Ionicons name="medical" size={20} color={digestion.color} />
            <Text style={[styles.diaperCardTitle, { color: textPrimary }]}>Digestion</Text>
          </View>
          <Text style={[styles.diaperStatusBadge, { color: digestion.color }]}>
            {digestion.status}
          </Text>
          <Text style={[styles.diaperStatusValue, { color: textPrimary }]}>
            {bmPerDay || bmDiapers?.avg || 0} BM/day
          </Text>
          <Text style={[styles.diaperStatusNote, { color: textSecondary }]}>
            Age-dependent
          </Text>
        </View>
      </View>

      <View style={[
        styles.diaperTotalContainer,
        { backgroundColor: darkMode ? '#1A4A4A' : '#F0F7FA', borderColor: cardBorder }
      ]}>
        <Ionicons name="repeat" size={18} color="#00BCD4" />
        <View style={styles.diaperTotalInfo}>
          <Text style={[styles.diaperTotalLabel, { color: textSecondary }]}>Total Changes</Text>
          <Text style={[styles.diaperTotalValue, { color: '#00BCD4' }]}>
            {totalChanges?.avg || 0}/day
          </Text>
        </View>
      </View>

    </View>
  );
};

const GrowthMetricsSummary = ({ data, childData, darkMode, theme }) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.noDataContainer}>
        <Ionicons name="analytics-outline" size={40} color={darkMode ? '#555' : '#ccc'} />
        <Text style={[styles.noDataText, { color: theme.textSecondary }]}>
          No growth measurements recorded yet
        </Text>
      </View>
    );
  }

  const latestMeasurement = data[data.length - 1];
  const ageMonths = calculateAge(childData.birthdate);
  
  const weightPercentile = getPercentile(
    latestMeasurement.weight, 
    ageMonths, 
    childData.sex, 
    'weight', 
    childData
  );
  
  const heightPercentile = getPercentile(
    latestMeasurement.height, 
    ageMonths, 
    childData.sex, 
    'height', 
    childData
  );

  const getGrowthStatus = (percentile) => {
    if (!percentile) return { status: 'Unknown', color: '#999', icon: 'help-circle' };
    
    if (percentile.includes('< 3rd')) {
      return { status: 'Below Range', color: '#F44336', icon: 'alert-circle' };
    } else if (percentile.includes('> 97th')) {
      return { status: 'Above Range', color: '#FF9800', icon: 'alert-circle' };
    } else {
      return { status: 'Normal Range', color: '#4CAF50', icon: 'checkmark-circle' };
    }
  };

  const weightStatus = getGrowthStatus(weightPercentile);
  const heightStatus = getGrowthStatus(heightPercentile);

  return (
    <View style={styles.metricsSummaryContainer}>
      <View style={styles.diaperStatusRow}>
        {/* Weight Card */}
        <View style={[
          styles.diaperStatusCard,
          { 
            borderLeftColor: weightStatus.color,
            backgroundColor: darkMode ? '#2a2a2a' : '#fff',
            borderColor: darkMode ? '#404040' : '#e0e0e0'
          }
        ]}>
          <View style={styles.diaperCardHeader}>
            <Ionicons name="scale" size={20} color={weightStatus.color} />
            <Text style={[styles.diaperCardTitle, { color: theme.textPrimary }]}>
              Weight
            </Text>
          </View>
          <Text style={[styles.diaperStatusBadge, { color: weightStatus.color }]}>
            {weightStatus.status}
          </Text>
          <Text style={[styles.diaperStatusValue, { color: theme.textPrimary }]}>
            {latestMeasurement.weight} {latestMeasurement.weightUnit}
          </Text>
          <Text style={[styles.diaperStatusNote, { color: theme.textSecondary }]}>
            {weightPercentile || 'N/A'} percentile
          </Text>
        </View>

        {/* Height Card */}
        <View style={[
          styles.diaperStatusCard,
          { 
            borderLeftColor: heightStatus.color,
            backgroundColor: darkMode ? '#2a2a2a' : '#fff',
            borderColor: darkMode ? '#404040' : '#e0e0e0'
          }
        ]}>
          <View style={styles.diaperCardHeader}>
            <Ionicons name="resize" size={20} color={heightStatus.color} />
            <Text style={[styles.diaperCardTitle, { color: theme.textPrimary }]}>
              Height
            </Text>
          </View>
          <Text style={[styles.diaperStatusBadge, { color: heightStatus.color }]}>
            {heightStatus.status}
          </Text>
          <Text style={[styles.diaperStatusValue, { color: theme.textPrimary }]}>
            {latestMeasurement.height} {latestMeasurement.heightUnit}
          </Text>
          <Text style={[styles.diaperStatusNote, { color: theme.textSecondary }]}>
            {heightPercentile || 'N/A'} percentile
          </Text>
        </View>
      </View>

      {/* Total Measurements Info */}
      <View style={[
        styles.diaperTotalContainer,
        { 
          backgroundColor: darkMode ? '#1A4A4A' : '#F0F7FA',
          borderColor: darkMode ? '#404040' : '#e0e0e0'
        }
      ]}>
        <Ionicons name="analytics" size={18} color="#00BCD4" />
        <View style={styles.diaperTotalInfo}>
          <Text style={[styles.diaperTotalLabel, { color: theme.textSecondary }]}>
            Total Measurements
          </Text>
          <Text style={[styles.diaperTotalValue, { color: '#00BCD4' }]}>
            {data.length} recorded
          </Text>
        </View>
      </View>
    </View>
  );
};

const TimeOfDayHeatmap = ({ data, title, color, darkMode }) => {
  // data format: [{ hour: 0-23, count: number, day: string }]
  const [selectedHour, setSelectedHour] = useState(null);
  
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const maxCount = Math.max(...data.map(d => d.count), 1);
  
  const getIntensity = (count) => {
    return count / maxCount;
  };
  
  const getColor = (intensity) => {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${intensity * 0.8 + 0.2})`;
  };
  
  const formatHour = (hour) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}${ampm}`;
  };
  
  // Group by hour
  const hourCounts = hours.map(hour => {
    const count = data.filter(d => d.hour === hour).reduce((sum, d) => sum + d.count, 0);
    return { hour, count };
  });
  
  const handleBarPress = (hour, count) => {
    if (count > 0) {
      Alert.alert(
        formatHour(hour),
        `${count} occurrence${count !== 1 ? 's' : ''} during this hour`,
        [{ text: 'OK' }]
      );
    }
  };
  
  return (
    <View style={styles.heatmapContainer}>
      <Text style={[
        styles.heatmapTitle,
        { color: darkMode ? '#e0e0e0' : '#333' }
      ]}>
        {title}
      </Text>
      <View style={styles.heatmapGrid}>
        {hourCounts.map(({ hour, count }) => {
          const intensity = getIntensity(count);
          const showText = count > 0 && count.toString().length <= 2;
          
          return (
            <TouchableOpacity 
              key={hour} 
              style={styles.heatmapCell}
              onPress={() => handleBarPress(hour, count)}
              activeOpacity={0.7}
              disabled={count === 0}
            >
              <View 
                style={[
                  styles.heatmapBar, 
                  { 
                    backgroundColor: getColor(intensity),
                    height: count > 0 ? `${Math.max(intensity * 100, 10)}%` : '5%'
                  }
                ]}
              >
                {showText && (
                  <Text style={styles.heatmapBarText}>{count}</Text>
                )}
                {count > 0 && !showText && (
                  <View style={styles.heatmapBarDot} />
                )}
              </View>
              <Text style={[
                styles.heatmapLabel,
                { color: darkMode ? '#bbb' : '#666' }
              ]}>
                {hour % 4 === 0 ? formatHour(hour) : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.heatmapLegend}>
        <Text style={[
          styles.heatmapLegendText,
          { color: darkMode ? '#bbb' : '#666' }
        ]}>
          Less frequent
        </Text>
        <View style={styles.heatmapLegendGradient}>
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((intensity, i) => (
            <View 
              key={i}
              style={[
                styles.heatmapLegendBox,
                { backgroundColor: getColor(intensity) }
              ]}
            />
          ))}
        </View>
        <Text style={[
          styles.heatmapLegendText,
          { color: darkMode ? '#bbb' : '#666' }
        ]}>
          More frequent
        </Text>
      </View>
    </View>
  );
};

const WeaningProgressCard = ({ feedingData, darkMode, theme }) => {
  // Filter for weaning logs
  const weaningLogs = feedingData.filter(log => log.weaningMode);
  
  if (weaningLogs.length === 0) return null;
  
  // Analyze progression
  const progression = weaningLogs.map(log => ({
    date: log.timestamp?.toDate(),
    ratio: log.weaningRatio,
    type: log.weaningType
  })).sort((a, b) => a.date - b.date);
  
  const latestLog = progression[progression.length - 1];
  const startDate = progression[0]?.date;
  const daysInTransition = startDate ? Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24)) : 0;
  
  // Calculate progress percentage (rough estimate)
  const getProgressPercentage = (ratio) => {
    if (!ratio) return 0;
    if (ratio.includes('100%')) return 100;
    const match = ratio.match(/(\d+)\/(\d+)/);
    if (match) {
      const [, old, newMilk] = match;
      return Math.round((parseInt(newMilk) / (parseInt(old) + parseInt(newMilk))) * 100);
    }
    return 0;
  };
  
  const currentProgress = getProgressPercentage(latestLog?.ratio);
  
  return (
    <View style={[
      styles.chartContainer,
      { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }
    ]}>
      <View style={styles.weaningHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Milk Weaning Progress
          </Text>
          <Text style={[styles.weaningSubtitle, { color: theme.textSecondary }]}>
            Transitioning {latestLog?.type === 'to-dairy' ? 'to dairy milk' : 'to formula'}
          </Text>
        </View>
      </View>
      
      {/* Progress Bar */}
      <View style={[styles.progressBarContainer, { backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5' }]}>
        <View style={[styles.progressBarFill, { width: `${currentProgress}%`, backgroundColor: '#4CAF50' }]} />
        <Text style={[styles.progressBarText, { color: theme.textPrimary }]}>
          {currentProgress}% Complete
        </Text>
      </View>
      
      {/* Stats Grid */}
      <View style={styles.weaningStatsGrid}>
        <View style={[styles.weaningStat, { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }]}>
          <Text style={[styles.weaningStatLabel, { color: theme.textSecondary }]}>Days in Transition</Text>
          <Text style={[styles.weaningStatValue, { color: theme.textPrimary }]}>{daysInTransition}</Text>
        </View>
        
        <View style={[styles.weaningStat, { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }]}>
          <Text style={[styles.weaningStatLabel, { color: theme.textSecondary }]}>Current Ratio</Text>
          <Text style={[styles.weaningStatValue, { color: theme.textPrimary }]}>{latestLog?.ratio || 'N/A'}</Text>
        </View>
        
        <View style={[styles.weaningStat, { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }]}>
          <Text style={[styles.weaningStatLabel, { color: theme.textSecondary }]}>Total Logs</Text>
          <Text style={[styles.weaningStatValue, { color: theme.textPrimary }]}>{weaningLogs.length}</Text>
        </View>
      </View>
      
      {/* Timeline */}
      <View style={styles.weaningTimeline}>
        <Text style={[styles.timelineTitle, { color: theme.textPrimary }]}>Progression</Text>
        {progression.slice(-5).reverse().map((entry, index) => (
          <View key={index} style={styles.timelineEntry}>
            <View style={[styles.timelineDot, { backgroundColor: '#4CAF50' }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.timelineDate, { color: theme.textSecondary }]}>
                {entry.date.toLocaleDateString()}
              </Text>
              <Text style={[styles.timelineRatio, { color: theme.textPrimary }]}>
                {entry.ratio}
              </Text>
            </View>
          </View>
        ))}
      </View>
      
      {/* Guidance
      <View style={[styles.weaningGuidanceBox, { backgroundColor: darkMode ? '#1a3a2a' : '#E8F5E9' }]}>
        <Text style={[styles.guidanceText, { color: darkMode ? '#A5D6A7' : '#2E7D32' }]}>
          {currentProgress < 25 ? '🌱 Great start! Continue with this ratio for 3-5 days before advancing.' :
           currentProgress < 50 ? '📈 Halfway there! Watch for any digestive changes as you progress.' :
           currentProgress < 75 ? '🎯 Almost done! Your baby is adjusting well to the new milk.' :
           currentProgress < 100 ? '🏁 Final stretch! You can complete the transition in the next few days.' :
           '✅ Transition complete! Great job on a gradual, healthy weaning process!'}
        </Text>
      </View> */}
    </View>
  );
};

const calculateAge = (birthdate) => {
  const birth = new Date(birthdate);
  const today = new Date();
  const diffMonths = (today.getFullYear() - birth.getFullYear()) * 12 + 
                     (today.getMonth() - birth.getMonth());
  return diffMonths;
};

const getClosestAgeData = (ageMonths, genderData) => {
  const ages = Object.keys(genderData).map(Number).sort((a, b) => a - b);
  
  let lowerAge = ages[0];
  let upperAge = ages[ages.length - 1];
  
  for (let i = 0; i < ages.length - 1; i++) {
    if (ageMonths >= ages[i] && ageMonths <= ages[i + 1]) {
      lowerAge = ages[i];
      upperAge = ages[i + 1];
      break;
    }
  }
  
  if (genderData[ageMonths]) {
    return genderData[ageMonths];
  }
  
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

const getPercentile = (value, ageMonths, sex, type, childData) => {
  const data = type === 'weight' ? CDC_WEIGHT_PERCENTILES : CDC_HEIGHT_PERCENTILES;
  const genderData = data[sex === 'Male' ? 'male' : 'female'];
  
  const percentiles = getClosestAgeData(ageMonths, genderData);
  if (!percentiles) return null;
  
  let metricValue = value;
  if (type === 'weight' && childData?.weightUnit === 'lbs') {
    metricValue = value * 0.453592;
  } else if (type === 'height' && childData?.heightUnit === 'in') {
    metricValue = value * 2.54;
  }
  
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

const ReportPage = () => {
  const [hasAIConsent, setHasAIConsent] = useState(false);
  useEffect(() => {
    const loadAIConsent = async () => {
      try {
        const consent = await AsyncStorage.getItem(`ai_consent_${childId}`);
        setHasAIConsent(consent === 'true');
      } catch (error) {
        console.error('Error loading AI consent:', error);
      }
    };
  
  if (childId) {
    loadAIConsent();
  }
}, [childId]);
  const route = useRoute();
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();
  const theme = darkMode ? appTheme.dark : appTheme.light;
  const [aiRefreshKey, setAiRefreshKey] = useState(0);
  const [forceAIRefresh, setForceAIRefresh] = useState(false);
  const getContainerStyle = (baseStyle) => {
    return [
      baseStyle,
      {
        backgroundColor: darkMode ? '#1f1f1f' : '#fff',
        borderColor: darkMode ? '#333' : '#e0e0e0'
      }
    ];
  };
  const [showExportModal, setShowExportModal] = useState(false);
  const [currentAISummaries, setCurrentAISummaries] = useState({});
  // Memoize processed data to avoid recalculating on every render
const processedChartData = useMemo(() => {
  if (isLoading) return null;
  
  try {
    switch (activeTab) {
      case 'Sleep':
        return processSleepData();
      case 'Diaper':
        return processDiaperData();
      case 'Feeding':
        return processFeedingData();
      default:
        return null;
    }
  } catch (error) {
    console.error('Error processing chart data:', error);
    return null;
  }
}, [activeTab, sleepData, diaperData, feedingData, reportRange, childData, isLoading]);
  const getTextStyle = (baseStyle, colorOverride) => {
    return [
      baseStyle,
      {
        color: colorOverride || theme.textPrimary
      }
    ];
  };
  const { childId, name } = route.params || {};

  // State variables - ALL hooks must come before any conditional returns
  const [reportRange, setReportRange] = useState('Weekly');
  const [activeTab, setActiveTab] = useState('Sleep');
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [measurementsData, setMeasurementsData] = useState([]);
  const [growthPercentiles, setGrowthPercentiles] = useState({
    weight: null,
    height: null
  });
  // Data states
  const [sleepData, setSleepData] = useState([]);
  const [diaperData, setDiaperData] = useState([]);
  const [feedingData, setFeedingData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDataPoint, setSelectedDataPoint] = useState(null);
  const [childData, setChildData] = useState(null);

  const [dataCache, setDataCache] = useState({
    annual: { sleep: [], feeding: [], diaper: [], timestamp: null },
    overview: { sleep: [], feeding: [], diaper: [], timestamp: null }
  });
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
  if (childId && !isLoading && childData) {
    const updateAISummaries = async () => {
      const summaries = {};
      
      // Get cached summaries from the AI component
      const overallKey = `${reportRange}_Overall`;
      const sleepKey = `${reportRange}_Sleep`;
      const feedingKey = `${reportRange}_Feeding`;
      const diaperKey = `${reportRange}_Diaper`;
      
      try {
        const cached = await AsyncStorage.getItem(`ai_summary_cache_${childId}`);
        if (cached) {
          const parsedCache = JSON.parse(cached);
          summaries.overall = parsedCache[overallKey];
          summaries.sleep = parsedCache[sleepKey];
          summaries.feeding = parsedCache[feedingKey];
          summaries.diaper = parsedCache[diaperKey];
        }
      } catch (error) {
        console.error('Error loading AI summaries for export:', error);
      }
      
      setCurrentAISummaries(summaries);
    };
    
    updateAISummaries();
  }
}, [reportRange, childId, childData, isLoading]);

  // First useEffect - Check ownership
  useEffect(() => {
    const checkOwnership = async () => {
      try {
        const currentUser = getAuth().currentUser;
        if (!currentUser || !childId) {
          setIsOwner(false);
          setCheckingPermissions(false);
          Alert.alert('Access Denied', 'You do not have permission to view reports for this child.');
          navigation.goBack();
          return;
        }

        const childDoc = await getDocs(
          query(collection(db, 'children'), where('__name__', '==', childId))
        );
        
        if (!childDoc.empty) {
          const childData = childDoc.docs[0].data();
          const isChildOwner = childData.userId === currentUser.uid;
          
          setIsOwner(isChildOwner);
          setCheckingPermissions(false);
          
          if (!isChildOwner) {
            Alert.alert(
              'Access Denied', 
              'Only the parent can view reports. You have caregiver access for this child.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        } else {
          Alert.alert('Error', 'Child not found.');
          navigation.goBack();
        }
      } catch (error) {
        console.error('Error checking ownership:', error);
        Alert.alert('Error', 'Failed to verify permissions.');
        navigation.goBack();
      }
    };

    checkOwnership();
  }, [childId, navigation]);

useEffect(() => {
  if (!childId || !isOwner || checkingPermissions) {
    return;
  }
  
  // Clear cache if switching between different time ranges
  const fetchAllData = async () => {
    setIsLoading(true);
    
    try {
      const { start, end } = getTimeRange();
      
      const startTimestamp = Timestamp.fromDate(new Date(start.setHours(0, 0, 0, 0)));
      const endTimestamp = Timestamp.fromDate(new Date(end.setHours(23, 59, 59, 999)));
      
      // Check if we're on Annual or Overview and have cached data
      const cacheType = reportRange === 'Annual' ? 'annual' : reportRange === 'Overview' ? 'overview' : null;
      
      if (cacheType) {
        const cached = getCachedData(cacheType);
        if (cached) {
          console.log(`Loading from cache for ${reportRange}`);
          setSleepData(cached.sleep);
          setFeedingData(cached.feeding);
          setDiaperData(cached.diaper);
          await fetchChildData();
          setIsLoading(false);
          return;
        }
      }
      
      console.log(`Fetching fresh data for ${reportRange}`);
      const [childResult, sleepResult, diaperResult, feedingResult] = await Promise.all([
        fetchChildData(),
        fetchSleepData(startTimestamp, endTimestamp),
        fetchDiaperData(startTimestamp, endTimestamp),
        fetchFeedingData(startTimestamp, endTimestamp)
      ]);
      
      // Cache the data if it's Annual or Overview
      if (cacheType) {
        console.log(`Caching data for ${reportRange}`);
        // Use the data from state after it's been set
        setTimeout(() => {
          updateCache(cacheType, sleepData, feedingData, diaperData);
        }, 100);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to fetch report data.');
    } finally {
      setIsLoading(false);
    }
  };
  
  fetchAllData();
}, [childId, reportRange, isOwner, checkingPermissions]);
  if (checkingPermissions) {
    return (
      <LinearGradient 
        colors={theme.backgroundGradient} 
        start={{ x: 0, x: 0.5 }} 
        end={{ y: 1, y: 0.5 }}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.container}>
          {/* Rest of your JSX... */}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!isOwner) {
    return (
      <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <View style={[styles.loadingContainer, { justifyContent: 'center' }]}>
            <Ionicons name="lock-closed" size={60} color="#999" />
            <Text style={[styles.loadingText, { marginTop: 20 }]}>
              Access restricted to parents only
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const getTimeRange = () => {
    const now = new Date();
    const endDate = new Date(now); // Current date/time
    endDate.setHours(23, 59, 59, 999); // End of today
    
    const startDate = new Date(now);
    
    switch (reportRange) {
      case 'Weekly':
        startDate.setDate(now.getDate() - 6); // Last 7 days including today
        startDate.setHours(0, 0, 0, 0);
        return { start: startDate, end: endDate, periodLabels: getLast7DaysRolling() };
      case 'Monthly':
        startDate.setDate(now.getDate() - 29); // Last 30 days including today
        startDate.setHours(0, 0, 0, 0);
        return { start: startDate, end: endDate, periodLabels: getLast4WeeksRolling() };
      case 'Annual':
        startDate.setMonth(now.getMonth() - 11); // Last 12 months including current
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        return { start: startDate, end: endDate, periodLabels: getLast12MonthsRolling() };
      default:
        startDate.setDate(now.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        return { start: startDate, end: endDate, periodLabels: getLast7DaysRolling() };
    }
  };

const fetchChildData = async () => {
  try {
    const childDoc = await getDocs(
      query(collection(db, 'children'), where('__name__', '==', childId))
    );
    
    if (!childDoc.empty) {
      const data = childDoc.docs[0].data();
      
      // Calculate age from birthdate
      let ageInMonths = null;
      let ageDisplay = null; // Human-readable age for AI
      
      if (data.birthdate || data.birthDate) {
        const birthDateData = data.birthdate || data.birthDate;
        let birthDate;
        
        // Handle map format { day, month, year }
        if (birthDateData.day && birthDateData.month && birthDateData.year) {
          const year = parseInt(birthDateData.year);
          const month = parseInt(birthDateData.month) - 1; // JS months are 0-indexed
          const day = parseInt(birthDateData.day);
          birthDate = new Date(year, month, day);
        }
        // Handle Firestore Timestamp
        else if (typeof birthDateData.toDate === 'function') {
          birthDate = birthDateData.toDate();
        } 
        // Handle seconds format
        else if (birthDateData.seconds) {
          birthDate = new Date(birthDateData.seconds * 1000);
        } 
        // Handle Date object
        else if (birthDateData instanceof Date) {
          birthDate = birthDateData;
        } 
        // Handle string format
        else if (typeof birthDateData === 'string') {
          birthDate = new Date(birthDateData);
        }
        
        if (birthDate && !isNaN(birthDate.getTime())) {
          const today = new Date();
          
          // Calculate precise age
          let years = today.getFullYear() - birthDate.getFullYear();
          let months = today.getMonth() - birthDate.getMonth();
          let days = today.getDate() - birthDate.getDate();
          
          // Adjust for negative days
          if (days < 0) {
            months--;
            const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            days += lastMonth.getDate();
          }
          
          // Adjust for negative months
          if (months < 0) {
            years--;
            months += 12;
          }
          
          // Total months for calculations
          const totalMonths = (years * 12) + months;
          ageInMonths = totalMonths;
          
          // Create human-readable age display
          if (totalMonths < 1) {
            // Less than 1 month - use days
            const diffTime = today - birthDate;
            const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            ageDisplay = `${totalDays} day${totalDays !== 1 ? 's' : ''}`;
          } else if (totalMonths < 36) {
            // 1-35 months - use months
            ageDisplay = `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`;
          } else {
            // 36+ months (3+ years) - use years
            const ageYears = Math.floor(totalMonths / 12);
            const remainingMonths = totalMonths % 12;
            if (remainingMonths === 0) {
              ageDisplay = `${ageYears} year${ageYears !== 1 ? 's' : ''}`;
            } else {
              ageDisplay = `${ageYears} year${ageYears !== 1 ? 's' : ''} ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
            }
          }
          
          console.log('Child age calculation:', {
            birthDate: birthDate.toISOString(),
            today: today.toISOString(),
            years,
            months,
            days,
            totalMonths,
            ageInMonths,
            ageDisplay
          });
        } else {
          console.warn('Invalid birthdate format:', birthDateData);
        }
      }
      
      setChildData({
        age: ageInMonths,
        ageDisplay: ageDisplay,
        weight: data.weight,
        weightUnit: data.weightUnit || 'lbs',
        height: data.height,
        heightUnit: data.heightUnit || 'in',
      });
    }
  } catch (error) {
    console.error('Error fetching child data:', error);
  }
};

  const getChartType = (tabName) => {
    switch (tabName) {
      case 'Sleep':
        return 'line';
      case 'Feeding':
        return 'line';
      case 'Diaper':
        return 'bar';
      default:
        return 'line';
    }
  };

const chartConfig = {
  backgroundGradientFrom: darkMode ? "#2a2a2a" : "#ffffff",
  backgroundGradientTo: darkMode ? "#1f1f1f" : "#f8f9fa",
  decimalPlaces: 1,
  color: (opacity = 1) => darkMode ? `rgba(100, 181, 246, ${opacity})` : `rgba(25, 118, 210, ${opacity})`,
  labelColor: () => darkMode ? '#e0e0e0' : '#555',
  propsForLabels: {
    fontSize: 11,
    fontWeight: '600',
    fill: darkMode ? '#e0e0e0' : '#555',
  },
  propsForDots: {
    r: "5",
    strokeWidth: "2",
    stroke: darkMode ? "#64b5f6" : "#1976d2"
  },
  strokeWidth: 3,
  propsForVerticalLabels: {
    fontSize: 11,
    rotation: 0,
    fill: darkMode ? '#e0e0e0' : '#555',
  },
  propsForHorizontalLabels: {
    fontSize: 11,
    fill: darkMode ? '#e0e0e0' : '#555',
  },
  paddingRight: 40,
  paddingLeft: 10,
  paddingTop: 20,
  formatYLabel: (value) => String(Math.round(value)),
  useShadowColorFromDataset: false,
  fillShadowGradient: darkMode ? '#64b5f6' : '#1976d2',
  fillShadowGradientOpacity: 0.1,
};

  const getLast7DaysRolling = () => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      // Show day name and date for clarity
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = date.getDate();
      days.push(`${dayName} ${dayNum}`);
    }
    return days;
  };

  const getLast4WeeksRolling = () => {
    const weeks = [];
    const today = new Date();
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7) - 6);
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - (i * 7));
      weeks.push(`${weekStart.getMonth() + 1}/${weekStart.getDate()}-${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`);
    }
    return weeks;
  };

  const getLast12MonthsRolling = () => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(date.toLocaleDateString('en-US', { month: 'short' })); // Only month
    }
    return months;
  };
  
  const generatePDF = async () => {
    try {
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { text-align: center; color: #333; }
              .chart-container { text-align: center; margin: 20px 0; }
            </style>
          </head>
          <body>
            <h1>Report</h1>
            <div class="chart-container">
              <img src="data:image/png;base64,${await captureChartAsBase64()}" />
            </div>
          </body>
        </html>
      `;

      const pdf = await RNHTMLtoPDF.convert({
        html: htmlContent,
        fileName: 'report',
        base64: true,
      });

      if (pdf.filePath) {
        Alert.alert('Success', 'PDF generated successfully!');
        await Sharing.shareAsync(pdf.filePath);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    }
  };

const generateCategorizedAISummary = async (childId, childAge, childWeight, childHeight, sleepData, feedingData, diaperData, category, timeRange) => {
  try {
    const safeSleepData = Array.isArray(sleepData) ? sleepData : [];
    const safeFeedingData = Array.isArray(feedingData) ? feedingData : [];
    const safeDiaperData = Array.isArray(diaperData) ? diaperData : [];

    // Check data sufficiency based on category
    let relevantDataCount = 0;
    let categoryName = '';
    
    if (category === 'Sleep') {
      relevantDataCount = safeSleepData.length;
      categoryName = 'sleep sessions';
    } else if (category === 'Feeding') {
      relevantDataCount = safeFeedingData.length;
      categoryName = 'feeding logs';
    } else if (category === 'Diaper') {
      relevantDataCount = safeDiaperData.length;
      categoryName = 'diaper changes';
    } else if (category === 'Overall') {
      // For overall, check total across all categories
      relevantDataCount = safeSleepData.length + safeFeedingData.length + safeDiaperData.length;
      categoryName = 'total entries';
    }

    // Return insufficient data message if less than 5 entries
    if (relevantDataCount < 5) {
      return `**Insufficient Data for ${category} Analysis**

You currently have ${relevantDataCount} ${categoryName} logged. We need at least 5 entries to provide accurate AI insights and pattern recognition.

**Why more data helps:**
• Better pattern detection
• More accurate recommendations
• Personalized to your baby's unique rhythms

**Next steps:** Keep logging your baby's ${category.toLowerCase()} activities! Once you have 5+ entries, refresh to get detailed AI analysis.`;
    }

    let prompt = '';
    
    if (category === 'Sleep') {
      const totalSessions = safeSleepData.length;
      const avgDuration = totalSessions > 0 
        ? (safeSleepData.reduce((sum, s) => sum + (s.duration || 0), 0) / totalSessions / 60).toFixed(1)
        : 0;
      
      // Calculate night vs day sleep
      const nightSleeps = safeSleepData.filter(s => {
        const hour = s.timestamp?.toDate().getHours();
        const duration = (s.duration || 0) / 60;
        return (hour >= 19 || hour <= 6) && duration >= 4;
      });
      
      const daySleeps = safeSleepData.filter(s => {
        const hour = s.timestamp?.toDate().getHours();
        const duration = (s.duration || 0) / 60;
        return hour > 6 && hour < 19 && duration < 4;
      });
      
      const totalNightHours = nightSleeps.reduce((sum, s) => sum + (s.duration || 0), 0) / 60;
      const totalNapHours = daySleeps.reduce((sum, s) => sum + (s.duration || 0), 0) / 60;
      const totalDailySleep = (totalNightHours + totalNapHours) / (timeRange === 'Weekly' ? 7 : timeRange === 'Monthly' ? 30 : 365);
      
      // Calculate longest stretch
      const sortedSleeps = [...safeSleepData].sort((a, b) => (b.duration || 0) - (a.duration || 0));
      const longestStretch = sortedSleeps[0] ? (sortedSleeps[0].duration / 60).toFixed(1) : 0;
      
      // Detect patterns
      const mostCommonBedtime = findMostCommonHour(nightSleeps.map(s => s.timestamp?.toDate()));
      
      // Use the display age if available, otherwise fall back to months
      const ageDisplay = childData?.ageDisplay || `${childAge || 6} months`;
      
      prompt = `As a pediatric sleep consultant, analyze this ${ageDisplay} old baby's sleep over the past ${timeRange.toLowerCase()}.

**Data:**
- Total daily sleep: ${totalDailySleep.toFixed(1)} hours
- Night sleep: ${totalNightHours.toFixed(1)} hours (${nightSleeps.length} sessions)
- Daytime naps: ${totalNapHours.toFixed(1)} hours (${daySleeps.length} naps)
- Longest stretch: ${longestStretch} hours
- Most common bedtime: ${mostCommonBedtime}

**Expected for age ${ageDisplay} months:** ${getExpectedSleep(ageDisplay)}

Provide:
1. **Pattern Assessment** (2 sentences): Is sleep age-appropriate? Any concerning patterns?
2. **Key Insight** (1-2 sentences): Most important observation from the data
3. **Actionable Tip** (1-2 sentences): One specific, practical recommendation

Be supportive but honest. If sleep is insufficient or concerning, say so tactfully. Keep response under 120 words.`;

    } else if (category === 'Feeding') {
      const totalFeedings = safeFeedingData.length;
      const feedingsPerDay = totalFeedings / (timeRange === 'Weekly' ? 7 : timeRange === 'Monthly' ? 30 : 365);
      
      const feedingTypes = {};
      const feedingAmounts = [];
      safeFeedingData.forEach(f => {
        const type = f.feedType || 'unknown';
        feedingTypes[type] = (feedingTypes[type] || 0) + 1;
        if (f.amount) feedingAmounts.push(f.amount);
      });
      
      const avgAmount = feedingAmounts.length > 0 
        ? (feedingAmounts.reduce((a, b) => a + b, 0) / feedingAmounts.length).toFixed(1)
        : 'N/A';
      
      const avgGapHours = calculateFeedingGap(safeFeedingData);
      const mostCommonFeedTime = findMostCommonHour(safeFeedingData.map(f => f.timestamp?.toDate()));
      
      // Check for concerning gaps
      const timestamps = safeFeedingData
        .map(f => f.timestamp?.toDate())
        .filter(t => t)
        .sort((a, b) => a - b);
      
      let longestGap = 0;
      for (let i = 1; i < timestamps.length; i++) {
        const gap = (timestamps[i] - timestamps[i-1]) / (1000 * 60 * 60);
        if (gap > longestGap) longestGap = gap;
      }
      
      const ageDisplay = childData?.ageDisplay || `${childAge || 6} months`;
      
      prompt = `As a pediatric nutritionist, analyze this ${ageDisplay} old baby's feeding over the past ${timeRange.toLowerCase()}.

**Data:**
- Feedings per day: ${feedingsPerDay.toFixed(1)}
- Average gap: ${avgGapHours} hours
- Longest gap: ${longestGap.toFixed(1)} hours
- Average amount: ${avgAmount}${safeFeedingData[0]?.unit || 'ml'}
- Types: ${Object.entries(feedingTypes).map(([k, v]) => `${k} (${v})`).join(', ')}
- Most common time: ${mostCommonFeedTime}

**Expected for age ${ageDisplay} :** ${getExpectedFeeding(ageDisplay)}

Provide:
1. **Frequency Assessment** (2 sentences): Is feeding schedule appropriate? Any red flags?
2. **Key Observation** (1-2 sentences): Notable pattern or concern
3. **Practical Advice** (1-2 sentences): Specific actionable guidance

Be encouraging but factual. If gaps are too long or frequency concerning, mention it. Keep under 120 words.`;

    } else if (category === 'Diaper') {
      const totalChanges = safeDiaperData.length;
      const changesPerDay = totalChanges / (timeRange === 'Weekly' ? 7 : timeRange === 'Monthly' ? 30 : 365);
      
      const wetCount = safeDiaperData.filter(d => 
        d.stoolType?.toLowerCase().includes('wet') && !d.stoolType?.toLowerCase().includes('bm')
      ).length;
      
      const bmCount = safeDiaperData.filter(d => 
        d.stoolType?.toLowerCase().includes('bm')
      ).length;
      
      const wetPerDay = wetCount / (timeRange === 'Weekly' ? 7 : timeRange === 'Monthly' ? 30 : 365);
      const bmPerDay = bmCount / (timeRange === 'Weekly' ? 7 : timeRange === 'Monthly' ? 30 : 365);
      
      // Check for concerning patterns
      const recentDays = safeDiaperData.slice(-Math.min(3, safeDiaperData.length));
      const recentBMs = recentDays.filter(d => d.stoolType?.toLowerCase().includes('bm')).length;
      
      const ageDisplay = childData?.ageDisplay || `${childAge || 6} months`;
      
      prompt = `As a pediatric nurse, assess this ${ageDisplay} old baby's diaper patterns over the past ${timeRange.toLowerCase()}.

**Data:**
- Total changes: ${totalChanges} (${changesPerDay.toFixed(1)}/day)
- Wet diapers: ${wetCount} (${wetPerDay.toFixed(1)}/day)
- BM diapers: ${bmCount} (${bmPerDay.toFixed(1)}/day)
- Recent 3 days BMs: ${recentBMs}

**Expected for age ${ageDisplay} :** 
- Wet: 5-7/day (indicates hydration)
- BM: ${getExpectedBM(ageDisplay)}

Provide:
1. **Hydration Status** (1-2 sentences): Are wet diapers indicating good hydration?
2. **Digestive Health** (1-2 sentences): Is BM frequency normal? Any concerns?
3. **Action Item** (1 sentence): What to monitor or when to consult pediatrician

Be clinical but reassuring. Flag if wet diapers < 5/day. Keep under 110 words.`;

    } else {
      // Overall summary with integrated insights
      const sleepHours = safeSleepData.length > 0 
        ? (safeSleepData.reduce((sum, s) => sum + (s.duration || 0), 0) / safeSleepData.length / 60).toFixed(1)
        : 0;
      
      const feedingsPerDay = safeFeedingData.length / (timeRange === 'Weekly' ? 7 : timeRange === 'Monthly' ? 30 : 365);
      const diaperPerDay = safeDiaperData.length / (timeRange === 'Weekly' ? 7 : timeRange === 'Monthly' ? 30 : 365);
      
      const ageDisplay = childData?.ageDisplay || `${childAge || 6} months`;
      
      prompt = `As a pediatric care expert, provide a holistic ${timeRange.toLowerCase()} summary for a ${ageDisplay} old baby.

**Quick Stats:**
- Sleep: ${sleepHours}hrs avg, ${safeSleepData.length} sessions
- Feeding: ${feedingsPerDay.toFixed(1)}/day, ${safeFeedingData.length} total
- Diapers: ${diaperPerDay.toFixed(1)}/day, ${safeDiaperData.length} total

Provide:
1. **Overall Wellbeing** (2-3 sentences): How is baby doing across all areas?
2. **Strongest Area** (1 sentence): What's going well?
3. **Growth Opportunity** (1-2 sentences): What needs attention and why?
4. **This Week's Focus** (1 sentence): One clear action for parents

Be warm and encouraging while being useful. Keep under 130 words.`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an experienced pediatric consultant providing evidence-based insights to parents. Be specific, actionable, and supportive. Use bullet points with bold headers. Flag concerns tactfully but clearly. Never use phrases like "great job" - be factual and helpful instead.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Unable to generate summary at this time.';
  } catch (error) {
    console.error('Error generating AI summary:', error);
    throw error;
  }
};

const findMostCommonHour = (dates) => {
  if (!dates || dates.length === 0) return 'N/A';
  
  const hourCounts = {};
  dates.forEach(date => {
    if (date) {
      const hour = date.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  });
  
  let maxHour = 0;
  let maxCount = 0;
  for (const [hour, count] of Object.entries(hourCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxHour = parseInt(hour);
    }
  }
  
  const ampm = maxHour >= 12 ? 'PM' : 'AM';
  const hour12 = maxHour % 12 || 12;
  return `${hour12}:00 ${ampm}`;
};

// Helper for feeding gap calculation
const calculateFeedingGap = (feedingData) => {
  if (feedingData.length < 2) return 0;
  const timestamps = feedingData
    .map(f => f.timestamp?.toDate())
    .filter(t => t)
    .sort((a, b) => a - b);
  
  let totalGap = 0;
  for (let i = 1; i < timestamps.length; i++) {
    totalGap += (timestamps[i] - timestamps[i-1]) / (1000 * 60 * 60); // hours
  }
  return (totalGap / (timestamps.length - 1)).toFixed(1);
};

// Helper functions for age-appropriate expectations
const getExpectedSleep = (ageInMonths) => {
  if (!ageInMonths) return '12-16 hours total';
  if (ageInMonths < 3) return '14-17 hours total (multiple short naps)';
  if (ageInMonths < 6) return '12-16 hours total (3-4 naps)';
  if (ageInMonths < 9) return '12-15 hours total (2-3 naps)';
  if (ageInMonths < 12) return '11-14 hours total (2 naps)';
  if (ageInMonths < 18) return '11-14 hours total (1-2 naps)';
  if (ageInMonths < 36) return '11-14 hours total (1 nap)';
  return '10-13 hours total (1 nap or none)';
};

const getExpectedFeeding = (ageInMonths) => {
  if (!ageInMonths) return '6-8 feedings/day';
  if (ageInMonths < 3) return '8-12 feedings/day, 2-3oz per feeding';
  if (ageInMonths < 6) return '6-8 feedings/day, 4-6oz per feeding';
  if (ageInMonths < 9) return '4-6 feedings/day, 6-8oz per feeding, starting solids';
  if (ageInMonths < 12) return '3-5 feedings/day, 7-8oz per feeding, 2-3 solid meals';
  if (ageInMonths < 36) return '3-4 feedings/day, varied amounts, 3 solid meals';
  return '3 meals + 2 snacks, varied amounts';
};

const getExpectedBM = (ageInMonths) => {
  if (!ageInMonths) return '1-4/day';
  if (ageInMonths < 3) return '3-8/day (breastfed) or 1-4/day (formula)';
  if (ageInMonths < 6) return '1-4/day (varies by diet)';
  if (ageInMonths < 36) return '1-3/day (varies with solid foods)';
  return '1-2/day (varies with diet)';
};

const getAgeBasedRecommendation = (metric, value, ageInMonths) => {
  if (!ageInMonths) return null;
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return null;
  
  switch(metric) {
    case 'total': // Total sleep
      const expectedSleep = ageInMonths < 3 ? 15.5 : 
                           ageInMonths < 6 ? 14 :
                           ageInMonths < 9 ? 13.5 :
                           ageInMonths < 12 ? 12.5 :
                           ageInMonths < 18 ? 12.5 : 12;
      
      if (numValue < expectedSleep - 2) {
        return {
          message: `Below recommended for ${ageInMonths}mo`,
          color: '#F44336',
          icon: 'alert-circle',
          advice: 'Consider earlier bedtime'
        };
      } else if (numValue > expectedSleep + 1) {
        return {
          message: `Above average for ${ageInMonths}mo`,
          color: '#4CAF50',
          icon: 'checkmark-circle',
          advice: 'Great sleep pattern!'
        };
      }
      return {
        message: `Appropriate for ${ageInMonths}mo`,
        color: '#4CAF50',
        icon: 'checkmark-circle'
      };
      
    case 'night': // Night sleep
      const expectedNight = ageInMonths < 3 ? 8 :
                           ageInMonths < 6 ? 10 :
                           ageInMonths < 12 ? 11 :
                           ageInMonths < 18 ? 11 : 10.5;
      
      if (numValue < expectedNight - 2) {
        return {
          message: 'Short night sleep',
          color: '#FF9800',
          icon: 'alert-circle',
          advice: 'Optimize bedtime routine'
        };
      }
      return {
        message: 'Good night sleep',
        color: '#4CAF50',
        icon: 'checkmark-circle'
      };
      
    case 'naps': // Daytime naps
      const expectedNaps = ageInMonths < 3 ? 7 :
                          ageInMonths < 6 ? 4 :
                          ageInMonths < 9 ? 3 :
                          ageInMonths < 12 ? 2.5 :
                          ageInMonths < 18 ? 2 : 1.5;
      
      if (numValue < expectedNaps - 1.5 && ageInMonths < 18) {
        return {
          message: 'Could use more naps',
          color: '#FF9800',
          icon: 'alert-circle',
          advice: 'Schedule regular nap times'
        };
      } else if (numValue > expectedNaps + 2 && ageInMonths > 12) {
        return {
          message: 'Many naps for age',
          color: '#2196F3',
          icon: 'information-circle',
          advice: 'May affect night sleep'
        };
      }
      return null;
      
    case 'perDay': // Feedings per day
      const expectedFeedings = ageInMonths < 3 ? 10 :
                              ageInMonths < 6 ? 7 :
                              ageInMonths < 12 ? 5 : 4;
      
      if (numValue < expectedFeedings - 2) {
        return {
          message: 'Fewer feedings than typical',
          color: '#FF9800',
          icon: 'alert-circle',
          advice: 'Monitor weight gain'
        };
      } else if (numValue > expectedFeedings + 3) {
        return {
          message: 'More frequent than typical',
          color: '#2196F3',
          icon: 'information-circle',
          advice: 'Cluster feeding is normal'
        };
      }
      return {
        message: 'Normal frequency',
        color: '#4CAF50',
        icon: 'checkmark-circle'
      };
      
    case 'avgGap': // Feeding gap
      const expectedGap = ageInMonths < 3 ? 2.5 :
                         ageInMonths < 6 ? 3 :
                         ageInMonths < 12 ? 3.5 : 4;
      
      if (numValue > expectedGap + 2) {
        return {
          message: 'Long gaps between feeds',
          color: '#FF9800',
          icon: 'alert-circle',
          advice: 'Ensure adequate intake'
        };
      } else if (numValue < expectedGap - 1 && ageInMonths > 6) {
        return {
          message: 'Frequent feeding',
          color: '#2196F3',
          icon: 'information-circle',
          advice: 'Growth spurt possible'
        };
      }
      return null;
      
    case 'wet': // Wet diapers
      if (numValue < 5) {
        return {
          message: 'May need more fluids',
          color: '#F44336',
          icon: 'alert-circle',
          advice: 'Increase feeding frequency'
        };
      } else if (numValue >= 6) {
        return {
          message: 'Well hydrated',
          color: '#4CAF50',
          icon: 'checkmark-circle'
        };
      }
      return null;
      
    case 'bm': // BM diapers
      const expectedBM = ageInMonths < 3 ? 5 :
                        ageInMonths < 6 ? 3 :
                        ageInMonths < 12 ? 2 : 1.5;
      
      if (numValue < 1 && ageInMonths < 6) {
        return {
          message: 'Infrequent for age',
          color: '#FF9800',
          icon: 'alert-circle',
          advice: 'Monitor for constipation'
        };
      } else if (numValue > expectedBM + 3) {
        return {
          message: 'Very frequent',
          color: '#2196F3',
          icon: 'information-circle',
          advice: 'Normal if baby is well'
        };
      }
      return null;
      
    default:
      return null;
  }
};

const ConsentModal = ({ onConsent, onDecline }) => {
  return (
    <Modal transparent visible={true} animationType="fade">
      <View style={styles.consentModalOverlay}>
        <View style={styles.consentModalContainer}>
          <View style={styles.consentModalHeader}>
            <Ionicons name="shield-checkmark-outline" size={32} color="#1976d2" />
            <Text style={styles.consentModalTitle}>AI Insights Consent</Text>
          </View>
          
          <ScrollView 
            style={styles.consentModalScrollView}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.consentModalContentContainer}
          >
            <Text style={styles.consentModalText}>
              To provide personalized insights, we'll analyze your baby's data using AI technology.
            </Text>
            
            <Text style={styles.consentModalSubheading}>What we'll analyze:</Text>
            <Text style={styles.consentModalBullet}>- Sleep patterns and duration</Text>
            <Text style={styles.consentModalBullet}>- Feeding frequency and amounts</Text>
            <Text style={styles.consentModalBullet}>- Diaper change patterns</Text>
            <Text style={styles.consentModalBullet}>- Age-appropriate developmental milestones</Text>
            
            <Text style={styles.consentModalSubheading}>Your data privacy:</Text>
            <Text style={styles.consentModalBullet}>- Data is sent securely to OpenAI</Text>
            <Text style={styles.consentModalBullet}>- No personal identifying information is shared</Text>
            <Text style={styles.consentModalBullet}>- Insights are generated in real-time</Text>
            <Text style={styles.consentModalBullet}>- You can disable this feature anytime</Text>
            
            <Text style={styles.consentModalNote}>
              By enabling AI Insights, you agree to share anonymized baby care data with our AI service provider for analysis.
            </Text>
          </ScrollView>
          
          <View style={styles.consentModalActions}>
            <TouchableOpacity style={styles.consentDeclineButton} onPress={onDecline}>
              <Text style={styles.consentDeclineText}>Not Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.consentAcceptButton} onPress={onConsent}>
              <Text style={styles.consentAcceptText}>Enable AI Insights</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Parse markdown-style formatting from AI response
const renderFormattedText = (text, darkMode) => {
  if (!text) return null;
  
  // Remove any markdown headers (###, ##, #)
  text = text.replace(/^#{1,6}\s+/gm, '');
  
  const lines = text.split('\n');
  return lines.map((line, index) => {
    // Skip empty lines
    if (!line.trim()) return null;
    
    // Bold headers with **text**
    if (line.includes('**')) {
      const parts = line.split('**');
      return (
        <Text key={index} style={[
          styles.aiSummaryLine,
          { color: darkMode ? '#ddd' : '#333' }
        ]}>
          {parts.map((part, i) => 
            i % 2 === 1 ? (
              <Text key={i} style={[
                styles.aiBoldText,
                { color: darkMode ? '#64b5f6' : '#1976d2' }
              ]}>
                {part}
              </Text>
            ) : (
              <Text key={i}>{part}</Text>
            )
          )}
        </Text>
      );
    }
    
    // Bullet points (•, -, or *)
    if (/^[•\-\*]\s+/.test(line.trim())) {
      return (
        <View key={index} style={styles.aiBulletContainer}>
          <Text style={[
            styles.aiBulletPoint,
            { color: darkMode ? '#64b5f6' : '#1976d2' }
          ]}>
            •
          </Text>
          <Text style={[
            styles.aiBulletText,
            { color: darkMode ? '#ddd' : '#333' }
          ]}>
            {line.replace(/^[•\-\*]\s*/, '')}
          </Text>
        </View>
      );
    }
    
    // Section numbers (1., 2., etc.) - make them standalone headers
    const numberMatch = line.match(/^(\d+)\.\s*(.+)/);
    if (numberMatch) {
      return (
        <View key={index} style={styles.aiNumberedSection}>
          <View style={styles.aiNumberBadge}>
            <Text style={styles.aiNumberBadgeText}>{numberMatch[1]}</Text>
          </View>
          <Text style={[
            styles.aiNumberedTitle,
            { color: darkMode ? '#e0e0e0' : '#333' }
          ]}>
            {numberMatch[2]}
          </Text>
        </View>
      );
    }
    
    // Regular text
    if (line.trim()) {
      return (
        <Text key={index} style={[
          styles.aiSummaryLine,
          { color: darkMode ? '#ddd' : '#333' }
        ]}>
          {line}
        </Text>
      );
    }
    
    return null;
  }).filter(Boolean);
};

const AIPoweredSummary = ({ 
  childId, 
  childAge, 
  childWeight, 
  childHeight, 
  sleepData, 
  feedingData, 
  diaperData, 
  reportRange, 
  activeTab: mainActiveTab, 
  darkMode, 
  theme,
  isOverviewMode = false,
  forceRefresh = false
}) => {
  const [summaryCache, setSummaryCache] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasConsented, setHasConsented] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const cacheLoadedRef = useRef(false);
  const consentCheckRef = useRef(false);
  const forceRefreshProcessedRef = useRef(false); // NEW: Track if we've processed this refresh

  useEffect(() => {
    if (consentCheckRef.current) return;
    
    const loadConsent = async () => {
      try {
        const consent = await AsyncStorage.getItem(`ai_consent_${childId}`);
        setHasConsented(consent === 'true');
        
        const cached = await AsyncStorage.getItem(`ai_summary_cache_${childId}`);
        if (cached) {
          const parsedCache = JSON.parse(cached);
          setSummaryCache(parsedCache);
          cacheLoadedRef.current = true;
        }
      } catch (error) {
        console.error('Error loading AI data:', error);
      }
    };
    
    if (childId && !cacheLoadedRef.current) {
      consentCheckRef.current = true;
      loadConsent();
    }
  }, [childId]);

  // NEW: Separate useEffect to handle forceRefresh
  useEffect(() => {
    if (forceRefresh && hasConsented && cacheLoadedRef.current && !forceRefreshProcessedRef.current) {
      console.log('Force refresh detected, regenerating summary...');
      forceRefreshProcessedRef.current = true;
      handleGenerateSummary(isOverviewMode ? 'Overall' : mainActiveTab, true);
      
      // Reset the ref after processing
      setTimeout(() => {
        forceRefreshProcessedRef.current = false;
      }, 1000);
    } else if (!forceRefresh) {
      // Reset when forceRefresh becomes false
      forceRefreshProcessedRef.current = false;
    }
  }, [forceRefresh, hasConsented, cacheLoadedRef.current, isOverviewMode, mainActiveTab]);

  const handleGenerateSummary = async (category, forceRefresh = false) => {
    const cacheKey = `${reportRange}_${category}`;
    
    if (!forceRefresh && summaryCache[cacheKey]) {
      console.log('Using cached summary for:', cacheKey);
      return;
    }

    console.log('Generating new summary for:', cacheKey, 'Force:', forceRefresh);
    setIsLoading(true);
    setError(null);
    
    try {
      // In overview mode, only generate overall summary
      if (isOverviewMode) {
        const overallResponse = await generateCategorizedAISummary(
          childId, childAge, childWeight, childHeight, 
          sleepData || [], feedingData || [], diaperData || [],
          'Overall', reportRange
        );
        
        const newCache = {
          ...summaryCache,
          [`${reportRange}_Overall`]: overallResponse
        };
        
        setSummaryCache(newCache);
        await AsyncStorage.setItem(`ai_summary_cache_${childId}`, JSON.stringify(newCache));
        console.log('✅ Overview summary generated and cached');
      } else {
        // In regular mode, generate both overall and category-specific
        const [overallResponse, categoryResponse] = await Promise.all([
          generateCategorizedAISummary(
            childId, childAge, childWeight, childHeight, 
            sleepData || [], feedingData || [], diaperData || [],
            'Overall', reportRange
          ),
          generateCategorizedAISummary(
            childId, childAge, childWeight, childHeight, 
            sleepData || [], feedingData || [], diaperData || [],
            category, reportRange
          )
        ]);
        
        const newCache = {
          ...summaryCache,
          [`${reportRange}_Overall`]: overallResponse,
          [cacheKey]: categoryResponse
        };
        
        setSummaryCache(newCache);
        await AsyncStorage.setItem(`ai_summary_cache_${childId}`, JSON.stringify(newCache));
        console.log('✅ Regular summaries generated and cached');
      }
    } catch (error) {
      console.error('❌ Error in handleGenerateSummary:', error);
      setError('Unable to generate AI insights at this time. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsent = async () => {
    setShowConsentModal(false);
    
    try {
      await AsyncStorage.setItem(`ai_consent_${childId}`, 'true');
      setHasConsented(true);
      setTimeout(() => {
        handleGenerateSummary(isOverviewMode ? 'Overall' : mainActiveTab);
      }, 300);
    } catch (error) {
      console.error('Error saving consent:', error);
      Alert.alert('Error', 'Failed to save consent preference');
    }
  };

  const handleRevokeConsent = async () => {
    try {
      await AsyncStorage.multiRemove([
        `ai_consent_${childId}`,
        `ai_summary_cache_${childId}`
      ]);
      setHasConsented(false);
      setSummaryCache({});
      setShowRevokeConfirm(false);
      Alert.alert('Success', 'AI Insights access has been revoked');
    } catch (error) {
      console.error('Error revoking consent:', error);
      Alert.alert('Error', 'Failed to revoke consent');
    }
  };

  useEffect(() => {
    if (!hasConsented || !cacheLoadedRef.current) return;
    
    const cacheKey = isOverviewMode 
      ? `${reportRange}_Overall`
      : `${reportRange}_${mainActiveTab}`;
    
    const shouldLoad = !summaryCache[cacheKey] && 
                      (sleepData?.length > 0 || feedingData?.length > 0 || diaperData?.length > 0);
    
    if (shouldLoad) {
      console.log('Auto-generating summary for:', cacheKey);
      handleGenerateSummary(isOverviewMode ? 'Overall' : mainActiveTab);
    }
  }, [reportRange, hasConsented, cacheLoadedRef.current]);

  // Rest of the component remains the same...
  if (!childId) return null;

  const currentCacheKey = isOverviewMode 
    ? `${reportRange}_Overall`
    : `${reportRange}_${mainActiveTab}`;

  return (
    <View style={[
      styles.aiSummaryContainer,
      isOverviewMode && styles.aiSummaryContainerCompact,
      {
        backgroundColor: darkMode ? '#2a2a2a' : '#fff',
        borderColor: darkMode ? '#404040' : '#e8eaf6'
      }
    ]}>
      {/* Modals */}
      {showConsentModal && !showRevokeConfirm && (
        <ConsentModal 
          onConsent={handleConsent}
          onDecline={() => setShowConsentModal(false)}
        />
      )}

      {showRevokeConfirm && !showConsentModal && (
        <Modal transparent visible={true} animationType="fade">
          <View style={styles.consentModalOverlay}>
            <View style={[styles.consentModalContainer, { maxHeight: '40%' }]}>
              <View style={styles.consentModalHeader}>
                <Ionicons name="warning-outline" size={32} color="#f44336" />
                <Text style={styles.consentModalTitle}>Revoke AI Access?</Text>
              </View>
              
              <View style={{ padding: 20 }}>
                <Text style={styles.consentModalText}>
                  This will disable AI-powered insights and delete your consent preference. You can re-enable it anytime.
                </Text>
              </View>
              
              <View style={styles.consentModalActions}>
                <TouchableOpacity 
                  style={styles.consentDeclineButton} 
                  onPress={() => setShowRevokeConfirm(false)}
                >
                  <Text style={styles.consentDeclineText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.consentAcceptButton, { backgroundColor: '#f44336' }]} 
                  onPress={handleRevokeConsent}
                >
                  <Text style={styles.consentAcceptText}>Revoke Access</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Header - Only show in non-overview mode */}
      {!isOverviewMode && (
        <View style={styles.aiSummaryHeaderRow}>
          <View style={styles.aiSummaryHeaderLeft}>
            <Ionicons name="sparkles" size={20} color="#1976d2" style={{ marginRight: 8 }} />
            <View>
              <Text style={[styles.aiSummaryTitle, { color: darkMode ? '#fff' : '#333' }]}>
                AI Insights
              </Text>
              <Text style={[styles.aiSummarySubtitle, { color: darkMode ? '#aaa' : '#999' }]}>
                Powered by GPT-4
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {hasConsented && (
              <>
                <TouchableOpacity 
                  onPress={() => handleGenerateSummary(mainActiveTab, true)} 
                  style={styles.refreshIconButton}
                  disabled={isLoading}
                >
                  <Ionicons 
                    name="refresh" 
                    size={20} 
                    color={isLoading ? '#ccc' : '#1976d2'} 
                  />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setShowRevokeConfirm(true)} 
                  style={[styles.refreshIconButton, { backgroundColor: darkMode ? '#3a3a3a' : '#ffebee' }]}
                >
                  <Ionicons 
                    name="lock-closed" 
                    size={18} 
                    color="#f44336" 
                  />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* Content */}
      {!hasConsented && !showConsentModal && (
        <TouchableOpacity 
          style={styles.consentPromptButton}
          onPress={() => setShowConsentModal(true)}
        >
          <Ionicons name="lock-closed-outline" size={16} color="#FFF" />
          <Text style={styles.consentPromptText}>Enable AI Insights</Text>
        </TouchableOpacity>
      )}

      {hasConsented && (
        <>
          {isLoading && (
            <View style={styles.aiLoadingContainer}>
              <ActivityIndicator size="small" color="#1976d2" />
              <Text style={[styles.aiLoadingText, { color: darkMode ? '#bbb' : '#666' }]}>
                Analyzing patterns...
              </Text>
            </View>
          )}
          
          {error && (
            <View style={[
              styles.aiErrorContainer,
              { backgroundColor: darkMode ? '#5f2f2f' : '#ffebee' }
            ]}>
              <Ionicons name="alert-circle" size={20} color={darkMode ? '#ff6b6b' : '#d32f2f'} />
              <Text style={[
                styles.aiErrorText,
                { color: darkMode ? '#ff9999' : '#d32f2f' }
              ]}>
                {error}
              </Text>
            </View>
          )}
          
          {!isLoading && !error && summaryCache[currentCacheKey] && (
            <View style={styles.aiContentContainer}>
              <View style={[
                styles.aiInsightCard,
                { backgroundColor: darkMode ? '#1f1f1f' : '#fafafa' }
              ]}>
                <View style={styles.aiInsightContent}>
                  {renderFormattedText(summaryCache[currentCacheKey], darkMode)}
                </View>
              </View>
            </View>
          )}
          
          {!isLoading && !error && !summaryCache[currentCacheKey] && (
            <View style={styles.noDataContainer}>
              <Ionicons name="analytics-outline" size={40} color={darkMode ? '#555' : '#ccc'} />
              <Text style={[
                styles.noDataText,
                { color: darkMode ? '#aaa' : '#666' }
              ]}>
                Tap refresh to get personalized insights
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
};

const getCachedData = (rangeType) => {
  const cached = dataCache[rangeType];
  if (!cached || !cached.timestamp) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_DURATION) {
    console.log(`Cache expired for ${rangeType}`);
    return null;
  }
  
  console.log(`Using cached data for ${rangeType}`);
  return cached;
};

const updateCache = (rangeType, sleepLogs, feedingLogs, diaperLogs) => {
  setDataCache(prev => ({
    ...prev,
    [rangeType]: {
      sleep: sleepLogs,
      feeding: feedingLogs,
      diaper: diaperLogs,
      timestamp: Date.now()
    }
  }));
};

// REPLACE the fetchAllData function in the second useEffect (around line 1185)

const fetchAllData = async () => {
  setIsLoading(true);
  
  try {
    const { start, end } = getTimeRange();
    
    const startTimestamp = Timestamp.fromDate(new Date(start.setHours(0, 0, 0, 0)));
    const endTimestamp = Timestamp.fromDate(new Date(end.setHours(23, 59, 59, 999)));
    
    // Check if we're on Annual or Overview and have cached data
    const cacheType = reportRange === 'Annual' ? 'annual' : reportRange === 'Overview' ? 'overview' : null;
    
    if (cacheType) {
      const cached = getCachedData(cacheType);
      if (cached) {
        console.log(`Loading from cache for ${reportRange}`);
        setSleepData(cached.sleep);
        setFeedingData(cached.feeding);
        setDiaperData(cached.diaper);
        await fetchChildData(); // Still fetch child data as it might change
        setIsLoading(false);
        return;
      }
    }
    
    console.log(`Fetching fresh data for ${reportRange}`);
    await Promise.all([
      fetchChildData(),
      fetchSleepData(startTimestamp, endTimestamp),
      fetchDiaperData(startTimestamp, endTimestamp),
      fetchFeedingData(startTimestamp, endTimestamp)
    ]);
    
    // Cache the data if it's Annual or Overview
    if (cacheType) {
      console.log(`Caching data for ${reportRange}`);
      updateCache(cacheType, sleepData, feedingData, diaperData);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    Alert.alert('Error', 'Failed to fetch report data.');
  } finally {
    setIsLoading(false);
  }
};


const fetchSleepData = async (startTimestamp, endTimestamp) => {
  try {
    console.log('Fetching sleep data for:', {
      childId,
      startDate: startTimestamp.toDate(),
      endDate: endTimestamp.toDate(),
      range: reportRange
    });
    
    // For annual reports, fetch in batches by month to avoid large queries
    if (reportRange === 'Annual') {
      const logs = [];
      const startDate = startTimestamp.toDate();
      const endDate = endTimestamp.toDate();
      
      let currentStart = new Date(startDate);
      let monthsProcessed = 0;
      
      while (currentStart < endDate) {
        const monthEnd = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 0, 23, 59, 59);
        const batchEnd = monthEnd < endDate ? monthEnd : endDate;
        
        console.log(`Fetching sleep data for month ${monthsProcessed + 1}/12`);
        
        const sleepQuery = query(
          collection(db, 'sleepLogs'),
          where('childId', '==', childId),
          where('timestamp', '>=', Timestamp.fromDate(currentStart)),
          where('timestamp', '<=', Timestamp.fromDate(batchEnd)),
          orderBy('timestamp', 'asc')
        );
        
        const querySnapshot = await getDocs(sleepQuery);
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          logs.push({ id: doc.id, ...data });
        });
        
        monthsProcessed++;
        // Move to next month
        currentStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 1);
      }
      
      console.log(`Total sleep logs fetched (annual): ${logs.length}`);
      setSleepData(logs);
      return logs;
    } else {
      // For weekly/monthly, use single query
      const sleepQuery = query(
        collection(db, 'sleepLogs'),
        where('childId', '==', childId),
        where('timestamp', '>=', startTimestamp),
        where('timestamp', '<=', endTimestamp),
        orderBy('timestamp', 'asc')
      );
      
      const querySnapshot = await getDocs(sleepQuery);
      const logs = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({ id: doc.id, ...data });
      });
      
      console.log(`Total sleep logs fetched: ${logs.length}`);
      setSleepData(logs);
      return logs;
    }
  } catch (error) {
    console.error('Error fetching sleep logs:', error);
    Alert.alert('Error', 'Failed to fetch sleep data: ' + error.message);
    return [];
  }
};

const fetchDiaperData = async (startTimestamp, endTimestamp) => {
  try {
    console.log('Fetching diaper data for range:', reportRange);
    
    if (reportRange === 'Annual') {
      const logs = [];
      const startDate = startTimestamp.toDate();
      const endDate = endTimestamp.toDate();
      
      let currentStart = new Date(startDate);
      let monthsProcessed = 0;
      
      while (currentStart < endDate) {
        const monthEnd = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 0, 23, 59, 59);
        const batchEnd = monthEnd < endDate ? monthEnd : endDate;
        
        console.log(`Fetching diaper data for month ${monthsProcessed + 1}/12`);
        
        const diaperQuery = query(
          collection(db, 'diaperLogs'),
          where('childId', '==', childId),
          where('time', '>=', Timestamp.fromDate(currentStart)),
          where('time', '<=', Timestamp.fromDate(batchEnd)),
          orderBy('time', 'asc')
        );
        
        const querySnapshot = await getDocs(diaperQuery);
        querySnapshot.forEach((doc) => {
          logs.push({ id: doc.id, ...doc.data() });
        });
        
        monthsProcessed++;
        currentStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 1);
      }
      
      console.log(`Total diaper logs fetched (annual): ${logs.length}`);
      setDiaperData(logs);
      return logs;
    } else {
      const diaperQuery = query(
        collection(db, 'diaperLogs'),
        where('childId', '==', childId),
        where('time', '>=', startTimestamp),
        where('time', '<=', endTimestamp),
        orderBy('time', 'asc')
      );
      
      const querySnapshot = await getDocs(diaperQuery);
      const logs = [];
      
      querySnapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() });
      });
      
      console.log(`Total diaper logs fetched: ${logs.length}`);
      setDiaperData(logs);
      return logs;
    }
  } catch (error) {
    console.error('Error fetching diaper logs:', error);
    return [];
  }
};

const fetchFeedingData = async (startTimestamp, endTimestamp) => {
  try {
    console.log('Fetching feeding data for range:', reportRange);
    
    if (reportRange === 'Annual') {
      const logs = [];
      const startDate = startTimestamp.toDate();
      const endDate = endTimestamp.toDate();
      
      let currentStart = new Date(startDate);
      let monthsProcessed = 0;
      
      while (currentStart < endDate) {
        const monthEnd = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 0, 23, 59, 59);
        const batchEnd = monthEnd < endDate ? monthEnd : endDate;
        
        console.log(`Fetching feeding data for month ${monthsProcessed + 1}/12`);
        
        const feedingQuery = query(
          collection(db, 'feedLogs'),
          where('childId', '==', childId),
          where('timestamp', '>=', Timestamp.fromDate(currentStart)),
          where('timestamp', '<=', Timestamp.fromDate(batchEnd)),
          orderBy('timestamp', 'asc')
        );
        
        const querySnapshot = await getDocs(feedingQuery);
        querySnapshot.forEach((doc) => {
          logs.push({ id: doc.id, ...doc.data() });
        });
        
        monthsProcessed++;
        currentStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 1);
      }
      
      console.log(`Total feeding logs fetched (annual): ${logs.length}`);
      setFeedingData(logs);
      return logs;
    } else {
      const feedingQuery = query(
        collection(db, 'feedLogs'),
        where('childId', '==', childId),
        where('timestamp', '>=', startTimestamp),
        where('timestamp', '<=', endTimestamp),
        orderBy('timestamp', 'asc')
      );
      
      const querySnapshot = await getDocs(feedingQuery);
      const logs = [];
      
      querySnapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() });
      });
      
      console.log(`Total feeding logs fetched: ${logs.length}`);
      setFeedingData(logs);
      return logs;
    }
  } catch (error) {
    console.error('Error fetching feeding logs:', error);
    return [];
  }
};

const fetchMeasurementsData = async (startTimestamp, endTimestamp) => {
  try {
    console.log('Fetching measurements data for range:', reportRange);
    
    const measurementsQuery = query(
      collection(db, 'measurements'),
      where('childId', '==', childId),
      where('date', '>=', startTimestamp),
      where('date', '<=', endTimestamp),
      orderBy('date', 'asc')
    );
    
    const querySnapshot = await getDocs(measurementsQuery);
    const logs = [];
    
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`Total measurements fetched: ${logs.length}`);
    setMeasurementsData(logs);
    
    // Calculate current percentiles if we have data
    if (logs.length > 0 && childData) {
      const latestMeasurement = logs[logs.length - 1];
      const ageMonths = calculateAge(childData.birthdate);
      
      setGrowthPercentiles({
        weight: getPercentile(latestMeasurement.weight, ageMonths, childData.sex, 'weight', childData),
        height: getPercentile(latestMeasurement.height, ageMonths, childData.sex, 'height', childData)
      });
    }
    
    return logs;
  } catch (error) {
    console.error('Error fetching measurements:', error);
    return [];
  }
};

const processSleepData = () => {
  const { periodLabels } = getTimeRange();
  
  const durationData = Array(periodLabels.length).fill(0);
  const countData = Array(periodLabels.length).fill(0);
  const nightSleepData = Array(periodLabels.length).fill(0);
  const napData = Array(periodLabels.length).fill(0);
  
  console.log('Processing sleep data:', sleepData.length, 'entries');
  
  sleepData.forEach(log => {
    const logDate = log.timestamp.toDate();
    let index = getTimeIndex(logDate, reportRange);
    
    if (index >= 0 && index < durationData.length && log.duration) {
      const hours = log.duration / 60;
      durationData[index] += hours;
      countData[index]++;
      
      const hour = logDate.getHours();
      const isNightSleep = (hour >= 19 || hour <= 6) && hours >= 4;
      
      if (isNightSleep) {
        nightSleepData[index] += hours;
      } else {
        napData[index] += hours;
      }
    }
  });
  
  console.log('Sleep duration data:', durationData);
  console.log('Sleep count data:', countData);
  
  // Calculate divisor based on report range
  const getDivisor = () => {
    if (reportRange === 'Weekly') return 1; // Show total per day
    if (reportRange === 'Monthly') return 7; // Show average per week
    return 30; // Show average per month for annual
  };
  
  const divisor = getDivisor();
  
  // Display data (totals for weekly, averages for monthly/annual)
  const displayData = durationData.map((total) => 
    reportRange === 'Weekly' ? parseFloat(total.toFixed(1)) : parseFloat((total / divisor).toFixed(1))
  );
  
  // Age-appropriate benchmark
  const recommendedSleep = childData?.age 
    ? (childData.age < 3 ? 15.5 : childData.age < 6 ? 14 : childData.age < 12 ? 12.5 : 12)
    : 12;
  const benchmarkLine = Array(periodLabels.length).fill(recommendedSleep);
  
  // Calculate summary statistics - FIXED: these should match AI calculation
  const totalDays = reportRange === 'Weekly' ? 7 : reportRange === 'Monthly' ? 30 : 365;
  
  // Calculate totals from actual data, not from display buckets
  const totalSleepHours = sleepData.reduce((sum, log) => sum + (log.duration || 0) / 60, 0);
  
  // Calculate night vs nap from actual logs
  const nightSleeps = sleepData.filter(s => {
    const hour = s.timestamp?.toDate().getHours();
    const duration = (s.duration || 0) / 60;
    return (hour >= 19 || hour <= 6) && duration >= 4;
  });
  
  const daySleeps = sleepData.filter(s => {
    const hour = s.timestamp?.toDate().getHours();
    const duration = (s.duration || 0) / 60;
    return hour > 6 && hour < 19 && duration < 4;
  });
  
  const totalNightHours = nightSleeps.reduce((sum, s) => sum + (s.duration || 0) / 60, 0);
  const totalNapHours = daySleeps.reduce((sum, s) => sum + (s.duration || 0) / 60, 0);
  const totalSessions = sleepData.length;
  
  const avgTotalDaily = totalDays > 0 ? (totalSleepHours / totalDays).toFixed(1) : '0';
  const avgNightSleep = totalDays > 0 ? (totalNightHours / totalDays).toFixed(1) : '0';
  const avgNaps = totalDays > 0 ? (totalNapHours / totalDays).toFixed(1) : '0';
  const avgSessions = totalDays > 0 ? (totalSessions / totalDays).toFixed(1) : '0';
  
  // Fix NaN display
  const safeValue = (val) => (isNaN(parseFloat(val)) || val === 'NaN') ? '0' : val;
  
  console.log('Summary - Total:', avgTotalDaily, 'Night:', avgNightSleep, 'Naps:', avgNaps);
  
  return {
    lineData: {
      labels: periodLabels,
      datasets: [
        {
          data: displayData.map(v => isNaN(v) ? 0 : v),
          color: (opacity = 1) => darkMode ? `rgba(100, 181, 246, ${opacity})` : `rgba(25, 118, 210, ${opacity})`,
          strokeWidth: 3,
          withDots: true
        }
      ],
      legend: ["Total Sleep"]
    },
    summary: [
      { 
        key: 'total', 
        label: 'Daily Total',
        avg: safeValue(avgTotalDaily),
        unit: 'hrs',
        trend: calculateTrend(displayData),
        metric: 'more',
        benchmark: recommendedSleep,
        icon: 'moon'
      },
      { 
        key: 'night', 
        label: 'Night Sleep',
        avg: safeValue(avgNightSleep),
        unit: 'hrs',
        trend: calculateTrend(nightSleepData),
        metric: 'more',
        icon: 'moon-outline'
      },
      {
        key: 'naps',
        label: 'Daytime Naps',
        avg: safeValue(avgNaps),
        unit: 'hrs',
        trend: calculateTrend(napData),
        metric: 'stable',
        icon: 'partly-sunny'
      },
      {
        key: 'sessions',
        label: 'Sleep Sessions',
        avg: safeValue(avgSessions),
        unit: '',
        trend: calculateTrend(countData),
        metric: 'stable',
        icon: 'repeat'
      }
    ],
    timeDistribution: calculateTimeDistribution(sleepData),
    breakdown: {
      night: nightSleepData,
      naps: napData
    }
  };
};

// Helper function for consistent time indexing

const getTimeIndex = (logDate, range) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  
  const logDateOnly = new Date(logDate);
  logDateOnly.setHours(0, 0, 0, 0);
  
  const todayOnly = new Date(today);
  todayOnly.setHours(0, 0, 0, 0);
  
  const diffTime = todayOnly - logDateOnly;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (range === 'Weekly') {
    // 0 = today, 1 = yesterday, ..., 6 = 6 days ago
    // Reverse for chart display: index 0 = 6 days ago, index 6 = today
    if (diffDays < 0 || diffDays > 6) return -1;
    return 6 - diffDays;
  } else if (range === 'Monthly') {
    // Groups by weeks
    const weekNumber = Math.floor(diffDays / 7);
    if (weekNumber < 0 || weekNumber > 3) return -1;
    return 3 - weekNumber;
  } else {
    // For annual: by month
    const monthDiff = (today.getFullYear() - logDateOnly.getFullYear()) * 12 + 
                      (today.getMonth() - logDateOnly.getMonth());
    if (monthDiff < 0 || monthDiff > 11) return -1;
    return 11 - monthDiff;
  }
};


// Helper to calculate trend
const calculateTrend = (data) => {
  if (data.length < 2) return 'stable';
  const recent = data.slice(-3).filter(v => v > 0);
  const earlier = data.slice(0, -3).filter(v => v > 0);
  
  if (recent.length === 0 || earlier.length === 0) return 'stable';
  
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
  const change = ((recentAvg - earlierAvg) / earlierAvg) * 100;
  
  if (Math.abs(change) < 5) return 'stable';
  return change > 0 ? 'up' : 'down';
};

// Helper for time distribution

const calculateTimeDistribution = (logs) => {
  if (!logs || logs.length === 0) return [];
  
  const timeDistribution = {};
  logs.forEach(log => {
    if (log.timestamp) {
      const startHour = log.timestamp.toDate().getHours();
      timeDistribution[startHour] = (timeDistribution[startHour] || 0) + 1;
    }
  });
  
  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
  return Object.entries(timeDistribution)
    .map(([hour, count]) => {
      const h = parseInt(hour);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return {
        name: `${hour12} ${ampm}`,
        count,
        color: colors[h % colors.length],
        legendFontColor: '#7F7F7F',
        legendFontSize: 10
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
};


  const processSleepHeatMapData = () => {
    const { periodLabels } = getTimeRange();
    const hours = Array.from({ length: 24 }, (_, i) => i); // 0-23 hours
  
    const heatmapData = hours.map(hour => ({
      name: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? ' AM' : ' PM'}`,
      data: periodLabels.map(day => ({ x: day, y: 0 }))
    }));
  
    sleepData.forEach(log => {
      const logDate = log.timestamp.toDate();
      const dayIndex = (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today - logDate) / (1000 * 60 * 60 * 24));
        return 6 - Math.min(diffDays, 6);
      })();
  
      const sleepStartHour = logDate.getHours();
      const durationHours = Math.ceil((log.duration || 0) / 60);
  
      for (let i = 0; i < durationHours; i++) {
        const hourSlot = (sleepStartHour + i) % 24;
        if (heatmapData[hourSlot] && heatmapData[hourSlot].data[dayIndex]) {
          heatmapData[hourSlot].data[dayIndex].y += 30; // You can tweak intensity
        }
      }
    });
  
    return {
      series: heatmapData,
      categories: periodLabels
    };
  };
  

const processDiaperData = () => {
  const { periodLabels } = getTimeRange();
  
  const wetCount = Array(periodLabels.length).fill(0);
  const bmCount = Array(periodLabels.length).fill(0);
  const wetBmCount = Array(periodLabels.length).fill(0);
  const dryCount = Array(periodLabels.length).fill(0);
  
  diaperData.forEach(log => {
    const logDate = new Date(log.time.seconds * 1000);
    let index = getTimeIndex(logDate, reportRange);
    
    if (index >= 0 && index < wetCount.length) {
      const type = (log.stoolType || '').toLowerCase().replace(/\s+/g, '');
      
      if (type.includes('wet') && type.includes('bm')) {
        wetBmCount[index]++;
        wetCount[index]++;
        bmCount[index]++;
      } else if (type.includes('wet')) {
        wetCount[index]++;
      } else if (type.includes('bm')) {
        bmCount[index]++;
      } else if (type.includes('dry')) {
        dryCount[index]++;
      } else {
        wetCount[index]++;
      }
    }
  });
  
  // FIXED: Calculate totals directly from actual data for consistency with AI
  const totalWet = diaperData.filter(d => 
    d.stoolType?.toLowerCase().includes('wet')
  ).length;
  
  const totalBM = diaperData.filter(d => 
    d.stoolType?.toLowerCase().includes('bm')
  ).length;
  
  const totalDry = diaperData.filter(d => 
    d.stoolType?.toLowerCase().includes('dry') && 
    !d.stoolType?.toLowerCase().includes('wet') &&
    !d.stoolType?.toLowerCase().includes('bm')
  ).length;
  
  const totalChanges = diaperData.length;
  
  const divisor = reportRange === 'Weekly' ? 7 : reportRange === 'Monthly' ? 30 : 365;
  const avgChangesPerDay = (totalChanges / divisor).toFixed(1);
  const avgWetPerDay = (totalWet / divisor).toFixed(1);
  const avgBMPerDay = (totalBM / divisor).toFixed(1);
  
  // DEFINE these arrays for trend calculation
  const totalCountsPerPeriod = wetCount.map((w, i) => 
    w + bmCount[i] + dryCount[i]
  );
  const wetCountsPerPeriod = wetCount;
  const bmCountsPerPeriod = bmCount;
  
  // For display
  const sanitize = (arr) => arr.map(val => Math.max(0, val));
  const displayWetCount = wetCount.map((val, i) => Math.max(0, val - wetBmCount[i]));
  const displayBmCount = bmCount.map((val, i) => Math.max(0, val - wetBmCount[i]));

  return {
    series: [
      { name: "Base", data: Array(periodLabels.length).fill(0) },
      { name: "Wet", data: sanitize(displayWetCount) },
      { name: "BM", data: sanitize(displayBmCount) },
      { name: "Wet + BM", data: sanitize(wetBmCount) },
      { name: "Dry", data: sanitize(dryCount) }
    ],
    barData: {
      datasets: [
        { color: () => '#2196F3', legend: 'Wet' },
        { color: () => '#8BC34A', legend: 'BM' },
        { color: () => '#FF9800', legend: 'Wet + BM' },
        { color: () => '#9E9E9E', legend: 'Dry' }
      ]
    },
    options: {
      xaxis: {
        categories: periodLabels
      }
    },
    summary: [
      { 
        key: 'total', 
        label: 'Changes/Day',
        avg: avgChangesPerDay,
        trend: calculateTrend(totalCountsPerPeriod),
        metric: 'stable',
        icon: 'repeat',
        benchmark: 6,
        unit: '/day'
      },
      { 
        key: 'wet', 
        label: 'Wet Diapers',
        avg: avgWetPerDay,
        trend: calculateTrend(wetCountsPerPeriod),
        metric: 'more',
        icon: 'water',
        benchmark: 5,
        unit: '/day'
      },
      { 
        key: 'bm', 
        label: 'BM Diapers',
        avg: avgBMPerDay,
        trend: calculateTrend(bmCountsPerPeriod),
        metric: 'stable',
        icon: 'medical',
        benchmark: null,
        unit: '/day'
      },
      {
        key: 'ratio',
        label: 'Wet:BM Ratio',
        avg: totalBM > 0 ? (totalWet / totalBM).toFixed(1) : 'N/A',
        trend: 'stable',
        metric: 'info',
        icon: 'analytics',
        benchmark: null,
        unit: ':1'
      }
    ]
  };
};
    

const processFeedingData = () => {
  const getMostCommonUnit = (logs) => {
    const unitCounts = {};
    logs.forEach(log => {
      const unit = log.amountUnit || 'ml';
      unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    });
    
    let mostCommon = 'ml';
    let maxCount = 0;
    for (const [unit, count] of Object.entries(unitCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = unit;
      }
    }
    return mostCommon;
  };
  const { periodLabels } = getTimeRange();
  
  const feedingCounts = Array(periodLabels.length).fill(0);
  const feedTimestamps = [];
  const feedingMethodCounts = {};
  const hourBuckets = new Array(24).fill(0);
  const feedingAmounts = [];
  
  

  feedingData.forEach(log => {
    if (log.timestamp) {
      const logDate = log.timestamp.toDate();
      feedTimestamps.push(logDate);

      let index;

      if (reportRange === 'Weekly') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(today - logDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        index = 6 - Math.min(diffDays, 6);
      } else if (reportRange === 'Monthly') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(today - logDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        index = 3 - Math.min(Math.floor(diffDays / 7), 3);
      } else {
        index = logDate.getMonth();
      }

      if (index >= 0 && index < feedingCounts.length) {
        feedingCounts[index]++;
      }

      const hour = logDate.getHours();
      hourBuckets[hour]++;

      if (log.feedType) {
        feedingMethodCounts[log.feedType] = (feedingMethodCounts[log.feedType] || 0) + 1;
      }
      
      if (log.amount) {
        feedingAmounts.push(log.amount);
      }
    }
  });

  // Calculate average gap
  let averageGapHours = 0;
  if (feedTimestamps.length >= 2) {
    feedTimestamps.sort((a, b) => a - b);
    let totalGap = 0;
    for (let i = 1; i < feedTimestamps.length; i++) {
      totalGap += (feedTimestamps[i] - feedTimestamps[i - 1]) / (1000 * 60 * 60);
    }
    averageGapHours = totalGap / (feedTimestamps.length - 1);
  }

  // Calculate average amount
  const avgAmount = feedingAmounts.length > 0 
    ? feedingAmounts.reduce((a, b) => a + b, 0) / feedingAmounts.length 
    : 0;

  // Most common feeding time
  let mostCommonHour = null;
  let maxFeedings = 0;
  hourBuckets.forEach((count, hour) => {
    if (count > maxFeedings) {
      mostCommonHour = hour;
      maxFeedings = count;
    }
  });

  // Most used method
  let mostUsedMethod = null;
  let maxMethodCount = 0;
  for (const method in feedingMethodCounts) {
    if (feedingMethodCounts[method] > maxMethodCount) {
      mostUsedMethod = method;
      maxMethodCount = feedingMethodCounts[method];
    }
  }

  // Calculate feedings per day
  const divisor = reportRange === 'Weekly' ? 7 : reportRange === 'Monthly' ? 30 : 365;
  const avgFeedingsPerDay = feedingData.length / divisor;

const targetFeedingsPerDay = childData?.age 
  ? (childData.age < 3 ? 10 : childData.age < 6 ? 7 : childData.age < 12 ? 5 : 4)
  : 6;

  const targetLine = Array(periodLabels.length).fill(targetFeedingsPerDay);

  return {
    lineData: {
      labels: periodLabels,
      datasets: [
        {
          data: feedingCounts,
          color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`,
          strokeWidth: 3,
          withDots: true,
          legend: "Feedings"
        }
      ],
      legend: ["Feedings"]
    },
    summary: [
      { 
        key: 'perDay', 
        label: 'Per Day',
        avg: avgFeedingsPerDay.toFixed(1),
        trend: calculateTrend(feedingCounts),
        metric: 'stable',
        icon: 'calendar'
      },
      { 
        key: 'avgGap', 
        label: 'Avg Gap',
        avg: averageGapHours.toFixed(1),
        trend: 'stable',
        metric: 'stable',
        icon: 'time'
      },
      // Only show avgAmount if AI consent is given AND units are measurable
      ...(hasAIConsent ? [{
        key: 'avgCalories',
        label: 'Est. Avg Calories',
        avg: (() => {
          const getCalorieEstimate = (feedType, amount, unit) => {
            const estimates = {
              'breast milk': 20, 'breastmilk': 20,
              'formula': 20,
              'solid': 50, 'solids': 50,
              'puree': 30, 'purée': 30,
              'fruits': 40, 'fruit': 40,
              'vegetables': 25, 'vegetable': 25,
              'grains': 80, 'grain': 80,
              'protein': 70,
              'dairy': 60,
              'snacks': 100, 'snack': 100,
              'juice': 15,
              'water': 0,
              'milk': 18,
            };
            
            const type = (feedType || '').toLowerCase();
            let caloriesPerUnit = 50;
            
            for (const [key, cal] of Object.entries(estimates)) {
              if (type.includes(key)) {
                caloriesPerUnit = cal;
                break;
              }
            }
            
            let amountInOz = parseFloat(amount) || 4;
            if (unit === 'mL' || unit === 'ml') {
              amountInOz = amountInOz / 29.5735;
            } else if (unit === 'Pieces' || unit === 'pieces') {
              amountInOz = 4;
            } else if (unit === 'Cups' || unit === 'cups') {
              amountInOz = amountInOz * 8;
            }
            
            return caloriesPerUnit * amountInOz;
          };
          
          const totalCalories = feedingData.reduce((sum, f) => {
            return sum + getCalorieEstimate(f.feedType, f.amount, f.amountUnit);
          }, 0);
          
          const avgPerFeeding = totalCalories / feedingData.length;
          return Math.round(avgPerFeeding);
        })(),
        trend: 'stable',
        metric: 'info',
        icon: 'flame',
        unit: 'cal',
        details: 'AI-estimated'
      }] : []),
      {
        key: 'mostCommon',
        label: 'Common Time',
        avg: mostCommonHour !== null ? `${mostCommonHour % 12 || 12}${mostCommonHour >= 12 ? 'PM' : 'AM'}` : 'N/A',
        trend: 'stable',
        metric: 'info',
        icon: 'alarm'
      }
    ],
  };
};
  
const processGrowthData = () => {
  if (measurementsData.length === 0) {
    return {
      lineData: null,
      summary: []
    };
  }

  const { periodLabels } = getTimeRange();
  
  // Group measurements by time period
  const weightData = Array(periodLabels.length).fill(null);
  const heightData = Array(periodLabels.length).fill(null);
  
  measurementsData.forEach(measurement => {
    const measureDate = measurement.date.toDate ? measurement.date.toDate() : new Date(measurement.date);
    let index = getTimeIndex(measureDate, reportRange);
    
    if (index >= 0 && index < weightData.length) {
      // Convert to metric for consistency
      let weight = measurement.weight;
      let height = measurement.height;
      
      if (measurement.weightUnit === 'lbs') {
        weight = weight * 0.453592; // to kg
      }
      if (measurement.heightUnit === 'in') {
        height = height * 2.54; // to cm
      }
      
      // Use latest measurement for each period
      weightData[index] = weight;
      heightData[index] = height;
    }
  });

  // Calculate CDC percentile lines
  const ageMonths = calculateAge(childData.birthdate);
  const sex = childData.sex || 'Male';
  
  const weightPercentiles = getClosestAgeData(ageMonths, CDC_WEIGHT_PERCENTILES[sex.toLowerCase()]);
  const heightPercentiles = getClosestAgeData(ageMonths, CDC_HEIGHT_PERCENTILES[sex.toLowerCase()]);

  // Latest measurement
  const latestMeasurement = measurementsData[measurementsData.length - 1];
  let latestWeight = latestMeasurement.weight;
  let latestHeight = latestMeasurement.height;
  
  // Growth velocity (if we have at least 2 measurements)
  let weightGain = 0;
  let heightGain = 0;
  
  if (measurementsData.length >= 2) {
    const firstMeasurement = measurementsData[0];
    
    let firstWeight = firstMeasurement.weight;
    let firstHeight = firstMeasurement.height;
    
    if (firstMeasurement.weightUnit === 'lbs') firstWeight *= 0.453592;
    if (latestMeasurement.weightUnit === 'lbs') latestWeight *= 0.453592;
    if (firstMeasurement.heightUnit === 'in') firstHeight *= 2.54;
    if (latestMeasurement.heightUnit === 'in') latestHeight *= 2.54;
    
    weightGain = ((latestWeight - firstWeight) / firstWeight * 100).toFixed(1);
    heightGain = ((latestHeight - firstHeight) / firstHeight * 100).toFixed(1);
  }

  return {
    lineData: {
      labels: periodLabels,
      datasets: [
        {
          data: weightData.map((v, i) => v || weightData.find(w => w !== null) || 0),
          color: (opacity = 1) => darkMode ? `rgba(100, 181, 246, ${opacity})` : `rgba(25, 118, 210, ${opacity})`,
          strokeWidth: 3,
          withDots: true,
          legend: "Weight (kg)"
        }
      ],
      legend: ["Weight Progress"]
    },
    heightLineData: {
      labels: periodLabels,
      datasets: [
        {
          data: heightData.map((v, i) => v || heightData.find(h => h !== null) || 0),
          color: (opacity = 1) => darkMode ? `rgba(255, 152, 0, ${opacity})` : `rgba(255, 152, 0, ${opacity})`,
          strokeWidth: 3,
          withDots: true,
          legend: "Height (cm)"
        }
      ],
      legend: ["Height Progress"]
    },
    summary: [
      {
        key: 'currentWeight',
        label: 'Current Weight',
        avg: latestMeasurement.weight,
        unit: latestMeasurement.weightUnit,
        trend: weightGain > 0 ? 'up' : 'stable',
        metric: 'info',
        icon: 'scale'
      },
      {
        key: 'currentHeight',
        label: 'Current Height',
        avg: latestMeasurement.height,
        unit: latestMeasurement.heightUnit,
        trend: heightGain > 0 ? 'up' : 'stable',
        metric: 'info',
        icon: 'resize'
      },
      {
        key: 'weightGain',
        label: 'Weight Gain',
        avg: weightGain,
        unit: '%',
        trend: weightGain > 0 ? 'up' : 'stable',
        metric: 'more',
        icon: 'trending-up'
      },
      {
        key: 'heightGain',
        label: 'Height Gain',
        avg: heightGain,
        unit: '%',
        trend: heightGain > 0 ? 'up' : 'stable',
        metric: 'more',
        icon: 'trending-up'
      }
    ],
    percentiles: {
      weight: getPercentile(latestMeasurement.weight, ageMonths, sex, 'weight', childData),
      height: getPercentile(latestMeasurement.height, ageMonths, sex, 'height', childData)
    }
  };
};

const processSleepTimeOfDay = () => {
  const timeData = [];
  
  sleepData.forEach(log => {
    const logDate = log.timestamp.toDate();
    const hour = logDate.getHours();
    const day = logDate.toLocaleDateString('en-US', { weekday: 'short' });
    
    timeData.push({ hour, count: 1, day });
  });
  
  // Aggregate by hour
  const hourCounts = {};
  timeData.forEach(({ hour }) => {
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  return Object.entries(hourCounts).map(([hour, count]) => ({
    hour: parseInt(hour),
    count
  }));
};

const processFeedingTimeOfDay = () => {
  const timeData = [];
  
  feedingData.forEach(log => {
    const logDate = log.timestamp.toDate();
    const hour = logDate.getHours();
    const day = logDate.toLocaleDateString('en-US', { weekday: 'short' });
    
    timeData.push({ hour, count: 1, day });
  });
  
  const hourCounts = {};
  timeData.forEach(({ hour }) => {
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  return Object.entries(hourCounts).map(([hour, count]) => ({
    hour: parseInt(hour),
    count
  }));
};

const processDiaperTimeOfDay = () => {
  const timeData = [];
  
  diaperData.forEach(log => {
    const logDate = log.time.toDate();
    const hour = logDate.getHours();
    const day = logDate.toLocaleDateString('en-US', { weekday: 'short' });
    
    timeData.push({ hour, count: 1, day });
  });
  
  const hourCounts = {};
  timeData.forEach(({ hour }) => {
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  return Object.entries(hourCounts).map(([hour, count]) => ({
    hour: parseInt(hour),
    count
  }));
};

  // Get chart data based on active tab
  const getChartData = () => {
    switch (activeTab) {
      case 'Sleep':
        return processSleepData();
      case 'Diaper':
        return processDiaperData();
      case 'Feeding':
        return processFeedingData();
      default:
        return { labels: [], datasets: [] };
    }
  };

  const getYAxisLabel = () => {
    switch (activeTab) {
      case 'Sleep':
        return 'hrs';
      case 'Diaper':
        return '';
      case 'Feeding':
        return '';
      default:
        return '';
    }
  };

  // Utility function to determine trend color
  const getTrendColor = (trend, metric) => {
    if (trend === 'stable') return '#888';
    
    // For metrics where more is better
    if (metric === 'more') {
      return trend === 'up' ? '#4CAF50' : '#F44336';
    }
    
    // For metrics where less is better
    if (metric === 'less') {
      return trend === 'down' ? '#4CAF50' : '#F44336';
    }
    
    // For metrics where stability is best
    return '#888';
  };

  const handleExport = async (options) => {
  if (options.format === 'pdf') {
    await exportReportAsPDF(options);
  } else {
    await exportReportAsExcel(options);
  }
};

const exportReportAsPDF = async (options) => {
  try {
    const date = new Date().toLocaleDateString();
    const { timeRange, categories, includeAI, aiSummaries } = options;
    
    // Filter data based on selected categories
    const selectedSleepData = categories.sleep ? sleepData : [];
    const selectedFeedingData = categories.feeding ? feedingData : [];
    const selectedDiaperData = categories.diaper ? diaperData : [];
    
    // Generate summary statistics only for selected categories
    const sleepStats = categories.sleep && sleepData.length > 0 ? {
      total: sleepData.length,
      avgDuration: (sleepData.reduce((sum, s) => sum + (s.duration || 0), 0) / sleepData.length / 60).toFixed(1)
    } : null;
    
    const feedingStats = categories.feeding ? {
      total: feedingData.length,
      avgGap: calculateFeedingGap(feedingData)
    } : null;
    
    const diaperStats = categories.diaper ? {
      total: diaperData.length,
      avgPerDay: (diaperData.length / (timeRange === 'weekly' ? 7 : timeRange === 'monthly' ? 30 : 365)).toFixed(1)
    } : null;

    // Build HTML content
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
              margin-bottom: 10px;
            }
            .header-info {
              text-align: center;
              color: #666;
              margin-bottom: 30px;
              font-size: 14px;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(${[sleepStats, feedingStats, diaperStats].filter(Boolean).length}, 1fr);
              gap: 20px;
              margin: 30px 0;
            }
            .stat-card {
              background: #f5f5f5;
              padding: 15px;
              border-radius: 8px;
              border-left: 4px solid #1976d2;
            }
            .stat-title {
              font-size: 14px;
              color: #666;
              margin-bottom: 5px;
            }
            .stat-value {
              font-size: 24px;
              font-weight: bold;
              color: #1976d2;
            }
            .stat-subtitle {
              font-size: 12px;
              color: #888;
              margin-top: 5px;
            }
            .ai-insights-section {
              background: #e3f2fd;
              border-left: 4px solid #1976d2;
              padding: 20px;
              margin: 30px 0;
              border-radius: 8px;
              page-break-inside: avoid;
            }
            .ai-insights-header {
              display: flex;
              align-items: center;
              margin-bottom: 15px;
            }
            .ai-insights-title {
              font-size: 18px;
              font-weight: bold;
              color: #1976d2;
              margin: 0;
            }
            .ai-badge {
              background: #1976d2;
              color: white;
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 10px;
              margin-left: 10px;
              font-weight: 600;
            }
            .ai-content {
              background: white;
              padding: 15px;
              border-radius: 6px;
              margin-top: 10px;
              line-height: 1.6;
              font-size: 13px;
            }
            .ai-category {
              margin-bottom: 20px;
            }
            .ai-category-title {
              font-weight: bold;
              color: #1976d2;
              font-size: 14px;
              margin-bottom: 8px;
              display: flex;
              align-items: center;
            }
            .ai-category-icon {
              margin-right: 8px;
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
              padding-bottom: 5px;
              margin-bottom: 15px;
            }
            .entry { 
              margin: 8px 0; 
              font-size: 13px; 
              color: #555;
              padding-left: 20px;
              border-left: 2px solid #e0e0e0;
            }
            .timestamp {
              color: #888;
              font-size: 11px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              text-align: center;
              color: #888;
              font-size: 12px;
            }
            .disclaimer {
              background: #fff9c4;
              padding: 12px;
              border-radius: 6px;
              border-left: 3px solid #ffc107;
              margin-top: 15px;
              font-size: 11px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <h1>${name || "Child"}'s ${timeRange.charAt(0).toUpperCase() + timeRange.slice(1)} Report</h1>
          <div class="header-info">
            Generated on ${date}
            ${includeAI ? '<br><span style="color: #1976d2; font-weight: 600;">✨ Includes AI-Powered Insights</span>' : ''}
          </div>
    `;

    // Add stats grid if any categories selected
    if (sleepStats || feedingStats || diaperStats) {
      htmlContent += '<div class="stats-grid">';
      
      if (sleepStats) {
        htmlContent += `
          <div class="stat-card">
            <div class="stat-title">🌙 Total Sleep Sessions</div>
            <div class="stat-value">${sleepStats.total}</div>
            <div class="stat-subtitle">Avg. ${sleepStats.avgDuration}hrs per session</div>
          </div>
        `;
      }
      
      if (feedingStats) {
        htmlContent += `
          <div class="stat-card">
            <div class="stat-title">🍼 Total Feedings</div>
            <div class="stat-value">${feedingStats.total}</div>
            <div class="stat-subtitle">Avg. ${feedingStats.avgGap}hrs apart</div>
          </div>
        `;
      }
      
      if (diaperStats) {
        htmlContent += `
          <div class="stat-card">
            <div class="stat-title">💧 Diaper Changes</div>
            <div class="stat-value">${diaperStats.total}</div>
            <div class="stat-subtitle">${diaperStats.avgPerDay}/day average</div>
          </div>
        `;
      }
      
      htmlContent += '</div>';
    }

    // Add AI Insights Section
    if (includeAI && aiSummaries) {
      htmlContent += `
        <div class="ai-insights-section">
          <div class="ai-insights-header">
            <h2 class="ai-insights-title">✨ AI-Powered Insights</h2>
            <span class="ai-badge">GPT-4</span>
          </div>
      `;

      // Overall Summary
      if (aiSummaries.overall) {
        htmlContent += `
          <div class="ai-category">
            <div class="ai-category-title">
              <span class="ai-category-icon">📊</span>
              Overall Summary
            </div>
            <div class="ai-content">
              ${formatAIContentForPDF(aiSummaries.overall)}
            </div>
          </div>
        `;
      }

      // Category-specific insights
      if (categories.sleep && aiSummaries.sleep) {
        htmlContent += `
          <div class="ai-category">
            <div class="ai-category-title">
              <span class="ai-category-icon">🌙</span>
              Sleep Analysis
            </div>
            <div class="ai-content">
              ${formatAIContentForPDF(aiSummaries.sleep)}
            </div>
          </div>
        `;
      }

      if (categories.feeding && aiSummaries.feeding) {
        htmlContent += `
          <div class="ai-category">
            <div class="ai-category-title">
              <span class="ai-category-icon">🍼</span>
              Feeding Analysis
            </div>
            <div class="ai-content">
              ${formatAIContentForPDF(aiSummaries.feeding)}
            </div>
          </div>
        `;
      }

      if (categories.diaper && aiSummaries.diaper) {
        htmlContent += `
          <div class="ai-category">
            <div class="ai-category-title">
              <span class="ai-category-icon">💧</span>
              Diaper Pattern Analysis
            </div>
            <div class="ai-content">
              ${formatAIContentForPDF(aiSummaries.diaper)}
            </div>
          </div>
        `;
      }

      htmlContent += `
          <div class="disclaimer">
            <strong>Note:</strong> AI insights are generated by GPT-4 and are meant to provide general guidance. 
            They are not a substitute for professional medical advice. Always consult your pediatrician for 
            specific health concerns.
          </div>
        </div>
      `;
    }

    // Add data sections
    if (categories.sleep && selectedSleepData.length > 0) {
      htmlContent += `
        <div class="section">
          <div class="section-title">🌙 Sleep Logs</div>
          ${selectedSleepData.slice(0, 30).map(log => `
            <div class="entry">
              <div class="timestamp">${new Date(log.timestamp.toDate()).toLocaleString()}</div>
              Duration: ${(log.duration / 60).toFixed(1)} hours
            </div>
          `).join('')}
          ${selectedSleepData.length > 30 ? `<div class="entry">... and ${selectedSleepData.length - 30} more entries</div>` : ''}
        </div>
      `;
    }

    if (categories.feeding && selectedFeedingData.length > 0) {
      htmlContent += `
        <div class="section">
          <div class="section-title">🍼 Feeding Logs</div>
          ${selectedFeedingData.slice(0, 30).map(log => `
            <div class="entry">
              <div class="timestamp">${new Date(log.timestamp.toDate()).toLocaleString()}</div>
              ${log.amount || '?'}${log.amountUnit || 'ml'} (${log.feedType || 'N/A'})
            </div>
          `).join('')}
          ${selectedFeedingData.length > 30 ? `<div class="entry">... and ${selectedFeedingData.length - 30} more entries</div>` : ''}
        </div>
      `;
    }

    if (categories.diaper && selectedDiaperData.length > 0) {
      htmlContent += `
        <div class="section">
          <div class="section-title">💧 Diaper Logs</div>
          ${selectedDiaperData.slice(0, 30).map(log => `
            <div class="entry">
              <div class="timestamp">${new Date(log.time.toDate()).toLocaleString()}</div>
              ${log.stoolType || 'Unknown'}
            </div>
          `).join('')}
          ${selectedDiaperData.length > 30 ? `<div class="entry">... and ${selectedDiaperData.length - 30} more entries</div>` : ''}
        </div>
      `;
    }

    htmlContent += `
          <div class="footer">
            Report generated by Baby Tracker App
            ${includeAI ? '<br>AI insights powered by OpenAI GPT-4' : ''}
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

// Helper function to format AI content for PDF
const formatAIContentForPDF = (content) => {
  if (!content) return '';
  
  // Remove markdown formatting and convert to HTML
  let formatted = content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\n\n/g, '</p><p>') // Paragraphs
    .replace(/^- /gm, '• ') // Bullets
    .replace(/^\d+\. /gm, '<br>$&') // Numbered lists
    .replace(/\n/g, '<br>'); // Line breaks
  
  return `<p>${formatted}</p>`;
};

const exportReportAsExcel = async (options) => {
  try {
    const { timeRange, categories, includeAI, aiSummaries } = options;
    
    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet (Always included)
    const summaryData = [
      [`${name || 'Child'}'s ${timeRange.charAt(0).toUpperCase() + timeRange.slice(1)} Report`],
      [`Generated: ${new Date().toLocaleString()}`],
      [''],
      ['Category', 'Total Entries', 'Key Metrics'],
    ];

    if (categories.sleep) {
      const avgDuration = sleepData.length > 0 
        ? (sleepData.reduce((sum, s) => sum + (s.duration || 0), 0) / sleepData.length / 60).toFixed(1)
        : 0;
      summaryData.push(['Sleep', sleepData.length, `Avg: ${avgDuration}hrs/session`]);
    }

    if (categories.feeding) {
      const avgGap = calculateFeedingGap(feedingData);
      summaryData.push(['Feeding', feedingData.length, `Avg gap: ${avgGap}hrs`]);
    }

    if (categories.diaper) {
      const avgPerDay = (diaperData.length / (timeRange === 'weekly' ? 7 : timeRange === 'monthly' ? 30 : 365)).toFixed(1);
      summaryData.push(['Diaper', diaperData.length, `${avgPerDay}/day`]);
    }

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    // 2. AI Insights Sheet (if enabled)
    if (includeAI && aiSummaries) {
      const aiData = [
        ['AI-Powered Insights'],
        [`Generated by GPT-4 on ${new Date().toLocaleDateString()}`],
        [''],
        ['⚠️ Note: AI insights are for general guidance only. Consult your pediatrician for medical advice.'],
        [''],
      ];

      // Overall Summary
      if (aiSummaries.overall) {
        aiData.push(['Overall Summary'], ['']);
        const cleanedOverall = cleanAIContentForExcel(aiSummaries.overall);
        cleanedOverall.forEach(line => aiData.push([line]));
        aiData.push(['']);
      }

      // Sleep Analysis
      if (categories.sleep && aiSummaries.sleep) {
        aiData.push(['🌙 Sleep Analysis'], ['']);
        const cleanedSleep = cleanAIContentForExcel(aiSummaries.sleep);
        cleanedSleep.forEach(line => aiData.push([line]));
        aiData.push(['']);
      }

      // Feeding Analysis
      if (categories.feeding && aiSummaries.feeding) {
        aiData.push(['🍼 Feeding Analysis'], ['']);
        const cleanedFeeding = cleanAIContentForExcel(aiSummaries.feeding);
        cleanedFeeding.forEach(line => aiData.push([line]));
        aiData.push(['']);
      }

      // Diaper Analysis
      if (categories.diaper && aiSummaries.diaper) {
        aiData.push(['💧 Diaper Analysis'], ['']);
        const cleanedDiaper = cleanAIContentForExcel(aiSummaries.diaper);
        cleanedDiaper.forEach(line => aiData.push([line]));
        aiData.push(['']);
      }

      const aiSheet = XLSX.utils.aoa_to_sheet(aiData);
      aiSheet['!cols'] = [{ wch: 100 }];
      
      // Apply text wrapping to all cells
      const range = XLSX.utils.decode_range(aiSheet['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
          if (!aiSheet[cell_address]) continue;
          if (!aiSheet[cell_address].s) aiSheet[cell_address].s = {};
          aiSheet[cell_address].s.alignment = { wrapText: true, vertical: 'top' };
        }
      }
      
      XLSX.utils.book_append_sheet(wb, aiSheet, "AI Insights");
    }

    // 3. Feeding Sheet (if included)
    if (categories.feeding && feedingData.length > 0) {
      const feedingSheetData = [
        ["Timestamp", "Amount", "Unit", "Type"],
        ...feedingData.map(log => [
          new Date(log.timestamp.toDate()).toLocaleString(),
          log.amount || '?',
          log.amountUnit || 'ml',
          log.feedType || 'N/A',
        ])
      ];
      const feedingSheet = XLSX.utils.aoa_to_sheet(feedingSheetData);
      feedingSheet['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 8 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, feedingSheet, "Feeding Data");
    }

    // 4. Sleep Sheet (if included)
    if (categories.sleep && sleepData.length > 0) {
      const sleepSheetData = [
        ["Timestamp", "Duration (mins)", "Duration (hrs)"],
        ...sleepData.map(log => [
          new Date(log.timestamp.toDate()).toLocaleString(),
          log.duration || '?',
          log.duration ? (log.duration / 60).toFixed(1) : '?'
        ])
      ];
      const sleepSheet = XLSX.utils.aoa_to_sheet(sleepSheetData);
      sleepSheet['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, sleepSheet, "Sleep Data");
    }

    // 5. Diaper Sheet (if included)
    if (categories.diaper && diaperData.length > 0) {
      const diaperSheetData = [
        ["Timestamp", "Stool Type"],
        ...diaperData.map(log => [
          new Date(log.time.toDate()).toLocaleString(),
          log.stoolType || 'Unknown'
        ])
      ];
      const diaperSheet = XLSX.utils.aoa_to_sheet(diaperSheetData);
      diaperSheet['!cols'] = [{ wch: 22 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, diaperSheet, "Diaper Data");
    }

    // Write and share
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const fileName = `${name || 'Child'}_${timeRange}_Report${includeAI ? '_AI' : ''}.xlsx`;
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

// Helper function to clean AI content for Excel
const cleanAIContentForExcel = (content) => {
  if (!content) return [];
  
  // Remove markdown and split into lines
  const cleaned = content
    .replace(/\*\*/g, '') // Remove bold markers
    .replace(/^#{1,6}\s+/gm, '') // Remove headers
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  return cleaned;
};
  
  

  // Handle data point selection
  const handleDataPointClick = (data) => {
    const { value, index, dataset } = data;
    const labels = getTimeRange().periodLabels;
    const label = labels[index] || 'Unknown';
    
    Alert.alert(
      `Data for ${label}`,
      `Value: ${value.toFixed(1)}${getYAxisLabel()}\nDataset: ${dataset.legend || 'Data'}`,
      [{ text: 'OK' }]
    );
  };

  // Feeding summary cards helper
  const renderFeedingSummary = (summary) => (
    <View style={styles.summaryCardsContainer}>
      {summary.map((item) => {
        let displayValue = '';
        switch (item.key) {
          case 'totalFeedings':
            displayValue = `${item.value} feedings`;
            break;
          case 'averageGap':
            const hours = Math.floor(item.value / 60);
            const minutes = Math.floor(item.value % 60);
            displayValue = `${hours}h ${minutes}m gap`;
            break;
          case 'mostCommonTime':
            if (item.value !== null) {
              const ampm = item.value >= 12 ? 'PM' : 'AM';
              const hour12 = item.value % 12 || 12;
              displayValue = `${hour12} ${ampm}`;
            } else {
              displayValue = 'N/A';
            }
            break;
          case 'mostUsedMethod':
            displayValue = item.value || 'N/A';
            break;
          default:
            displayValue = item.value;
        }
        return (
          <View key={item.key} style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              {formatSummaryTitle(item.key)}
            </Text>
            <Text style={styles.summaryValue}>{displayValue}</Text>
          </View>
        );
      })}
    </View>
  );

  // Feeding summary card titles
  const formatSummaryTitle = (key) => {
    switch (key) {
      case 'totalFeedings':
        return 'Total Feedings';
      case 'averageGap':
        return 'Avg. Time Between Feedings';
      case 'mostCommonTime':
        return 'Most Common Feeding Time';
      case 'mostUsedMethod':
        return 'Most Common Food Type';
      default:
        return key;
    }
  };

  const DataQualityBadge = ({ dataCount, daysInRange }) => {
  const expectedCount = daysInRange * 2; // Assuming 2+ entries per day is good
  const quality = dataCount >= expectedCount ? 'excellent' : 
                  dataCount >= expectedCount * 0.7 ? 'good' : 
                  dataCount >= expectedCount * 0.4 ? 'fair' : 'limited';
  
  const colors = {
    excellent: '#4CAF50',
    good: '#8BC34A',
    fair: '#FF9800',
    limited: '#F44336'
  };
  
  return (
    <View style={[styles.qualityBadge, { backgroundColor: colors[quality] + '20' }]}>
      <View style={[styles.qualityDot, { backgroundColor: colors[quality] }]} />
      <Text style={[styles.qualityText, { color: colors[quality] }]}>
        {dataCount} entries â€¢ {quality} data quality
      </Text>
    </View>
  );
};

  const TrendIndicator = ({ data, metric }) => {
  const trend = calculateDetailedTrend(data);
  
  return (
    <View style={styles.trendIndicatorBar}>
      <View style={styles.trendLeft}>
        <Ionicons 
          name={trend.direction === 'up' ? 'trending-up' : trend.direction === 'down' ? 'trending-down' : 'remove'} 
          size={20} 
          color={trend.color} 
        />
        <Text style={[styles.trendText, { color: trend.color }]}>
          {trend.percentage > 0 ? '+' : ''}{trend.percentage}%
        </Text>
      </View>
      <Text style={styles.trendDescription}>{trend.message}</Text>
    </View>
  );
};

const calculateDetailedTrend = (data) => {
  if (data.length < 4) return { direction: 'stable', percentage: 0, color: '#888', message: 'Not enough data' };
  
  const recent = data.slice(-3).filter(v => v > 0);
  const previous = data.slice(-6, -3).filter(v => v > 0);
  
  if (recent.length === 0 || previous.length === 0) 
    return { direction: 'stable', percentage: 0, color: '#888', message: 'Insufficient data' };
  
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
  const change = ((recentAvg - previousAvg) / previousAvg) * 100;
  
  let direction, color, message;
  if (Math.abs(change) < 5) {
    direction = 'stable';
    color = '#888';
    message = 'Stable pattern';
  } else if (change > 0) {
    direction = 'up';
    color = '#4CAF50';
    message = `Improving trend`;
  } else {
    direction = 'down';
    color = '#FF9800';
    message = `Declining trend`;
  }
  
  return { direction, percentage: Math.round(change), color, message };
};
  
  // Render charts based on tab
const renderCharts = () => {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>Loading report data...</Text>
      </View>
    );
  }

    const data = getChartData();
    const totalDataCount = sleepData.length + feedingData.length + diaperData.length;
  
    // DEBUG: Log data structure
    console.log('Active Tab:', activeTab);
    console.log('Chart Data:', JSON.stringify({
      hasData: !!data,
      hasLineData: !!data?.lineData,
      hasDatasets: !!data?.lineData?.datasets,
      datasetsLength: data?.lineData?.datasets?.length,
      hasLegend: !!data?.lineData?.legend,
      legendLength: data?.lineData?.legend?.length
    }));

  try {
    const data = getChartData();
    
    if (!data) {
      return (
        <View style={styles.noDataContainer}>
          <Ionicons name="analytics-outline" size={40} color={darkMode ? '#555' : '#ccc'} />
          <Text style={[styles.noDataText, { color: darkMode ? '#aaa' : '#666' }]}>
            No data available
          </Text>
        </View>
      );
    }
    
    const chartType = getChartType(activeTab);
    const yLabel = getYAxisLabel();

  return (
    <>
      {/* Data Sufficiency Warning */}
      <DataSufficiencyWarning 
        reportRange={reportRange}
        childAge={childData?.age}
        dataCount={totalDataCount}
        darkMode={darkMode}
      />
      {/* MAIN CHART CONTAINER */}
      <View
        style={[
          styles.chartContainer,
          {
            backgroundColor: darkMode ? '#1f1f1f' : '#fff',
            borderColor: darkMode ? '#333' : '#e0e0e0',
          },
        ]}
      >
      {/* TYPE-SPECIFIC SUMMARY SECTIONS */}
      {activeTab === 'Sleep' && data && (
        <SleepMetricsSummary 
          data={data} 
          darkMode={darkMode}
          theme={theme}
        />
      )}

      {activeTab === 'Feeding' && data && (
        <FeedingMetricsSummary 
          data={data}
          darkMode={darkMode}
          theme={theme}
        />
      )}

      {activeTab === 'Diaper' && data && (
        <DiaperMetricsSummary
          data={data}
          wetPerDay={parseFloat(data.summary?.find(s => s.key === 'wet')?.avg || 0)}
          bmPerDay={parseFloat(data.summary?.find(s => s.key === 'bm')?.avg || 0)}
          darkMode={darkMode}
          theme={theme}
        />
      )}

      {/* LINE CHART */}
      {chartType === 'line' && data.lineData && data.lineData.datasets && (
        <>
          <Text style={[styles.chartTitle, { color: theme.textPrimary }]}>
            {activeTab === 'Sleep' ? 'Daily Sleep Duration' : 
            activeTab === 'Feeding' ? 'Feeding Frequency' : 
            'Activity Tracking'}
          </Text>
          <LineChart
            data={data.lineData}
            width={adjustedWidth}
            height={220}
            yAxisLabel=""
            yAxisSuffix={yLabel}
            fromZero
            chartConfig={{
              ...chartConfig,
              paddingLeft: 40,
            }}
            bezier
            style={styles.chart}
            withInnerLines
            withOuterLines
            withVerticalLines={false}
            withHorizontalLines
            withDots
            onDataPointClick={handleDataPointClick}
          />
        </>
      )}

      {activeTab === 'Feeding' && feedingData.length > 0 && (
        <View style={[
          styles.chartContainer,
          {
            backgroundColor: darkMode ? '#1f1f1f' : '#fff',
            borderColor: darkMode ? '#333' : '#e0e0e0',
          },
        ]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Feeding Type Distribution
          </Text>
          <FeedingBreakdownPieChart 
            feedingData={feedingData}
            darkMode={darkMode}
            theme={theme}
            hasAIConsent={hasAIConsent}
          />
        </View>
      )}

        {/* STACKED BAR CHART */}
        {chartType === 'bar' && activeTab === 'Diaper' && data.series && (
          <>
            <Text style={[styles.chartTitle, { color: theme.textPrimary }]}>
              Diaper Change Distribution
            </Text>
            <StackedBarChart
              series={data.series}
              categories={data.options?.xaxis?.categories || []}
              height={300}
            />
          </>
        )}

        {/* HEATMAPS - CONDITIONALLY RENDERED PER TAB */}
        {activeTab === 'Sleep' && sleepData.length > 0 && (
          <View style={styles.additionalChartContainer}>
            <TimeOfDayHeatmap
              data={processSleepTimeOfDay()}
              title={`Sleep Start Times \n`}
              color="#1976d2"
              darkMode={darkMode}
            />
          </View>
        )}

        {activeTab === 'Feeding' && feedingData.length > 0 && (
          <View style={styles.additionalChartContainer}>
            <TimeOfDayHeatmap
              data={processFeedingTimeOfDay()}
              title={`Feeding Times \n`}
              color="#FF9800"
              darkMode={darkMode}
            />
          </View>
        )}

        {activeTab === 'Diaper' && diaperData.length > 0 && (
          <View style={[
            styles.additionalChartContainer,
            { backgroundColor: darkMode ? '#1f1f1f' : '#f5f5f5' }
          ]}>
            <TimeOfDayHeatmap
              data={processDiaperTimeOfDay()}
              title={`Diaper Change Times \n`}
              color={darkMode ? '#4DD0E1' : '#00BCD4'}
              darkMode={darkMode}
              theme={theme}
            />
          </View>
        )}
      </View>

    {/* PIE CHART & INTERACTIVE LEGEND - ONLY FOR SLEEP TAB */}
    {activeTab === 'Sleep' && data.breakdown && (
      <View style={[
        styles.chartContainer,
        {
          backgroundColor: darkMode ? '#1f1f1f' : '#fff',
          borderColor: darkMode ? '#333' : '#e0e0e0',
        },
      ]}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Sleep Duration Distribution
        </Text>

      {/* SLEEP DURATION SUMMARY */}
      {/* <View style={styles.sleepDurationSummary}>
        <View style={[styles.sleepDurationCard, { backgroundColor: darkMode ? '#2a2a2a' : '#E3F2FD' }]}>
          <Ionicons name="moon" size={20} color="#1976d2" />
          <Text style={[styles.sleepDurationLabel, { color: theme.textPrimary }]}>
            Night Sleep
          </Text>
          <Text style={[styles.sleepDurationValue, { color: theme.textPrimary }]}>
            {(() => {
              if (!data.breakdown.night || data.breakdown.night.length === 0) return '0hrs';
              const filtered = data.breakdown.night.filter(v => v > 0);
              if (filtered.length === 0) return '0hrs';
              const avg = filtered.reduce((a, b) => a + b, 0) / filtered.length;
              return isNaN(avg) ? '0hrs' : `${avg.toFixed(1)}hrs`;
            })()}
          </Text>
        </View>
        
        <View style={[styles.sleepDurationCard, { backgroundColor: darkMode ? '#2a2a2a' : '#FFF9C4' }]}>
          <Ionicons name="partly-sunny" size={20} color="#FF9800" />
          <Text style={[styles.sleepDurationLabel, { color: theme.textPrimary }]}>
            Daytime Naps
          </Text>
          <Text style={[styles.sleepDurationValue, { color: theme.textPrimary }]}>
            {(() => {
              if (!data.breakdown.naps || data.breakdown.naps.length === 0) return '0hrs';
              const filtered = data.breakdown.naps.filter(v => v > 0);
              if (filtered.length === 0) return '0hrs';
              const avg = filtered.reduce((a, b) => a + b, 0) / filtered.length;
              return isNaN(avg) ? '0hrs' : `${avg.toFixed(1)}hrs`;
            })()}
          </Text>
        </View>
      </View> */}
        
      {(() => {
        const totalNightHours = data.breakdown.night.reduce((a, b) => a + b, 0);
        const totalNapHours = data.breakdown.naps.reduce((a, b) => a + b, 0);
        const totalSleepHours = totalNightHours + totalNapHours;
        
        if (totalSleepHours === 0) {
          return (
            <Text style={[styles.noDataText, { color: theme.textSecondary, textAlign: 'center', marginVertical: 20 }]}>
              No sleep data available for pie chart
            </Text>
          );
        }
        
        const pieData = [
          {
            name: 'Night Sleep',
            hours: Math.round(totalNightHours),
            color: '#1976d2',
            legendFontColor: darkMode ? '#ddd' : '#333',
            legendFontSize: 12
          },
          {
            name: 'Daytime Naps',
            hours: Math.round(totalNapHours),
            color: '#FF9800',
            legendFontColor: darkMode ? '#ddd' : '#333',
            legendFontSize: 12
          }
        ].filter(item => item.hours > 0);
        
        return (
          <>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <PieChart
                data={pieData}
                width={adjustedWidth}
                height={220}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => darkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="hours"
                backgroundColor="transparent"
                paddingLeft="15"
                center={[adjustedWidth / 4, 0]} // Center the pie chart
                absolute
                hasLegend={false}
              />
            </View>
            
            {/* Enhanced legend with detailed info */}
            <View style={styles.interactiveLegendContainer}>
              <Text style={[styles.legendTitle, { color: theme.textSecondary }]}>
                Tap to view detailed breakdown
              </Text>
              <View style={styles.legendGrid}>
                {pieData.map((item, index) => {
                  const percentage = Math.round((item.hours / totalSleepHours) * 100);
                  const daysInPeriod = reportRange === 'Weekly' ? 7 : reportRange === 'Monthly' ? 30 : 365;
                  const avgPerPeriod = (item.hours / daysInPeriod).toFixed(1);
                  
                  return (
                    <TouchableOpacity 
                      key={index}
                      style={[styles.legendItemCard, { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }]}
                      onPress={() => {
                        Alert.alert(
                          item.name,
                          `Total: ${item.hours}hrs over ${reportRange.toLowerCase()} period\nPercentage: ${percentage}%\nDaily Average: ${avgPerPeriod}hrs`,
                          [{ text: 'OK' }]
                        );
                      }}
                    >
                      <View style={[styles.legendColorDot, { backgroundColor: item.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.legendItemText, { color: theme.textPrimary }]}>
                          {item.name}
                        </Text>
                        <Text style={[styles.legendItemCount, { color: theme.textSecondary, fontSize: 10 }]}>
                          {item.hours}hrs ({percentage}%) • {avgPerPeriod}hrs/day
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        );
      })()}
      </View>
    )}
    {activeTab === 'Feeding' && feedingData.some(log => log.weaningMode) && (
      <WeaningProgressCard 
        feedingData={feedingData}
        darkMode={darkMode}
        theme={theme}
      />
    )}
    </>
  );
  } catch (error) {
    console.error('Chart rendering error:', error);
    return (
      <View style={styles.noDataContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#F44336" />
        <Text style={[styles.noDataText, { color: darkMode ? '#aaa' : '#666' }]}>
          Error loading chart data
        </Text>
      </View>
    );
  }
};

  return (
    <LinearGradient 
      colors={darkMode ? ['#0f2027', '#05090b'] : ['#B2EBF2', '#FCE4EC']} 
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={darkMode ? ['#1f1f1f', '#2c2c2c'] : ['#F8FBFF', '#EEF4FF']}
            style={styles.headerButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <ArrowLeft size={20} color={darkMode ? '#fff' : '#2E3A59'} />
          </LinearGradient>
        </TouchableOpacity>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/logo.png')} 
            style={styles.logo}
          />
        </View>
        <View style={styles.headerRightSpace} />
      </View>

      <Text style={[styles.title, { color: theme.textPrimary }]}>{`${name || 'Child'}'s Reports`}</Text>

      {/* Time period toggle - now includes Overview */}
      <View style={[styles.toggleContainer, { backgroundColor: darkMode ? '#2c2c2c' : '#f0f0f0' }]}>
        <TouchableOpacity
          style={[styles.toggleButton, reportRange === 'Overview' && [styles.activeToggle, { backgroundColor: darkMode ? '#444' : '#fff' }]]}
          onPress={() => setReportRange('Overview')}
        >
          <Text style={[styles.toggleText, reportRange === 'Overview' && { color: theme.textPrimary }]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, reportRange === 'Weekly' && [styles.activeToggle, { backgroundColor: darkMode ? '#444' : '#fff' }]]}
          onPress={() => setReportRange('Weekly')}
        >
          <Text style={[styles.toggleText, reportRange === 'Weekly' && { color: theme.textPrimary }]}>
            Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, reportRange === 'Monthly' && [styles.activeToggle, { backgroundColor: darkMode ? '#444' : '#fff' }]]}
          onPress={() => setReportRange('Monthly')}
        >
          <Text style={[styles.toggleText, reportRange === 'Monthly' && { color: theme.textPrimary }]}>
            Month
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, reportRange === 'Annual' && [styles.activeToggle, { backgroundColor: darkMode ? '#444' : '#fff' }]]}
          onPress={() => setReportRange('Annual')}
        >
          <Text style={[styles.toggleText, reportRange === 'Annual' && { color: theme.textPrimary }]}>
            Year
          </Text>
        </TouchableOpacity>
      </View>

      {reportRange !== 'Overview' && (
        <View style={[styles.tabContainer, { backgroundColor: darkMode ? '#2c2c2c' : '#fff' }]}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Sleep' && [styles.activeTab, { backgroundColor: darkMode ? '#3c3c3c' : '#E3F2FD' }]]}
            onPress={() => setActiveTab('Sleep')}
          >
            <Ionicons 
              name="bed-outline" 
              size={20} 
              color={activeTab === 'Sleep' ? '#1976d2' : theme.textSecondary} 
            />
            <Text style={[styles.tabText, activeTab === 'Sleep' && styles.activeTabText]}>
              Sleep
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Feeding' && [styles.activeTab, { backgroundColor: darkMode ? '#3c3c3c' : '#E3F2FD' }]]}
            onPress={() => setActiveTab('Feeding')}
          >
            <Ionicons 
              name="restaurant-outline" 
              size={20} 
              color={activeTab === 'Feeding' ? '#1976d2' : theme.textSecondary} 
            />
            <Text style={[styles.tabText, activeTab === 'Feeding' && styles.activeTabText]}>
              Feeding
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Diaper' && [styles.activeTab, { backgroundColor: darkMode ? '#3c3c3c' : '#E3F2FD' }]]}
            onPress={() => setActiveTab('Diaper')}
          >
            <Ionicons 
              name="water-outline" 
              size={20} 
              color={activeTab === 'Diaper' ? '#1976d2' : theme.textSecondary} 
            />
            <Text style={[styles.tabText, activeTab === 'Diaper' && styles.activeTabText]}>
              Diaper
            </Text>
          </TouchableOpacity>
          
          {/* NEW: Growth Tab */}
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Growth' && [styles.activeTab, { backgroundColor: darkMode ? '#3c3c3c' : '#E3F2FD' }]]}
            onPress={() => setActiveTab('Growth')}
          >
            <Ionicons 
              name="trending-up-outline" 
              size={20} 
              color={activeTab === 'Growth' ? '#1976d2' : theme.textSecondary} 
            />
            <Text style={[styles.tabText, activeTab === 'Growth' && styles.activeTabText]}>
              Growth
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        {/* Show Overview Tab or regular content */}
        {reportRange === 'Overview' ? (
          <OverviewTab
            childId={childId}
            name={name}
            darkMode={darkMode}
            theme={theme}
            sleepData={sleepData}
            feedingData={feedingData}
            diaperData={diaperData}
            childData={childData}
            AIPoweredSummary={AIPoweredSummary}
            navigation={navigation}
            aiRefreshKey={aiRefreshKey}
            forceAIRefresh={forceAIRefresh}
          />
        ) : (
          <>
            {/* Weekly summary card */}
            {childId && !isLoading && childData && (
              <AIPoweredSummary 
                childId={childId} 
                childAge={childData.age} 
                childWeight={childData.weight} 
                childHeight={childData.height}
                sleepData={sleepData || []}
                feedingData={feedingData || []}
                diaperData={diaperData || []}
                reportRange={reportRange}
                activeTab={activeTab}
                darkMode={darkMode}
                theme={theme}
              />
            )}
            {renderCharts()}
          </>
        )}
      </ScrollView>
      

{reportRange !== 'Overview' && (
  <>
    <ExportReportSection 
      exportReportAsPDF={exportReportAsPDF} 
      exportReportAsExcel={exportReportAsExcel}
      darkMode={darkMode}
      theme={theme}
      hasAIConsent={hasAIConsent}
      onOpenExportModal={() => setShowExportModal(true)}
    />
    
    <ExportOptionsModal
      visible={showExportModal}
      onClose={() => setShowExportModal(false)}
      onExport={handleExport}
      darkMode={darkMode}
      theme={theme}
      hasAIConsent={hasAIConsent}
      aiSummaries={currentAISummaries}
    />
  </>
)}
      </SafeAreaView>
    </LinearGradient>
  );
};

const ExportReportSection = ({ 
  exportReportAsPDF, 
  exportReportAsExcel,
  darkMode,
  theme,
  hasAIConsent,
  onOpenExportModal 
}) => {
  return (
    <View style={[
      styles.exportContainer,
      {
        backgroundColor: darkMode ? '#1f1f1f' : '#fff',
        borderColor: darkMode ? '#333' : '#e0e0e0'
      }
    ]}>
      <View style={styles.exportHeader}>
        <View>
          <Text style={[styles.exportTitle, { color: theme.textPrimary }]}>
            Export Report
          </Text>
          <Text style={[styles.exportSubtitle, { color: theme.textSecondary }]}>
            Choose what to include in your report
          </Text>
        </View>
        {hasAIConsent && (
          <View style={[styles.aiEnabledBadge, { backgroundColor: darkMode ? '#1a3a52' : '#E3F2FD' }]}>
            <Ionicons name="sparkles" size={14} color={darkMode ? '#64b5f6' : '#1976d2'} />
            <Text style={[styles.aiEnabledText, { color: darkMode ? '#64b5f6' : '#1976d2' }]}>
              AI Ready
            </Text>
          </View>
        )}
      </View>
      
      <TouchableOpacity
        style={[
          styles.exportMainButton,
          { backgroundColor: darkMode ? '#1a3a52' : '#1976d2' }
        ]}
        onPress={onOpenExportModal}
      >
        <Ionicons name="download-outline" size={20} color="#fff" />
        <Text style={styles.exportMainButtonText}>
          Customize & Export
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#fff" />
      </TouchableOpacity>
      
      <View style={styles.exportQuickActions}>
        <TouchableOpacity
          style={[
            styles.quickActionButton,
            { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }
          ]}
          onPress={() => exportReportAsPDF({
            format: 'pdf',
            timeRange: 'weekly',
            categories: { sleep: true, feeding: true, diaper: true },
            includeAI: false
          })}
        >
          <AntDesign name="file-pdf" size={16} color="#E53935" />
          <Text style={[styles.quickActionText, { color: theme.textPrimary }]}>
            Quick PDF
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.quickActionButton,
            { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }
          ]}
          onPress={() => exportReportAsExcel({
            format: 'excel',
            timeRange: 'weekly',
            categories: { sleep: true, feeding: true, diaper: true },
            includeAI: false
          })}
        >
          <FontAwesome5 name="file-excel" size={16} color="#2E7D32" />
          <Text style={[styles.quickActionText, { color: theme.textPrimary }]}>
            Quick Excel
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};



// Add insights component
const InsightsSection = ({ activeTab, data }) => {
  const getInsights = () => {
    switch (activeTab) {
      case 'Sleep':
        return [
          {
            icon: 'moon-outline',
            text: 'Your baby is averaging 10.5 hours of sleep daily, which is within the recommended range for their age.'
          },
          {
            icon: 'alarm-outline',
            text: 'Most common sleep time is 8 PM, establishing a consistent bedtime routine.'
          },
          {
            icon: 'trending-up-outline',
            text: 'Sleep duration has improved by 8% compared to last week.'
          }
        ];
      case 'Feeding':
        return [
          {
            icon: 'restaurant-outline',
            text: "Feeding frequency of 6 times per day is appropriate for your baby's age."
          },
          {
            icon: 'time-outline',
            text: 'Most feedings occur between 6 AM and 8 PM with consistent 3-hour intervals.'
          },
          {
            icon: 'nutrition-outline',
            text: 'Formula intake has been consistent throughout the week.'
          }
        ];
      case 'Diaper':
        return [
          {
            icon: 'water-outline',
            text: 'Your baby is having 6-8 wet diapers daily, indicating good hydration.'
          },
          {
            icon: 'calendar-outline',
            text: 'Bowel movements are averaging 2-3 per day, which is normal.'
          },
          {
            icon: 'alert-circle-outline',
            text: 'No unusual patterns detected in stool consistency or frequency.'
          }
        ];
      default:
        return [];
    }
  };

  const insights = getInsights();

  return (
    <View style={styles.insightsContainer}>
      <Text style={styles.insightTitle}>Smart Insights</Text>
      {insights.map((insight, index) => (
        <View key={index} style={[styles.insightItem, index === insights.length - 1 && { borderBottomWidth: 0 }]}>
          <View style={styles.insightIcon}>
            <Ionicons name={String(insight.icon)} size={16} color="#1976d2" />
          </View>
          <View style={styles.insightContent}>
            <Text style={styles.insightText}>{String(insight.text)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};



const styles = StyleSheet.create({
  metricsGridContainer: enhancedStyles.metricsGridContainer,
enhancedSummaryCard: enhancedStyles.enhancedSummaryCard,
cardTopRow: enhancedStyles.cardTopRow,
cardIconContainer: enhancedStyles.cardIconContainer,
cardLabelContainer: enhancedStyles.cardLabelContainer,
cardLabel: enhancedStyles.cardLabel,
trendPill: enhancedStyles.trendPill,
trendPillText: enhancedStyles.trendPillText,
cardValueSection: enhancedStyles.cardValueSection,
cardValue: enhancedStyles.cardValue,
benchmarkLabel: enhancedStyles.benchmarkLabel,
cardDetails: enhancedStyles.cardDetails,
metricsSummaryContainer: enhancedStyles.metricsSummaryContainer,
qualityStatusBanner: enhancedStyles.qualityStatusBanner,
qualityStatusText: enhancedStyles.qualityStatusText,
qualityStatusLabel: enhancedStyles.qualityStatusLabel,
qualityStatusDescription: enhancedStyles.qualityStatusDescription,
sleepBreakdownContainer: enhancedStyles.sleepBreakdownContainer,
sleepBreakdownItem: enhancedStyles.sleepBreakdownItem,
sleepBreakdownIcon: enhancedStyles.sleepBreakdownIcon,
sleepBreakdownInfo: enhancedStyles.sleepBreakdownInfo,
sleepBreakdownLabel: enhancedStyles.sleepBreakdownLabel,
sleepBreakdownValue: enhancedStyles.sleepBreakdownValue,
feedingDetailsContainer: {
  ...enhancedStyles.feedingDetailsContainer,
  borderRadius: 12,
  padding: 12,
  marginTop: 10,
},
feedingDetailRow: {
  ...enhancedStyles.feedingDetailRow,
  paddingVertical: 12,
  borderBottomWidth: 1,
},
feedingDetailLabel: enhancedStyles.feedingDetailLabel,
feedingDetailText: enhancedStyles.feedingDetailText,
feedingDetailValue: enhancedStyles.feedingDetailValue,
diaperStatusRow: enhancedStyles.diaperStatusRow,
diaperStatusCard: enhancedStyles.diaperStatusCard,
diaperCardHeader: enhancedStyles.diaperCardHeader,
diaperCardTitle: enhancedStyles.diaperCardTitle,
diaperStatusBadge: enhancedStyles.diaperStatusBadge,
diaperStatusValue: enhancedStyles.diaperStatusValue,
diaperStatusNote: enhancedStyles.diaperStatusNote,
diaperTotalContainer: enhancedStyles.diaperTotalContainer,
diaperTotalInfo: enhancedStyles.diaperTotalInfo,
diaperTotalLabel: enhancedStyles.diaperTotalLabel,
diaperTotalValue: enhancedStyles.diaperTotalValue,
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginTop: 15,
    marginBottom: 18,
    height: 44,
    paddingLeft: 14,
    paddingRight: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
   
  },
headerButton: {
  borderRadius: 16,
  overflow: 'hidden',
},
headerButtonGradient: {
  width: 44,
  height: 44,
  borderRadius: 16,
  justifyContent: 'center',
  alignItems: 'center',
},
backText: {
  color: '#1976d2',
  fontSize: 13,
  fontWeight: '500',
  marginLeft: 8,
},
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    marginLeft: 30,
  },
  headerRightSpace: {
    width: 80, 
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    padding: 3,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  activeToggle: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  toggleText: {
    color: '#666',
    fontWeight: '500',
  },
  activeToggleText: {
    color: '#1976d2',
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#E3F2FD',
  },
  tabText: {
    marginLeft: 5,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#1976d2',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 30,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
    summaryCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  summaryCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    padding: 12,
    width: '48%',
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 5,
  },
  trendIndicator: {
    marginLeft: 5,
  },
  summarySubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 3,
  },
  chart: {
    borderRadius: 10,
    marginVertical: 8,
  },
  legendContainer: {
    marginTop: 10,
    marginBottom: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    marginBottom: 5,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  dataLabelToggle: {
    alignSelf: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    marginTop: 5,
  },
  dataLabelText: {
    fontSize: 12,
    color: '#666',
  },
  additionalChartContainer: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#666',
    marginTop: 10,
    fontSize: 16,
  },
  noDataContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
  },
  addDataButton: {
    marginTop: 15,
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addDataButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  exportContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginTop: 10,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  exportOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    width: '48%',
    marginBottom: 10,
  },
  exportOptionIcon: {
    marginRight: 8,
  },
  exportOptionText: {
    fontSize: 14,
    color: '#333',
  },
  exportButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  // Insights section
  insightsContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginTop: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  insightIcon: {
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  insightContent: {
    flex: 1,
  },
  insightText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
aiSummaryContainer: {
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: 18,
  marginBottom: 15,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.12,
  shadowRadius: 5,
  elevation: 4,
  borderWidth: 1,
  borderColor: '#e8eaf6',
},
aiSummaryContainerCompact: {
  padding: 0,
  backgroundColor: 'transparent',
  shadowOpacity: 0,
  elevation: 0,
  borderWidth: 0,
  marginBottom: 0,
},
aiSummaryHeaderRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 15,
},
aiSummaryHeaderLeft: {
  flexDirection: 'row',
  alignItems: 'center',
},
aiIconBadge: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#1976d2',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
},
aiSummaryTitle: {
  fontSize: 18,
  fontWeight: '700',
  color: '#333',
},
aiSummarySubtitle: {
  fontSize: 11,
  color: '#999',
  marginTop: 2,
},
refreshIconButton: {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: '#f5f5f5',
  justifyContent: 'center',
  alignItems: 'center',
},
aiLoadingContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 10,
},
insightTabContainer: {
  flexDirection: 'row',
  backgroundColor: '#f5f5f5',
  borderRadius: 10,
  padding: 4,
  marginBottom: 15,
},
insightTab: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 10,
  paddingHorizontal: 8,
  borderRadius: 8,
  gap: 6,
},
activeInsightTab: {
  backgroundColor: '#fff',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  elevation: 2,
},
aiLoadingText: {
  marginLeft: 10,
  color: '#666',
  fontStyle: 'italic',
},
activeInsightTabText: {
  color: '#1976d2',
  fontWeight: '600',
},
aiContentContainer: {
  gap: 12,
},
aiInsightCard: {
  backgroundColor: '#fafafa',
  borderRadius: 12,
  padding: 14,
  borderLeftWidth: 4,
  borderLeftColor: '#1976d2',
},
aiInsightCardHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
  paddingBottom: 10,
  borderBottomWidth: 1,
  borderBottomColor: '#e0e0e0',
},
aiInsightHeaderLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
aiInsightCardTitle: {
  fontSize: 15,
  fontWeight: '600',
  color: '#333',
},
aiInsightBadge: {
  backgroundColor: '#e3f2fd',
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 12,
},
aiInsightBadgeText: {
  fontSize: 11,
  color: '#1976d2',
  fontWeight: '600',
},
aiInsightContent: {
  gap: 8,
},
aiSummaryLine: {
  fontSize: 14,
  color: '#333',
  lineHeight: 22,
  marginBottom: 6,
},
aiBoldText: {
  fontWeight: '700',
  color: '#1976d2',
},
aiBulletContainer: {
  flexDirection: 'row',
  marginBottom: 6,
  paddingLeft: 8,
},
aiBulletPoint: {
  fontSize: 14,
  color: '#1976d2',
  marginRight: 8,
  fontWeight: 'bold',
},
aiBulletText: {
  flex: 1,
  fontSize: 14,
  color: '#333',
  lineHeight: 20,
},
aiNumberedItem: {
  fontSize: 14,
  color: '#333',
  lineHeight: 22,
  marginBottom: 8,
  fontWeight: '600',
},
aiLoadingContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 20,
  gap: 12,
},
aiLoadingText: {
  color: '#666',
  fontSize: 14,
  fontStyle: 'italic',
},
aiErrorContainer: {
  backgroundColor: '#ffebee',
  padding: 14,
  borderRadius: 10,
  borderLeftWidth: 3,
  borderLeftColor: '#f44336',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},
aiErrorText: {
  flex: 1,
  color: '#d32f2f',
  fontSize: 13,
  lineHeight: 18,
},
retryButton: {
  backgroundColor: '#f44336',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 6,
},
retryButtonText: {
  color: '#fff',
  fontSize: 12,
  fontWeight: '600',
},
noDataContainer: {
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 30,
  gap: 10,
},
noDataText: {
  textAlign: 'center',
  color: '#999',
  fontSize: 14,
},
consentPromptButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#1976d2',
  paddingVertical: 14,
  paddingHorizontal: 20,
  borderRadius: 12,
  gap: 10,
  shadowColor: '#1976d2',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 3,
},
consentPromptText: {
  color: '#fff',
  fontSize: 15,
  fontWeight: '600',
},
aiErrorContainer: {
  backgroundColor: '#ffebee',
  padding: 10,
  borderRadius: 8,
  borderLeftWidth: 3,
  borderLeftColor: '#f44336',
},
aiErrorText: {
  color: '#d32f2f',
  fontSize: 14,
},
aiSummaryContent: {
  paddingVertical: 5,
},
aiSummaryText: {
  fontSize: 14,
  color: '#333',
  lineHeight: 20,
  marginBottom: 10,
},
aiAdviceContainer: {
  backgroundColor: '#f8f9ff',
  padding: 12,
  borderRadius: 8,
  marginTop: 8,
},
aiAdviceTitle: {
  fontSize: 14,
  fontWeight: '600',
  color: '#1976d2',
  marginBottom: 6,
},
aiAdviceText: {
  fontSize: 14,
  color: '#333',
  lineHeight: 18,
},
retryButton: {
  backgroundColor: '#1976d2',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 6,
  marginTop: 8,
  alignSelf: 'flex-start',
},
retryButtonText: {
  color: '#fff',
  fontSize: 12,
  fontWeight: '600',
},
insightTabContainer: {
  flexDirection: 'row',
  marginVertical: 10,
  backgroundColor: '#f5f5f5',
  borderRadius: 8,
  padding: 3,
},
insightTab: {
  flex: 1,
  paddingVertical: 8,
  paddingHorizontal: 12,
  alignItems: 'center',
  borderRadius: 6,
},
activeInsightTab: {
  backgroundColor: '#fff',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  elevation: 2,
},
insightTabText: {
  fontSize: 12,
  color: '#666',
  fontWeight: '500',
},
activeInsightTabText: {
  color: '#1976d2',
  fontWeight: '600',
},
summaryCardHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 8,
},
benchmarkText: {
  fontSize: 11,
  marginTop: 4,
  fontWeight: '500',
},
aiSummaryText: {
  fontSize: 14,
  color: '#333',
  lineHeight: 22,
  marginBottom: 10,
},
consentModalOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
},
consentModalSafeArea: {
  flex: 1,
  width: '100%',
  justifyContent: 'center',
  alignItems: 'center',
},
consentModalContainer: {
  backgroundColor: '#fff',
  borderRadius: 15,
  width: '92%',
  maxHeight: '85%',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 5,
  elevation: 8,
},
consentModalHeader: {
  alignItems: 'center',
  paddingTop: 25,
  paddingBottom: 20,
  borderBottomWidth: 1,
  borderBottomColor: '#e0e0e0',
},
consentModalTitle: {
  fontSize: 20,
  fontWeight: '600',
  color: '#333',
  marginTop: 12,
},
consentModalContent: {
  flex: 1,
},
consentModalContentContainer: {
  padding: 20,
  paddingBottom: 30,
},
consentModalText: {
  fontSize: 15,
  color: '#333',
  lineHeight: 22,
  marginBottom: 20,
},
consentModalSubheading: {
  fontSize: 15,
  fontWeight: '600',
  color: '#1976d2',
  marginTop: 15,
  marginBottom: 10,
},
consentModalBullet: {
  fontSize: 14,
  color: '#555',
  lineHeight: 24,
  marginLeft: 10,
  marginBottom: 8,
},
consentModalNote: {
  fontSize: 13,
  color: '#666',
  fontStyle: 'italic',
  marginTop: 20,
  lineHeight: 20,
  backgroundColor: '#f5f5f5',
  padding: 15,
  borderRadius: 8,
},
consentModalActions: {
  flexDirection: 'row',
  borderTopWidth: 1,
  borderTopColor: '#e0e0e0',
  padding: 20,
},
consentDeclineButton: {
  flex: 1,
  paddingVertical: 14,
  marginRight: 10,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#ccc',
  alignItems: 'center',
},
consentDeclineText: {
  color: '#666',
  fontWeight: '600',
  fontSize: 15,
},
consentAcceptButton: {
  flex: 1,
  paddingVertical: 14,
  backgroundColor: '#1976d2',
  borderRadius: 8,
  alignItems: 'center',
},
consentAcceptText: {
  color: '#fff',
  fontWeight: '600',
  fontSize: 15,
},
aiInsightSection: {
  marginBottom: 15,
  paddingBottom: 15,
  borderBottomWidth: 1,
  borderBottomColor: '#f0f0f0',
},
aiInsightSectionHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 8,
},
aiInsightSectionTitle: {
  fontSize: 14,
  fontWeight: '600',
  color: '#555',
  marginLeft: 6,
},
consentModalOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
},
consentModalContainer: {
  backgroundColor: '#fff',
  borderRadius: 20,
  width: '90%',
  maxWidth: 500,
  maxHeight: '85%',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 10,
},
consentModalHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: 25,
  paddingBottom: 15,
  paddingHorizontal: 20,
  borderBottomWidth: 1,
  borderBottomColor: '#e0e0e0',
},
consentModalTitle: {
  fontSize: 20,
  fontWeight: '700',
  color: '#333',
  marginLeft: 12,
},
consentModalScrollView: {
  maxHeight: 400,
},
consentModalContentContainer: {
  padding: 20,
},
consentModalText: {
  fontSize: 15,
  color: '#333',
  lineHeight: 22,
  marginBottom: 20,
},
consentModalSubheading: {
  fontSize: 16,
  fontWeight: '600',
  color: '#1976d2',
  marginTop: 15,
  marginBottom: 10,
},
consentModalBullet: {
  fontSize: 14,
  color: '#555',
  lineHeight: 24,
  marginLeft: 10,
  marginBottom: 8,
},
consentModalNote: {
  fontSize: 13,
  color: '#666',
  fontStyle: 'italic',
  marginTop: 20,
  lineHeight: 20,
  backgroundColor: '#f5f5f5',
  padding: 15,
  borderRadius: 8,
  borderLeftWidth: 3,
  borderLeftColor: '#1976d2',
},
consentModalActions: {
  flexDirection: 'row',
  borderTopWidth: 1,
  borderTopColor: '#e0e0e0',
  padding: 15,
  gap: 10,
},
consentDeclineButton: {
  flex: 1,
  paddingVertical: 14,
  borderRadius: 10,
  borderWidth: 1.5,
  borderColor: '#ccc',
  alignItems: 'center',
  backgroundColor: '#fff',
},
consentDeclineText: {
  color: '#666',
  fontWeight: '600',
  fontSize: 15,
},
consentAcceptButton: {
  flex: 1,
  paddingVertical: 14,
  backgroundColor: '#1976d2',
  borderRadius: 10,
  alignItems: 'center',
  shadowColor: '#1976d2',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 3,
},
consentAcceptText: {
  color: '#fff',
  fontWeight: '600',
  fontSize: 15,
},
consentPromptButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#1976d2',
  paddingVertical: 12,
  paddingHorizontal: 20,
  borderRadius: 10,
  marginVertical: 10,
  gap: 8,
},
consentPromptText: {
  color: '#fff',
  fontSize: 15,
  fontWeight: '600',
},
aiInsufficientDataContainer: {
  backgroundColor: '#FFF9C4',
  padding: 15,
  borderRadius: 8,
  borderLeftWidth: 3,
  borderLeftColor: '#F9A825',
  marginVertical: 10,
},
aiInsufficientDataText: {
  fontSize: 14,
  color: '#333',
  lineHeight: 22,
},
tooltipOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.3)',
},
tooltipContainer: {
  position: 'absolute',
  backgroundColor: '#fff',
  borderRadius: 8,
  padding: 12,
  width: 150,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 5,
  borderLeftWidth: 3,
  borderLeftColor: '#1976d2',
},
tooltipDate: {
  fontSize: 12,
  color: '#666',
  marginBottom: 4,
},
tooltipValue: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#1976d2',
  marginBottom: 4,
},
tooltipDetails: {
  fontSize: 11,
  color: '#888',
},
trendIndicatorBar: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#f8f9fa',
  padding: 10,
  borderRadius: 8,
  marginBottom: 12,
  justifyContent: 'space-between',
},
trendLeft: {
  flexDirection: 'row',
  alignItems: 'center',
},
trendText: {
  fontSize: 16,
  fontWeight: '600',
  marginLeft: 6,
},
trendDescription: {
  fontSize: 13,
  color: '#666',
},
qualityBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  alignSelf: 'flex-start',
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 12,
  marginBottom: 10,
},
qualityDot: {
  width: 8,
  height: 8,
  borderRadius: 4,
  marginRight: 6,
},
qualityText: {
  fontSize: 11,
  fontWeight: '600',
},
heatmapContainer: {
  marginTop: 15,
},
heatmapTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#333',
  marginBottom: 15,
  textAlign: 'center',
},
heatmapGrid: {
  flexDirection: 'row',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  height: 180,
  paddingHorizontal: 5,
  borderBottomWidth: 1,
  borderBottomColor: '#e0e0e0',
  marginBottom: 10,
},
heatmapCell: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'flex-end',
  height: '100%',
},
heatmapBar: {
  width: '80%',
  justifyContent: 'center',
  alignItems: 'center',
  borderTopLeftRadius: 4,
  borderTopRightRadius: 4,
  minHeight: 10,
},
heatmapBarText: {
  fontSize: 9,
  color: '#fff',
  fontWeight: '600',
},
heatmapLabel: {
  fontSize: 9,
  color: '#666',
  marginTop: 5,
  transform: [{ rotate: '-45deg' }],
  width: 30,
},
heatmapLegend: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 15,
  paddingTop: 10,
  borderTopWidth: 1,
  borderTopColor: '#f0f0f0',
},
heatmapLegendText: {
  fontSize: 11,
  color: '#666',
  marginHorizontal: 8,
},
heatmapLegendGradient: {
  flexDirection: 'row',
},
heatmapLegendBox: {
  width: 20,
  height: 20,
  marginHorizontal: 2,
  borderRadius: 3,
},
healthIndicatorContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginVertical: 15,
  gap: 10,
},
healthIndicatorCard: {
  flex: 1,
  backgroundColor: '#f8f9fa',
  borderRadius: 10,
  padding: 12,
  borderLeftWidth: 3,
  borderLeftColor: '#00BCD4',
},
healthIndicatorHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 8,
},
healthIndicatorTitle: {
  fontSize: 13,
  fontWeight: '600',
  color: '#333',
  marginLeft: 6,
},
healthIndicatorRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 6,
},
healthIndicatorStatus: {
  fontSize: 16,
  fontWeight: 'bold',
  marginLeft: 6,
},
healthIndicatorNote: {
  fontSize: 11,
  color: '#666',
  fontStyle: 'italic',
},
sleepDurationSummary: {
  flexDirection: 'row',
  gap: 10,
  marginBottom: 15,
},
sleepDurationCard: {
  flex: 1,
  backgroundColor: '#E3F2FD',
  borderRadius: 12,
  padding: 12,
  alignItems: 'center',
  gap: 6,
},
sleepDurationLabel: {
  fontSize: 12,
  color: '#666',
  fontWeight: '500',
},
sleepDurationValue: {
  fontSize: 18,
  fontWeight: '700',
  color: '#1976d2',
},
interactiveLegendContainer: {
  marginTop: 15,
  paddingTop: 15,
  borderTopWidth: 1,
  borderTopColor: '#f0f0f0',
},
legendTitle: {
  fontSize: 12,
  color: '#999',
  textAlign: 'center',
  marginBottom: 10,
  fontStyle: 'italic',
},
legendGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
},
legendItemCard: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#f8f8f8',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 8,
  minWidth: '30%',
  gap: 6,
},
legendColorDot: {
  width: 12,
  height: 12,
  borderRadius: 6,
},
legendItemText: {
  fontSize: 12,
  flex: 1,
  color: '#333',
},
legendItemCount: {
  fontSize: 11,
  fontWeight: '600',
  color: '#666',
},
aiRecommendationBadge: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  padding: 10,
  marginTop: 10,
  borderRadius: 8,
  borderLeftWidth: 3,
},
aiRecommendationText: {
  fontSize: 12,
  fontWeight: '600',
  marginBottom: 3,
},
aiRecommendationAdvice: {
  fontSize: 11,
  color: '#666',
  fontStyle: 'italic',
},
dataSufficiencyWarning: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 12,
  borderRadius: 8,
  borderLeftWidth: 3,
  marginBottom: 15,
  gap: 10,
},
dataSufficiencyText: {
  flex: 1,
  fontSize: 13,
  lineHeight: 18,
},
calorieDisclaimer: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 10,
  borderRadius: 8,
  marginTop: 10,
  gap: 8,
},
disclaimerText: {
  flex: 1,
  fontSize: 11,
  lineHeight: 16,
},
chartTitle: {
  fontSize: 16,
  fontWeight: '600',
  marginBottom: 10,
  textAlign: 'center',
},
aiNumberedSection: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  marginTop: 12,
  marginBottom: 8,
  gap: 10,
},
aiNumberBadge: {
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: '#1976d2',
  justifyContent: 'center',
  alignItems: 'center',
},
aiNumberBadgeText: {
  color: '#fff',
  fontSize: 12,
  fontWeight: '700',
},
aiNumberedTitle: {
  flex: 1,
  fontSize: 14,
  fontWeight: '600',
  lineHeight: 20,
},
exportContainer: {
  backgroundColor: '#fff',
  borderRadius: 15,
  padding: 15,
  marginTop: 10,
  marginBottom: 30,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
  elevation: 3,
  borderWidth: 1,
},
exportHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 15,
},
exportTitle: {
  fontSize: 18,
  fontWeight: '700',
  marginBottom: 4,
},
exportSubtitle: {
  fontSize: 13,
  fontStyle: 'italic',
},
aiEnabledBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 12,
  gap: 6,
},
aiEnabledText: {
  fontSize: 12,
  fontWeight: '600',
},
exportMainButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: 16,
  paddingHorizontal: 20,
  borderRadius: 12,
  gap: 10,
  marginBottom: 12,
  shadowColor: '#1976d2',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 3,
},
exportMainButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '700',
},
exportQuickActions: {
  flexDirection: 'row',
  gap: 10,
},
quickActionButton: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 12,
  borderRadius: 8,
  gap: 8,
},
quickActionText: {
  fontSize: 13,
  fontWeight: '600',
},
weaningHeader: {
  marginBottom: 15,
},
weaningSubtitle: {
  fontSize: 13,
  fontStyle: 'italic',
  marginTop: 4,
},
progressBarContainer: {
  height: 40,
  borderRadius: 20,
  overflow: 'hidden',
  marginBottom: 15,
  position: 'relative',
  justifyContent: 'center',
  alignItems: 'center',
},
progressBarFill: {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  borderRadius: 20,
},
progressBarText: {
  fontSize: 14,
  fontWeight: '700',
  zIndex: 1,
},
weaningStatsGrid: {
  flexDirection: 'row',
  gap: 10,
  marginBottom: 15,
},
weaningStat: {
  flex: 1,
  padding: 12,
  borderRadius: 10,
  alignItems: 'center',
},
weaningStatLabel: {
  fontSize: 11,
  marginBottom: 6,
},
weaningStatValue: {
  fontSize: 18,
  fontWeight: '700',
},
weaningTimeline: {
  marginBottom: 15,
},
timelineTitle: {
  fontSize: 14,
  fontWeight: '600',
  marginBottom: 10,
},
timelineEntry: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 10,
  gap: 12,
},
timelineDot: {
  width: 10,
  height: 10,
  borderRadius: 5,
},
timelineDate: {
  fontSize: 11,
},
timelineRatio: {
  fontSize: 14,
  fontWeight: '600',
},
weaningGuidanceBox: {
  padding: 12,
  borderRadius: 10,
  borderLeftWidth: 3,
  borderLeftColor: '#4CAF50',
},
guidanceText: {
  fontSize: 13,
  lineHeight: 20,
},
sleepBreakdownItem: {
  flexDirection: 'row',
  alignItems: 'center',
  borderRadius: 10,
  padding: 12,
  borderWidth: 1,
},
calculateCaloriesButton: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 20,
  gap: 8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 3,
  elevation: 3,
},
calculateCaloriesButtonText: {
  color: '#fff',
  fontSize: 13,
  fontWeight: '600',
},
calorieLoadingContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  paddingVertical: 10,
},
calorieLoadingText: {
  fontSize: 13,
  fontStyle: 'italic',
},
});

export default ReportPage;