import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Image,
  Alert
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

const { width } = Dimensions.get('window');
const adjustedWidth = width - 40; // Account for padding

const ReportPage = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { childId, name } = route.params || {};

  const { colors } = useTheme(); // Access the current theme's colors

  // State variables
  const [reportRange, setReportRange] = useState('Weekly');
  const [activeTab, setActiveTab] = useState('Sleep');
  const [isLoading, setIsLoading] = useState(true);
  const [showDataLabels, setShowDataLabels] = useState(false);

  // Data states
  const [sleepData, setSleepData] = useState([]);
  const [diaperData, setDiaperData] = useState([]);
  const [feedingData, setFeedingData] = useState([]);
  const [selectedDataPoint, setSelectedDataPoint] = useState(null);

  // Chart type selection
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
    backgroundGradientFrom: colors.background,
    backgroundGradientTo: colors.background,
    decimalPlaces: 1,
    color: (opacity = 1) => colors.primary + opacity,
    labelColor: () => colors.text,
    propsForLabels: {
      fontSize: 10,
      fontWeight: '500',
    },
    propsForDots: {
      r: "4",
      strokeWidth: "1",
      stroke: colors.primary,
    },
    strokeWidth: 2,
    propsForVerticalLabels: {
      fontSize: 10,
      rotation: 0,
    },
    propsForHorizontalLabels: {
      fontSize: 10,
    },
    paddingRight: 30,
    paddingLeft: 40,
    paddingTop: 15,
    formatYLabel: (value) => String(value),
    useShadowColorFromDataset: false,
  };

  // Time period calculation
  const getTimeRange = () => {
    const now = new Date();
    const startDate = new Date();
    
    switch (reportRange) {
      case 'Weekly':
        startDate.setDate(now.getDate() - 7);
        return { start: startDate, end: now, periodLabels: getLast7Days() };
      case 'Monthly':
        startDate.setDate(now.getDate() - 30);
        return { start: startDate, end: now, periodLabels: getLast4Weeks() };
      case 'Annual':
        startDate.setMonth(now.getMonth() - 12);
        return { start: startDate, end: now, periodLabels: getLast12Months() };
      default:
        startDate.setDate(now.getDate() - 7);
        return { start: startDate, end: now, periodLabels: getLast7Days() };
    }
  };

  // Helper functions for time labels
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    return days;
  };

  const getLast4Weeks = () => {
    const weeks = [];
    for (let i = 3; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - (i * 7));
      weeks.push(`Week ${4-i}`);
    }
    return weeks;
  };

  const getLast12Months = () => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push(date.toLocaleDateString('en-US', { month: 'short' }));
    }
    return months;
  };

  // Fetch all data
  useEffect(() => {
    if (!childId) {
      Alert.alert('Error', 'Child ID is missing.');
      return;
    }
    
    const fetchAllData = async () => {
      setIsLoading(true);
      
      try {
        const { start, end } = getTimeRange();
        
        // Convert Date objects to Firestore Timestamps
        const startTimestamp = Timestamp.fromDate(start);
        const endTimestamp = Timestamp.fromDate(end);
        
        await Promise.all([
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
  }, [childId, reportRange]);

  // Fetch sleep data
  const fetchSleepData = async (startTimestamp, endTimestamp) => {
    try {
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
        logs.push({ id: doc.id, ...doc.data() });
      });
      
      setSleepData(logs);
    } catch (error) {
      console.error('Error fetching sleep logs:', error);
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

  // Process data for charts
  const processSleepData = () => {
    const { periodLabels } = getTimeRange();
    
    // Initialize datasets with zero values
    const durationData = Array(periodLabels.length).fill(0);
    const countData = Array(periodLabels.length).fill(0);
    
    sleepData.forEach(log => {
      const logDate = log.timestamp.toDate();
      let index;
      
      if (reportRange === 'Weekly') {
        // For weekly, index is based on day of week
        const dayOfWeek = logDate.getDay();
        const today = new Date().getDay();
        index = (dayOfWeek - today + 7) % 7;
      } else if (reportRange === 'Monthly') {
        // For monthly, divide into 4 weeks
        const daysAgo = Math.floor((new Date() - logDate) / (1000 * 60 * 60 * 24));
        index = Math.min(3, Math.floor(daysAgo / 7));
      } else {
        // For annual, index is based on month
        const monthDiff = (new Date().getMonth() - logDate.getMonth() + 12) % 12;
        index = monthDiff;
      }
      
      // Add duration (in hours)
      if (log.duration) {
        durationData[index] += log.duration / 60; // Convert minutes to hours
        countData[index]++;
      }
    });
    
    // Calculate average duration per day when there are entries
    const avgDurationData = durationData.map((total, i) => 
      countData[i] ? parseFloat((total / countData[i]).toFixed(1)) : 0
    );
    
    // Get overall averages for summary cards
    const totalDuration = durationData.reduce((sum, val) => sum + val, 0);
    const totalCount = countData.reduce((sum, val) => sum + val, 0);
    const avgDuration = totalCount ? parseFloat((totalDuration / totalCount).toFixed(1)) : 0;
    
    // Find most common sleep times
    const timeDistribution = {};
    sleepData.forEach(log => {
      const startHour = log.timestamp.toDate().getHours();
      timeDistribution[startHour] = (timeDistribution[startHour] || 0) + 1;
    });
    
    // Format for pie chart
    const sleepTimeDistribution = Object.keys(timeDistribution).map(hour => {
      const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#8AC54B', '#EA5AA0', '#5AC8FA', '#AF52DE'
      ];
      const formattedHour = parseInt(hour);
      const ampm = formattedHour >= 12 ? 'PM' : 'AM';
      const hour12 = formattedHour % 12 || 12;
      
      return {
        name: `${hour12} ${ampm}`,
        count: timeDistribution[hour],
        color: colors[formattedHour % colors.length],
        legendFontColor: '#7F7F7F',
        legendFontSize: 10
      };
    }).sort((a, b) => b.count - a.count).slice(0, 5);
    
    return {
      lineData: {
        labels: periodLabels,
        datasets: [
          {
            data: avgDurationData,
            color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
            strokeWidth: 2
          }
        ],
        legend: ["Avg. Hours"]
      },
      summary: [
        { key: 'duration', avg: avgDuration, trend: 'stable', metric: 'more' },
        { key: 'count', avg: totalCount, trend: 'stable', metric: 'more' }
      ],
      timeDistribution: sleepTimeDistribution
    };
  };

  const processDiaperData = () => {
    const { periodLabels } = getTimeRange();
    
    // Initialize datasets
    const wetCount = Array(periodLabels.length).fill(0);
    const bmCount = Array(periodLabels.length).fill(0);
    const wetBmCount = Array(periodLabels.length).fill(0);
    const dryCount = Array(periodLabels.length).fill(0);
    
    diaperData.forEach(log => {
      const logDate = log.time.toDate();
      let index;
      
      if (reportRange === 'Weekly') {
        const dayOfWeek = logDate.getDay();
        const today = new Date().getDay();
        index = (dayOfWeek - today + 7) % 7;
      } else if (reportRange === 'Monthly') {
        const daysAgo = Math.floor((new Date() - logDate) / (1000 * 60 * 60 * 24));
        index = Math.min(3, Math.floor(daysAgo / 7));
      } else {
        const monthDiff = (new Date().getMonth() - logDate.getMonth() + 12) % 12;
        index = monthDiff;
      }
      
      // Increment based on stool type
      if (log.stoolType === 'Wet') {
        wetCount[index]++;
      } else if (log.stoolType === 'BM') {
        bmCount[index]++;
      } else if (log.stoolType === 'Wet+BM') {
        wetBmCount[index]++;
      } else if (log.stoolType === 'Dry') {
        dryCount[index]++;
      }
    });
    
    // Total each type
    const totalWet = wetCount.reduce((sum, val) => sum + val, 0);
    const totalBM = bmCount.reduce((sum, val) => sum + val, 0);
    const totalWetBM = wetBmCount.reduce((sum, val) => sum + val, 0);
    const totalDry = dryCount.reduce((sum, val) => sum + val, 0);
    const totalChanges = totalWet + totalBM + totalWetBM + totalDry;
    
    // Average per time period
    const divisor = reportRange === 'Weekly' ? 7 : reportRange === 'Monthly' ? 4 : 12;
    const avgChanges = parseFloat((totalChanges / divisor).toFixed(1));
    
    return {
      barData: {
        labels: periodLabels,
        datasets: [
          {
            data: wetCount,
            color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
            legend: 'Wet'
          },
          {
            data: bmCount,
            color: (opacity = 1) => `rgba(255, 159, 64, ${opacity})`,
            legend: 'BM'
          },
          {
            data: wetBmCount,
            color: (opacity = 1) => `rgba(153, 102, 255, ${opacity})`,
            legend: 'Wet+BM'
          },
          {
            data: dryCount,
            color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})`,
            legend: 'Dry'
          }
        ]
      },
      summary: [
        { key: 'changes', avg: avgChanges, trend: 'stable', metric: 'normal' },
        { key: 'wet', avg: totalWet, trend: 'stable', metric: 'normal' },
        { key: 'bm', avg: totalBM, trend: 'stable', metric: 'normal' }
      ]
    };
  };

  const processFeedingData = () => {
    const { periodLabels } = getTimeRange();
    
    // Initialize datasets
    const amountData = Array(periodLabels.length).fill(0);
    const countData = Array(periodLabels.length).fill(0);
    
    // Track feeding types
    const feedingTypes = {};
    
    feedingData.forEach(log => {
      const logDate = log.timestamp.toDate();
      let index;
      
      if (reportRange === 'Weekly') {
        const dayOfWeek = logDate.getDay();
        const today = new Date().getDay();
        index = (dayOfWeek - today + 7) % 7;
      } else if (reportRange === 'Monthly') {
        const daysAgo = Math.floor((new Date() - logDate) / (1000 * 60 * 60 * 24));
        index = Math.min(3, Math.floor(daysAgo / 7));
      } else {
        const monthDiff = (new Date().getMonth() - logDate.getMonth() + 12) % 12;
        index = monthDiff;
      }
      
      // Add amount if it's a number
      const amount = parseFloat(log.amount);
      if (!isNaN(amount)) {
        amountData[index] += amount;
        countData[index]++;
      }
      
      // Track meal types
      if (log.feedType) {
        feedingTypes[log.feedType] = (feedingTypes[log.feedType] || 0) + 1;
      }
    });
    
    // Calculate average per day
    const totalAmount = amountData.reduce((sum, val) => sum + val, 0);
    const totalCount = countData.reduce((sum, val) => sum + val, 0);
    const divisor = reportRange === 'Weekly' ? 7 : reportRange === 'Monthly' ? 4 : 12;
    const avgAmount = parseFloat((totalAmount / divisor).toFixed(1));
    const avgCount = parseFloat((totalCount / divisor).toFixed(1));
    
    // Create feeding type distribution for pie chart
    const feedTypeDistribution = Object.keys(feedingTypes).map((type, index) => {
      const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#8AC54B', '#EA5AA0', '#5AC8FA', '#AF52DE'
      ];
      
      return {
        name: type,
        count: feedingTypes[type],
        color: colors[index % colors.length],
        legendFontColor: '#7F7F7F',
        legendFontSize: 10
      };
    }).sort((a, b) => b.count - a.count);
    
    return {
      lineData: {
        labels: periodLabels,
        datasets: [
          {
            data: amountData,
            color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})`,
            strokeWidth: 2
          }
        ],
        legend: ["Total Amount"]
      },
      summary: [
        { key: 'amount', avg: avgAmount, trend: 'stable', metric: 'more' },
        { key: 'feedings', avg: avgCount, trend: 'stable', metric: 'more' }
      ],
      typeDistribution: feedTypeDistribution
    };
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

  // Generate legend items
  const getLegend = (data) => {
    if (!data || !data.datasets) return null;
    
    return (
      <View style={styles.legendRow}>
        {data.datasets.map((dataset, index) => (
          <View key={index} style={styles.legendItem}>
            <View
              style={[
                styles.legendColor,
                { backgroundColor: dataset.color ? dataset.color(1) : '#1976d2' }
              ]}
            />
            <Text style={styles.legendText}>
              {dataset.legend || `Dataset ${index + 1}`}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // Handle data point selection
  const handleDataPointClick = (dataPoint) => {
    setSelectedDataPoint(dataPoint);
    Alert.alert(
      'Data Details',
      `Value: ${dataPoint.value}\nDate: ${dataPoint.date}`,
      [{ text: 'OK', onPress: () => setSelectedDataPoint(null) }]
    );
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
    const chartType = getChartType(activeTab);
    const yLabel = getYAxisLabel();
    
    // Define legend labels for readability
    const legendLabels = {
      'duration': 'Sleep Duration',
      'count': 'Sleep Episodes',
      'changes': 'Diaper Changes',
      'wet': 'Wet Diapers',
      'bm': 'BM Diapers',
      'amount': 'Feeding Amount',
      'feedings': 'Feeding Count'
    };

    // Extract summary metrics
    const summaryMetrics = data.summary || [];

    return (
      <View style={styles.chartContainer}>
        {/* Summary cards at the top of each chart */}
        <View style={styles.summaryCardsContainer}>
          {summaryMetrics.map((item) => (
            <View key={item.key} style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {legendLabels[item.key] || item.key.charAt(0).toUpperCase() + item.key.slice(1)}
              </Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryValue}>
                  {item.avg} {yLabel}
                </Text>
                <View style={styles.trendIndicator}>
                  <AntDesign 
                    name={item.trend === "up" ? "arrowup" : item.trend === "down" ? "arrowdown" : "minus"} 
                    size={12} 
                    color={getTrendColor(item.trend, item.metric)} 
                  />
                </View>
              </View>
              <Text style={styles.summarySubtitle}>
                Avg. per {reportRange === "Weekly" ? "day" : reportRange === "Monthly" ? "week" : "month"}
              </Text>
            </View>
          ))}
        </View>

        {/* Main chart */}
        {chartType === "line" && data.lineData && (
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
            withInnerLines={true}
            withOuterLines={true}
            withVerticalLines={false}
            withHorizontalLines={true}
            withDots={true}
            onDataPointClick={showDataLabels ? handleDataPointClick : undefined}
          />
        )}

        {chartType === "bar" && data.barData && (
          <BarChart
            data={data.barData}
            width={adjustedWidth}
            height={220}
            yAxisLabel=""
            yAxisSuffix={yLabel}
            fromZero
            chartConfig={{
              ...chartConfig,
              paddingLeft: 40,
              barPercentage: 0.7,
            }}
            style={styles.chart}
            withInnerLines={true}
            showBarTops={true}
            showValuesOnTopOfBars={showDataLabels}
          />
        )}
        
        <View style={styles.legendContainer}>
          {getLegend(activeTab === 'Diaper' ? data.barData : data.lineData)}
          
          {/* Option to toggle data labels */}
          <TouchableOpacity 
            style={styles.dataLabelToggle}
            onPress={() => setShowDataLabels(!showDataLabels)}
          >
            <Text style={styles.dataLabelText}>
              {showDataLabels ? "Hide Values" : "Show Values"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Additional charts based on tab */}
        {activeTab === 'Sleep' && data.timeDistribution && data.timeDistribution.length > 0 && (
          <View style={styles.additionalChartContainer}>
            <Text style={styles.sectionTitle}>Common Sleep Times</Text>
            <PieChart
              data={data.timeDistribution}
              width={adjustedWidth}
              height={200}
              chartConfig={chartConfig}
              accessor="count"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>
        )}

        {activeTab === 'Feeding' && data.typeDistribution && data.typeDistribution.length > 0 && (
          <View style={styles.additionalChartContainer}>
            <Text style={styles.sectionTitle}>Feeding Type Distribution</Text>
            <PieChart
              data={data.typeDistribution}
              width={adjustedWidth}
              height={200}
              chartConfig={chartConfig}
              accessor="count"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <LinearGradient colors={[colors.background, colors.surface]} style={styles.gradient}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={[styles.backText, { color: colors.primary }]}>← Dashboard</Text>
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Image source={require('../assets/logo.png')} style={styles.logo} />
          </View>
          <View style={styles.headerRightSpace} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{name ? `${name}'s Reports` : 'Reports'}</Text>

        {/* Time period toggle */}
        <View style={[styles.toggleContainer, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              reportRange === 'Weekly' && [styles.activeToggle, { backgroundColor: colors.primary }],
            ]}
            onPress={() => setReportRange('Weekly')}
          >
            <Text
              style={[
                styles.toggleText,
                reportRange === 'Weekly' && [styles.activeToggleText, { color: colors.onPrimary }],
              ]}
            >
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              reportRange === 'Monthly' && [styles.activeToggle, { backgroundColor: colors.primary }],
            ]}
            onPress={() => setReportRange('Monthly')}
          >
            <Text
              style={[
                styles.toggleText,
                reportRange === 'Monthly' && [styles.activeToggleText, { color: colors.onPrimary }],
              ]}
            >
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              reportRange === 'Annual' && [styles.activeToggle, { backgroundColor: colors.primary }],
            ]}
            onPress={() => setReportRange('Annual')}
          >
            <Text
              style={[
                styles.toggleText,
                reportRange === 'Annual' && [styles.activeToggleText, { color: colors.onPrimary }],
              ]}
            >
              Year
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab selection */}
        <View style={[styles.tabContainer, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'Sleep' && [styles.activeTab, { backgroundColor: colors.primary }],
            ]}
            onPress={() => setActiveTab('Sleep')}
          >
            <Ionicons
              name="bed-outline"
              size={20}
              color={activeTab === 'Sleep' ? colors.onPrimary : colors.text}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'Sleep' && [styles.activeTabText, { color: colors.onPrimary }],
              ]}
            >
              Sleep
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'Feeding' && [styles.activeTab, { backgroundColor: colors.primary }],
            ]}
            onPress={() => setActiveTab('Feeding')}
          >
            <Ionicons
              name="restaurant-outline"
              size={20}
              color={activeTab === 'Feeding' ? colors.onPrimary : colors.text}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'Feeding' && [styles.activeTabText, { color: colors.onPrimary }],
              ]}
            >
              Feeding
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'Diaper' && [styles.activeTab, { backgroundColor: colors.primary }],
            ]}
            onPress={() => setActiveTab('Diaper')}
          >
            <Ionicons
              name="water-outline"
              size={20}
              color={activeTab === 'Diaper' ? colors.onPrimary : colors.text}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'Diaper' && [styles.activeTabText, { color: colors.onPrimary }],
              ]}
            >
              Diaper
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={[styles.scrollView, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.scrollViewContent}
        >
          {renderCharts()}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

// Add export report functionality
const ExportReportSection = () => {
  const handleExport = (type) => {
    Alert.alert(
      'Export Report',
      `Report will be exported as ${type}`,
      [{ text: 'OK' }]
    );
    // Implementation for actual export functionality would go here
  };

  return (
    <View style={styles.exportContainer}>
      <Text style={styles.exportTitle}>Export Report</Text>
      <View style={styles.exportOptionsRow}>
        <TouchableOpacity 
          style={styles.exportOption}
          onPress={() => handleExport('PDF')}
        >
          <AntDesign name="pdffile1" size={18} color="#E53935" style={styles.exportOptionIcon} />
          <Text style={styles.exportOptionText}>PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.exportOption}
          onPress={() => handleExport('Excel')}
        >
          <AntDesign name="fileexcel" size={18} color="#2E7D32" style={styles.exportOptionIcon} />
          <Text style={styles.exportOptionText}>Excel</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity 
        style={styles.exportButton}
        onPress={() => handleExport('Share')}
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
            <Ionicons name={insight.icon} size={16} color="#1976d2" />
          </View>
          <View style={styles.insightContent}>
            <Text style={styles.insightText}>{insight.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};



const styles = StyleSheet.create({
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
  },
  backText: {
    color: '#1976d2',
    fontSize: 16,
    fontWeight: '500',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  headerRightSpace: {
    width: 80, // Balance the back button
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
  // Export report section
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
});

export default ReportPage;