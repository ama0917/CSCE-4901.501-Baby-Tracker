import React, { useState, useEffect, useRef } from 'react';
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
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
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

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const { width } = Dimensions.get('window');
const adjustedWidth = width - 40;

const FeedingBreakdownPieChart = ({ feedingData, darkMode, theme }) => {
  const getCalorieEstimate = (feedType, amount, unit) => {
    // Rough calorie estimates
    const estimates = {
      'breast milk': 20, // per oz
      'formula': 20, // per oz
      'solid food': 50, // per serving
      'puree': 30, // per oz
      'juice': 15, // per oz
      'water': 0,
      'milk': 18, // per oz
    };
    
    const type = (feedType || '').toLowerCase();
    let caloriesPerUnit = 50; // default
    
    for (const [key, cal] of Object.entries(estimates)) {
      if (type.includes(key)) {
        caloriesPerUnit = cal;
        break;
      }
    }
    
    // Convert to oz if needed
    let amountInOz = amount || 4; // default serving
    if (unit === 'ml') {
      amountInOz = amount / 29.5735; // ml to oz
    } else if (unit === 'pieces' || unit === 'servings') {
      amountInOz = 4; // standard serving
    }
    
    return caloriesPerUnit * amountInOz;
  };
  
  const feedTypeData = {};
  
  feedingData.forEach(log => {
    const type = log.feedType || 'Other';
    const calories = getCalorieEstimate(type, log.amount, log.amountUnit);
    
    if (!feedTypeData[type]) {
      feedTypeData[type] = { count: 0, totalCalories: 0 };
    }
    
    feedTypeData[type].count++;
    feedTypeData[type].totalCalories += calories;
  });
  
  const colors = ['#1976d2', '#FF9800', '#4CAF50', '#F44336', '#9C27B0', '#00BCD4'];
  
  const pieData = Object.entries(feedTypeData)
    .map(([type, data], index) => ({
      name: type,
      count: data.count,
      calories: Math.round(data.totalCalories),
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
        <Text style={[styles.legendTitle, { color: theme.textSecondary }]}>
          Tap to view estimated calories & details
        </Text>
        <View style={styles.legendGrid}>
          {pieData.map((item, index) => {
            const percentage = Math.round((item.count / feedingData.length) * 100);
            
            return (
              <TouchableOpacity 
                key={index}
                style={[styles.legendItemCard, { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }]}
                onPress={() => {
                  Alert.alert(
                    item.name,
                    `Feedings: ${item.count} (${percentage}%)\nEstimated Calories: ~${item.calories} cal\n\nNote: Calorie estimates are approximate and based on typical values.`,
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
                    {item.count} feedings ({percentage}%)
                  </Text>
                  <Text style={[styles.legendItemCount, { color: theme.textSecondary, fontSize: 9, fontStyle: 'italic' }]}>
                    ~{item.calories} cal
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      
      <View style={[
        styles.calorieDisclaimer,
        { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }
      ]}>
        <Ionicons name="information-circle-outline" size={16} color={darkMode ? '#64b5f6' : '#1976d2'} />
        <Text style={[
          styles.disclaimerText,
          { color: darkMode ? '#bbb' : '#666' }
        ]}>
          Calorie estimates are approximate. For accurate nutrition tracking, consult your pediatrician.
        </Text>
      </View>
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
      {quality && (
        <View style={[
          styles.qualityStatusBanner,
          {
            backgroundColor: quality.color + (darkMode ? '25' : '15'),
            borderLeftColor: quality.color
          }
        ]}>
          <Ionicons name={quality.icon} size={24} color={quality.color} />
          <View style={styles.qualityStatusText}>
            <Text style={[styles.qualityStatusLabel, { color: quality.color }]}>
              {quality.status}
            </Text>
            <Text style={[
              styles.qualityStatusDescription,
              { color: darkMode ? '#bbb' : '#666' }
            ]}>
              {totalSleep?.avg || 0}{totalSleep?.unit || ''}hrs daily vs {totalSleep?.benchmark || 12}hrs recommended
            </Text>
          </View>
        </View>
      )}

      <View style={[
        styles.sleepBreakdownContainer,
        { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }
      ]}>
        <View style={[
          styles.sleepBreakdownItem,
          {
            backgroundColor: darkMode ? '#2a2a2a' : '#fff',
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
        <View style={[styles.qualityStatusBanner, { backgroundColor: status.color + '15', borderLeftColor: status.color }]}>
          <Ionicons name={status.icon} size={24} color={status.color} />
          <View style={styles.qualityStatusText}>
            <Text style={[styles.qualityStatusLabel, { color: status.color }]}>
              {status.status}
            </Text>
            <Text style={styles.qualityStatusDescription}>
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
            <Text style={styles.feedingDetailText}>Per Day</Text>
          </View>
          <Text style={styles.feedingDetailValue}>{perDay?.avg || 0}</Text>
        </View>

        <View style={styles.feedingDetailRow}>
          <View style={styles.feedingDetailLabel}>
            <Ionicons name="time" size={18} color="#FF9800" />
            <Text style={styles.feedingDetailText}>Avg Gap</Text>
          </View>
          <Text style={styles.feedingDetailValue}>{avgGap?.avg || 0}hrs</Text>
        </View>

        <View style={styles.feedingDetailRow}>
          <View style={styles.feedingDetailLabel}>
            <Ionicons name="water" size={18} color="#FF9800" />
            <Text style={styles.feedingDetailText}>Avg Amount</Text>
          </View>
          <Text style={styles.feedingDetailValue}>{avgAmount?.avg || 0}ml</Text>
        </View>

        <View style={styles.feedingDetailRow}>
          <View style={styles.feedingDetailLabel}>
            <Ionicons name="alarm" size={18} color="#FF9800" />
            <Text style={styles.feedingDetailText}>Common Time</Text>
          </View>
          <Text style={styles.feedingDetailValue}>{mostCommon?.avg || 'N/A'}</Text>
        </View>
      </View>
    </View>
  );
};

// Diaper Summary Component
const DiaperMetricsSummary = ({ data, wetPerDay, bmPerDay }) => {
  const totalChanges = data.summary?.find(s => s.key === 'total');
  const wetDiapers = data.summary?.find(s => s.key === 'wet');
  const bmDiapers = data.summary?.find(s => s.key === 'bm');

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
        <View style={[styles.diaperStatusCard, { borderLeftColor: hydration.color }]}>
          <View style={styles.diaperCardHeader}>
            <Ionicons name="water" size={20} color={hydration.color} />
            <Text style={styles.diaperCardTitle}>Hydration</Text>
          </View>
          <Text style={[styles.diaperStatusBadge, { color: hydration.color }]}>
            {hydration.status}
          </Text>
          <Text style={styles.diaperStatusValue}>
            {wetPerDay || wetDiapers?.avg || 0} wet/day
          </Text>
          <Text style={styles.diaperStatusNote}>
            Target: 5-7/day
          </Text>
        </View>

        <View style={[styles.diaperStatusCard, { borderLeftColor: digestion.color }]}>
          <View style={styles.diaperCardHeader}>
            <Ionicons name="medical" size={20} color={digestion.color} />
            <Text style={styles.diaperCardTitle}>Digestion</Text>
          </View>
          <Text style={[styles.diaperStatusBadge, { color: digestion.color }]}>
            {digestion.status}
          </Text>
          <Text style={styles.diaperStatusValue}>
            {bmPerDay || bmDiapers?.avg || 0} BM/day
          </Text>
          <Text style={styles.diaperStatusNote}>
            Age-dependent
          </Text>
        </View>
      </View>

      <View style={styles.diaperTotalContainer}>
        <Ionicons name="repeat" size={18} color="#00BCD4" />
        <View style={styles.diaperTotalInfo}>
          <Text style={styles.diaperTotalLabel}>Total Changes</Text>
          <Text style={styles.diaperTotalValue}>{totalChanges?.avg || 0}/day</Text>
        </View>
      </View>
    </View>
  );
};


const DataPointTooltip = ({ visible, data, position, onClose }) => {
  if (!visible || !data) return null;
  
  return (
    <Modal transparent visible={visible} animationType="fade">
      <TouchableOpacity 
        style={styles.tooltipOverlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={[styles.tooltipContainer, { top: position.y - 80, left: Math.max(10, Math.min(position.x - 75, width - 160)) }]}>
          <Text style={styles.tooltipDate}>{data.label}</Text>
          <Text style={styles.tooltipValue}>{data.value} {data.unit}</Text>
          {data.details && <Text style={styles.tooltipDetails}>{data.details}</Text>}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const TimeOfDayHeatmap = ({ data, title, color, darkMode }) => {
  // data format: [{ hour: 0-23, count: number, day: string }]
  
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
          return (
            <View key={hour} style={styles.heatmapCell}>
              <View 
                style={[
                  styles.heatmapBar, 
                  { 
                    backgroundColor: getColor(intensity),
                    height: count > 0 ? `${Math.max(intensity * 100, 10)}%` : '5%'
                  }
                ]}
              >
                {count > 0 && (
                  <Text style={styles.heatmapBarText}>{count}</Text>
                )}
              </View>
              <Text style={[
                styles.heatmapLabel,
                { color: darkMode ? '#bbb' : '#666' }
              ]}>
                {hour % 4 === 0 ? formatHour(hour) : ''}
              </Text>
            </View>
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

const DiaperHealthIndicator = ({ wetPerDay, bmPerDay }) => {
  const getWetStatus = () => {
    if (wetPerDay >= 5) return { status: 'Good', color: '#4CAF50', icon: 'checkmark-circle' };
    if (wetPerDay >= 4) return { status: 'Fair', color: '#FF9800', icon: 'alert-circle' };
    return { status: 'Low', color: '#F44336', icon: 'close-circle' };
  };
  
  const getBMStatus = () => {
    if (bmPerDay >= 1 && bmPerDay <= 4) return { status: 'Normal', color: '#4CAF50', icon: 'checkmark-circle' };
    if (bmPerDay > 4) return { status: 'Frequent', color: '#FF9800', icon: 'alert-circle' };
    if (bmPerDay > 0) return { status: 'Low', color: '#FF9800', icon: 'alert-circle' };
    return { status: 'Concern', color: '#F44336', icon: 'close-circle' };
  };
  
  const wetStatus = getWetStatus();
  const bmStatus = getBMStatus();
  
  return (
    <View style={styles.healthIndicatorContainer}>
      <View style={styles.healthIndicatorCard}>
        <View style={styles.healthIndicatorHeader}>
          <Ionicons name="water" size={18} color="#00BCD4" />
          <Text style={styles.healthIndicatorTitle}>Hydration</Text>
        </View>
        <View style={styles.healthIndicatorRow}>
          <Ionicons name={wetStatus.icon} size={20} color={wetStatus.color} />
          <Text style={[styles.healthIndicatorStatus, { color: wetStatus.color }]}>
            {wetStatus.status}
          </Text>
        </View>
        <Text style={styles.healthIndicatorNote}>
          {wetPerDay >= 5 ? 'Well hydrated' : 'Monitor hydration'}
        </Text>
      </View>
      
      <View style={styles.healthIndicatorCard}>
        <View style={styles.healthIndicatorHeader}>
          <Ionicons name="medical" size={18} color="#FF9800" />
          <Text style={styles.healthIndicatorTitle}>Digestion</Text>
        </View>
        <View style={styles.healthIndicatorRow}>
          <Ionicons name={bmStatus.icon} size={20} color={bmStatus.color} />
          <Text style={[styles.healthIndicatorStatus, { color: bmStatus.color }]}>
            {bmStatus.status}
          </Text>
        </View>
        <Text style={styles.healthIndicatorNote}>
          {bmPerDay >= 1 && bmPerDay <= 4 ? 'Regular pattern' : 'Consult healthcare provider if concerned'}
        </Text>
      </View>
    </View>
  );
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
  const getContainerStyle = (baseStyle) => {
    return [
      baseStyle,
      {
        backgroundColor: darkMode ? '#1f1f1f' : '#fff',
        borderColor: darkMode ? '#333' : '#e0e0e0'
      }
    ];
  };

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
  
  // Data states
  const [sleepData, setSleepData] = useState([]);
  const [diaperData, setDiaperData] = useState([]);
  const [feedingData, setFeedingData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDataPoint, setSelectedDataPoint] = useState(null);
  const [childData, setChildData] = useState(null);

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

  // Second useEffect - Fetch all data (only runs if owner check passes)
  useEffect(() => {
    if (!childId || !isOwner || checkingPermissions) {
      return;
    }
    
    const fetchAllData = async () => {
      setIsLoading(true);
      
      try {
        const { start, end } = getTimeRange();
        
        const startTimestamp = Timestamp.fromDate(new Date(start.setHours(0, 0, 0, 0)));
        const endTimestamp = Timestamp.fromDate(new Date(end.setHours(23, 59, 59, 999)));
        
        await Promise.all([
          fetchChildData(),
          fetchSleepData(startTimestamp, endTimestamp),
          fetchDiaperData(startTimestamp, endTimestamp),
          fetchFeedingData(startTimestamp, endTimestamp)
        ]);
      } catch (error) {
        console.error('Error fetching data:', error);
        Alert.alert('Error', 'Failed to fetch report data.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAllData();
  }, [childId, reportRange, isOwner, checkingPermissions]);

  // EARLY RETURNS - Must come AFTER all hooks
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
  
  const lines = text.split('\n');
  return lines.map((line, index) => {
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
    
    // Bullet points
    if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
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
            {line.replace(/^[•\-]\s*/, '')}
          </Text>
        </View>
      );
    }
    
    // Section numbers (1., 2., etc.)
    if (/^\d+\./.test(line.trim())) {
      return (
        <Text key={index} style={[
          styles.aiNumberedItem,
          { color: darkMode ? '#ddd' : '#333' }
        ]}>
          {line}
        </Text>
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
  });
};

const AIPoweredSummary = ({ childId, childAge, childWeight, childHeight, sleepData, feedingData, diaperData, reportRange, activeTab: mainActiveTab, darkMode, theme }) => {
  const [summaryCache, setSummaryCache] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasConsented, setHasConsented] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const cacheLoadedRef = useRef(false);
  const consentCheckRef = useRef(false); // NEW: Prevent double checks

  // Load consent and cache on mount - ONLY ONCE
  useEffect(() => {
    if (consentCheckRef.current) return; // Prevent re-running
    
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

  const handleGenerateSummary = async (category, forceRefresh = false) => {
    if (!hasConsented) {
      setShowConsentModal(true);
      return;
    }

    const cacheKey = `${reportRange}_${category}`;
    
    if (!forceRefresh && summaryCache[cacheKey]) {
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
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
    } catch (error) {
      console.error('Error in handleGenerateSummary:', error);
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
      
      // Wait a bit before generating to avoid race conditions
      setTimeout(() => {
        handleGenerateSummary(mainActiveTab);
      }, 300);
    } catch (error) {
      console.error('Error saving consent:', error);
      Alert.alert('Error', 'Failed to save consent preference');
    }
  };

  // Auto-load only when reportRange changes
  useEffect(() => {
    if (!hasConsented || !cacheLoadedRef.current) return;
    
    const cacheKey = `${reportRange}_${mainActiveTab}`;
    const shouldLoad = !summaryCache[cacheKey] && 
                       (sleepData?.length > 0 || feedingData?.length > 0 || diaperData?.length > 0);
    
    if (shouldLoad) {
      handleGenerateSummary(mainActiveTab);
    }
  }, [reportRange]); // Only trigger on reportRange change

return (
  <View style={[
    styles.aiSummaryContainer,
    {
      backgroundColor: darkMode ? '#2a2a2a' : '#fff',
      borderColor: darkMode ? '#404040' : '#e8eaf6'
    }
  ]}>
    {/* Render consent modal ONLY if it should show */}
      {showConsentModal && !showRevokeConfirm && (
        <ConsentModal 
          onConsent={handleConsent}
          onDecline={() => setShowConsentModal(false)}
        />
      )}

    {/* Render revoke modal */}
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
        <View style={styles.aiSummaryHeaderRow}>
          <View style={styles.aiSummaryHeaderLeft}>
            <View style={styles.aiIconBadge}>
              <Ionicons name="sparkles" size={18} color="#FFF" />
            </View>
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
            
            {!isLoading && !error && (summaryCache[overallCacheKey] || summaryCache[currentCacheKey]) && (
              <View style={styles.aiContentContainer}>
                {summaryCache[overallCacheKey] && (
                  <View style={[
                    styles.aiInsightCard,
                    { backgroundColor: darkMode ? '#1f1f1f' : '#fafafa' }
                  ]}>
                    <View style={[
                      styles.aiInsightCardHeader,
                      { borderBottomColor: darkMode ? '#404040' : '#e0e0e0' }
                    ]}>
                      <View style={styles.aiInsightHeaderLeft}>
                        <Ionicons name="stats-chart" size={18} color="#1976d2" />
                        <Text style={[
                          styles.aiInsightCardTitle,
                          { color: darkMode ? '#fff' : '#333' }
                        ]}>
                          Overall Summary
                        </Text>
                      </View>
                      <View style={[
                        styles.aiInsightBadge,
                        { backgroundColor: darkMode ? '#1a3a52' : '#e3f2fd' }
                      ]}>
                        <Text style={[
                          styles.aiInsightBadgeText,
                          { color: darkMode ? '#64b5f6' : '#1976d2' }
                        ]}>
                          {reportRange}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.aiInsightContent}>
                      {renderFormattedText(summaryCache[overallCacheKey], darkMode)}
                    </View>
                  </View>
                )}
                
                {summaryCache[currentCacheKey] && (
                  <View style={[
                    styles.aiInsightCard,
                    { backgroundColor: darkMode ? '#1f1f1f' : '#fafafa' }
                  ]}>
                    <View style={[
                      styles.aiInsightCardHeader,
                      { borderBottomColor: darkMode ? '#404040' : '#e0e0e0' }
                    ]}>
                      <View style={styles.aiInsightHeaderLeft}>
                        <Ionicons 
                          name={
                            mainActiveTab === 'Sleep' ? 'bed' :
                            mainActiveTab === 'Feeding' ? 'restaurant' :
                            'water'
                          } 
                          size={18} 
                          color="#1976d2"
                        />
                        <Text style={[
                          styles.aiInsightCardTitle,
                          { color: darkMode ? '#fff' : '#333' }
                        ]}>
                          {mainActiveTab} Deep Dive
                        </Text>
                      </View>
                    </View>
                    <View style={styles.aiInsightContent}>
                      {renderFormattedText(summaryCache[currentCacheKey], darkMode)}
                    </View>
                  </View>
                )}
              </View>
            )}
            
            {!isLoading && !error && !summaryCache[overallCacheKey] && !summaryCache[currentCacheKey] && (
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


  // Fetch sleep data
const fetchSleepData = async (startTimestamp, endTimestamp) => {
  try {
    console.log('Fetching sleep data for:', {
      childId,
      startDate: startTimestamp.toDate(),
      endDate: endTimestamp.toDate()
    });
    
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
      console.log('Sleep log entry:', {
        timestamp: data.timestamp?.toDate(),
        duration: data.duration
      });
    });
    
    console.log('Total sleep logs fetched:', logs.length);
    setSleepData(logs);
  } catch (error) {
    console.error('Error fetching sleep logs:', error);
    Alert.alert('Error', 'Failed to fetch sleep data: ' + error.message);
  }
};

  // Fetch diaper data
  const fetchDiaperData = async (startTimestamp, endTimestamp) => {
    try {
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
      
      setDiaperData(logs);
    } catch (error) {
      console.error('Error fetching diaper logs:', error);
    }
  };

  // Fetch feeding data
  const fetchFeedingData = async (startTimestamp, endTimestamp) => {
    try {
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
      
      setFeedingData(logs);
    } catch (error) {
      console.error('Error fetching feeding logs:', error);
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
  const recommendedSleep = 12;
  const benchmarkLine = Array(periodLabels.length).fill(recommendedSleep);
  
  // Calculate summary statistics - these should be daily averages
  const totalDays = reportRange === 'Weekly' ? 7 : reportRange === 'Monthly' ? 30 : 365;
  const totalSleepHours = durationData.reduce((a, b) => a + b, 0);
  const totalNightHours = nightSleepData.reduce((a, b) => a + b, 0);
  const totalNapHours = napData.reduce((a, b) => a + b, 0);
  const totalSessions = countData.reduce((a, b) => a + b, 0);
  
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
  
  // Calculate totals
  const totalWet = wetCount.reduce((sum, val) => sum + val, 0);
  const totalBM = bmCount.reduce((sum, val) => sum + val, 0);
  const totalDry = dryCount.reduce((sum, val) => sum + val, 0);
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
        trend: calculateTrend(totalCountsPerPeriod), // NOW DEFINED
        metric: 'stable',
        icon: 'repeat',
        benchmark: 6,
        unit: '/day'
      },
      { 
        key: 'wet', 
        label: 'Wet Diapers',
        avg: avgWetPerDay,
        trend: calculateTrend(wetCountsPerPeriod), // NOW DEFINED
        metric: 'more',
        icon: 'water',
        benchmark: 5,
        unit: '/day'
      },
      { 
        key: 'bm', 
        label: 'BM Diapers',
        avg: avgBMPerDay,
        trend: calculateTrend(bmCountsPerPeriod), // NOW DEFINED
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


const exportReportAsPDF = async () => {
  try {
    const date = new Date().toLocaleDateString();
    const chartData = getChartData();
    
    // Generate summary statistics
    const sleepStats = sleepData.length > 0 ? {
      total: sleepData.length,
      avgDuration: (sleepData.reduce((sum, s) => sum + (s.duration || 0), 0) / sleepData.length / 60).toFixed(1)
    } : { total: 0, avgDuration: 0 };
    
    const feedingStats = {
      total: feedingData.length,
      avgGap: calculateFeedingGap(feedingData)
    };
    
    const diaperStats = {
      total: diaperData.length,
      avgPerDay: (diaperData.length / (reportRange === 'Weekly' ? 7 : reportRange === 'Monthly' ? 30 : 365)).toFixed(1)
    };

    const html = `
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
            }
            .header-info {
              text-align: center;
              color: #666;
              margin-bottom: 30px;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
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
          </style>
        </head>
        <body>
          <h1>${name || "Child"}'s ${reportRange} Report</h1>
          <div class="header-info">
            Generated on ${date}
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-title">Total Sleep Sessions</div>
              <div class="stat-value">${sleepStats.total}</div>
              <div class="stat-title">Avg. ${sleepStats.avgDuration}hrs</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Total Feedings</div>
              <div class="stat-value">${feedingStats.total}</div>
              <div class="stat-title">Avg. ${feedingStats.avgGap}hrs apart</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Diaper Changes</div>
              <div class="stat-value">${diaperStats.total}</div>
              <div class="stat-title">${diaperStats.avgPerDay}/day avg</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Sleep Logs</div>
            ${sleepData.slice(0, 20).map(log => `
              <div class="entry">
                <div class="timestamp">${new Date(log.timestamp.toDate()).toLocaleString()}</div>
                Duration: ${(log.duration / 60).toFixed(1)} hours
              </div>
            `).join('')}
            ${sleepData.length > 20 ? `<div class="entry">... and ${sleepData.length - 20} more entries</div>` : ''}
          </div>

          <div class="section">
            <div class="section-title">Feeding Logs</div>
            ${feedingData.slice(0, 20).map(log => `
              <div class="entry">
                <div class="timestamp">${new Date(log.timestamp.toDate()).toLocaleString()}</div>
                ${log.amount || '?'}${log.unit || 'ml'} (${log.feedType || 'N/A'})
              </div>
            `).join('')}
            ${feedingData.length > 20 ? `<div class="entry">... and ${feedingData.length - 20} more entries</div>` : ''}
          </div>

          <div class="section">
            <div class="section-title">Diaper Logs</div>
            ${diaperData.slice(0, 20).map(log => `
              <div class="entry">
                <div class="timestamp">${new Date(log.time.toDate()).toLocaleString()}</div>
                ${log.stoolType || 'Unknown'}
              </div>
            `).join('')}
            ${diaperData.length > 20 ? `<div class="entry">... and ${diaperData.length - 20} more entries</div>` : ''}
          </div>

          <div class="footer">
            Report generated by Baby Tracker App
          </div>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  } catch (err) {
    console.error("PDF Export Error:", err);
    Alert.alert("Error", "Could not generate PDF.");
  }
};

// Export report as Excel
const exportReportAsExcel = async () => {
  try {
    // 1. Feeding Sheet (with unit included)
    const feedingSheetData = [
      ["Timestamp", "Amount", "Unit", "Type"],
      ...feedingData.map(log => [
        new Date(log.timestamp.toDate()).toLocaleString(),
        log.amount || '?',
        log.unit || 'ml',
        log.feedType || 'N/A',
      ])
    ];
    const feedingSheet = XLSX.utils.aoa_to_sheet(feedingSheetData);
    feedingSheet['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 8 }, { wch: 18 }];

    // 2. Sleep Sheet
    const sleepSheetData = [
      ["Timestamp", "Duration (mins)"],
      ...sleepData.map(log => [
        new Date(log.timestamp.toDate()).toLocaleString(),
        log.duration || '?'
      ])
    ];
    const sleepSheet = XLSX.utils.aoa_to_sheet(sleepSheetData);
    sleepSheet['!cols'] = [{ wch: 22 }, { wch: 16 }];

    // 3. Diaper Sheet
    const diaperSheetData = [
      ["Timestamp", "Stool Type"],
      ...diaperData.map(log => [
        new Date(log.time.toDate()).toLocaleString(),
        log.stoolType || 'Unknown'
      ])
    ];
    const diaperSheet = XLSX.utils.aoa_to_sheet(diaperSheetData);
    diaperSheet['!cols'] = [{ wch: 22 }, { wch: 20 }];

    // 4. Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, feedingSheet, "Feeding");
    XLSX.utils.book_append_sheet(wb, sleepSheet, "Sleep");
    XLSX.utils.book_append_sheet(wb, diaperSheet, "Diaper");

    // 5. Convert to base64 and save
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const uri = FileSystem.documentDirectory + `${name || 'Child'}_Report.xlsx`;

    // Write file using legacy API with proper encoding
    await FileSystem.writeAsStringAsync(uri, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Check if sharing is available
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
  
  // Generate legend items

  const getLegend = (chartData) => {
    // Early return if no data
    if (!chartData) return null;
    
    // Handle legend array format
    if (chartData.legend && Array.isArray(chartData.legend)) {
      return (
        <View style={styles.legendRow}>
          {chartData.legend.map((legendItem, index) => {
            // Define default colors for each index
            const defaultColors = ['#1976d2', '#FF9800', '#4CAF50', '#F44336', '#9C27B0'];
            let color = defaultColors[index % defaultColors.length];
            
            // Try to get color from dataset if it exists
            if (chartData.datasets && 
                chartData.datasets[index] && 
                typeof chartData.datasets[index].color === 'function') {
              color = chartData.datasets[index].color(1);
            }
            
            return (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: color }]} />
                <Text style={styles.legendText}>
                  {legendItem}
                </Text>
              </View>
            );
          })}
        </View>
      );
    }

    // Handle datasets array format
    if (chartData.datasets && Array.isArray(chartData.datasets)) {
      return (
        <View style={styles.legendRow}>
          {chartData.datasets.map((dataset, index) => {
            const defaultColors = ['#1976d2', '#FF9800', '#4CAF50', '#F44336', '#9C27B0'];
            let color = defaultColors[index % defaultColors.length];
            
            if (dataset && typeof dataset.color === 'function') {
              color = dataset.color(1);
            }
            
            return (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: color }]} />
                <Text style={styles.legendText}>
                  {dataset?.legend || dataset?.name || `Dataset ${index + 1}`}
                </Text>
              </View>
            );
          })}
        </View>
      );
    }

    return null;
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
          childAge={childData?.age}
          hasAIConsent={hasAIConsent}
        />
      )}

      {activeTab === 'Feeding' && data && (
        <FeedingMetricsSummary 
          data={data}
          childAge={childData?.age}
          hasAIConsent={hasAIConsent}
        />
      )}

      {activeTab === 'Diaper' && data && (
        <DiaperMetricsSummary
          data={data}
          wetPerDay={parseFloat(data.summary?.find(s => s.key === 'wet')?.avg || 0)}
          bmPerDay={parseFloat(data.summary?.find(s => s.key === 'bm')?.avg || 0)}
          childAge={childData?.age}
          hasAIConsent={hasAIConsent}
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

        {/* STACKED BAR CHART */}
        {chartType === 'bar' && activeTab === 'Diaper' && data.series && (
          <StackedBarChart
            series={data.series}
            categories={data.options?.xaxis?.categories || []}
            height={300}
          />
        )}

        {/* HEATMAPS - CONDITIONALLY RENDERED PER TAB */}
        {activeTab === 'Sleep' && sleepData.length > 0 && (
          <View style={styles.additionalChartContainer}>
            <TimeOfDayHeatmap
              data={processSleepTimeOfDay()}
              title="Sleep Start Times"
              color="#1976d2"
              darkMode={darkMode}
            />
          </View>
        )}

        {activeTab === 'Feeding' && feedingData.length > 0 && (
          <View style={styles.additionalChartContainer}>
            <TimeOfDayHeatmap
              data={processFeedingTimeOfDay()}
              title="Feeding Times"
              color="#FF9800"
              darkMode={darkMode}
            />
          </View>
        )}

        {activeTab === 'Diaper' && diaperData.length > 0 && (
          <View style={styles.additionalChartContainer}>
            <TimeOfDayHeatmap
              data={processDiaperTimeOfDay()}
              title="Diaper Change Times"
              color="#00BCD4"
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

      {activeTab === 'Feeding' && feedingData.length > 0 && hasAIConsent && (
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
        />
      </View>
    )}

      {/* SLEEP DURATION SUMMARY */}
      <View style={styles.sleepDurationSummary}>
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
      </View>
        
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
                  
                  return (
                    <TouchableOpacity 
                      key={index}
                      style={[styles.legendItemCard, { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }]}
                      onPress={() => {
                        Alert.alert(
                          item.name,
                          `Total Hours: ${item.hours}hrs\nPercentage: ${percentage}%\nAverage per day: ${(item.hours / 7).toFixed(1)}hrs`,
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
                          {item.hours}hrs ({percentage}%)
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
      colors={darkMode ? ['#1f1f1f', '#2a2a2a'] : ['#B2EBF2', '#FCE4EC']} 
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
      <View style={[styles.header, { backgroundColor: darkMode ? 'transparent' : 'transparent' }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          <Text style={[styles.backText, { color: theme.textPrimary }]}>Dashboard</Text>
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

        {/* Time period toggle */}
      <View style={[styles.toggleContainer, { backgroundColor: darkMode ? '#2c2c2c' : '#f0f0f0' }]}>
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
            style={[styles.toggleButton, reportRange === 'Annual' &&[styles.activeToggle, { backgroundColor: darkMode ? '#444' : '#fff' }]]}
            onPress={() => setReportRange('Annual')}
          >
            <Text style={[styles.toggleText, reportRange === 'Annual' && { color: theme.textPrimary }]}>
              Year
            </Text>
          </TouchableOpacity>
        </View>

        
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
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
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
        </ScrollView>

      <ExportReportSection 
        exportReportAsPDF={exportReportAsPDF} 
        exportReportAsExcel={exportReportAsExcel}
        darkMode={darkMode}
        theme={theme}
      />
      </SafeAreaView>
    </LinearGradient>
  );
};

// Add export report functionality
 const ExportReportSection = ({ 
    exportReportAsPDF, 
    exportReportAsExcel,
    darkMode,
    theme 
  }) => {
    return (
      <View style={[
        styles.exportContainer,
        {
          backgroundColor: darkMode ? '#1f1f1f' : '#fff',
          borderColor: darkMode ? '#333' : '#e0e0e0'
        }
      ]}>
        <Text style={[styles.exportTitle, { color: theme.textPrimary }]}>
          Export Report
        </Text>
        <View style={styles.exportOptionsRow}>
          <TouchableOpacity 
            style={[
              styles.exportOption,
              { backgroundColor: darkMode ? '#2c2c2c' : '#f8f8f8' }
            ]}
            onPress={exportReportAsPDF}
          >
            <AntDesign
              name="file-pdf"
              size={18}
              color="#E53935"
              style={styles.exportOptionIcon}
            />
            <Text style={[styles.exportOptionText, { color: theme.textPrimary }]}>
              PDF
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.exportOption,
              { backgroundColor: darkMode ? '#2c2c2c' : '#f8f8f8' }
            ]}
            onPress={exportReportAsExcel}
          >
            <FontAwesome5
              name="file-excel"
              size={18}
              color="#2E7D32"
              style={styles.exportOptionIcon}
            />
            <Text style={[styles.exportOptionText, { color: theme.textPrimary }]}>
              Excel
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.exportButton}
          onPress={exportReportAsPDF}
        >
          <Text style={styles.exportButtonText}>Share Report</Text>
        </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
backButton: {
  padding: 5,
  flexDirection: 'row',
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
    marginLeft: -30,
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
});

export default ReportPage;