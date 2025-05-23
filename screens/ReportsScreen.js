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
  Alert,
} from 'react-native';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
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

const { width } = Dimensions.get('window');
const adjustedWidth = width - 40;

const ReportPage = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { childId, name } = route.params || {};

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
    backgroundGradientFrom: "#f0f9ff",
    backgroundGradientTo: "#f0f9ff",
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
    labelColor: () => '#555',
    propsForLabels: {
      fontSize: 10,
      fontWeight: '500',
    },
    propsForDots: {
      r: "4",
      strokeWidth: "1",
      stroke: "#1976d2"
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
    now.setHours(0, 0, 0, 0); // Normalize to start of day
    const startDate = new Date(now);
    
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
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
    const now = new Date();
    const currentMonth = now.getMonth();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), i, 1);
      months.push(date.toLocaleDateString('en-US', { month: 'short' }));
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
        
        const startTimestamp = Timestamp.fromDate(new Date(start.setHours(0, 0, 0, 0)));
        const endTimestamp = Timestamp.fromDate(new Date(end.setHours(23, 59, 59, 999)));
        
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
    
    const durationData = Array(periodLabels.length).fill(0);
    const countData = Array(periodLabels.length).fill(0);
    
    sleepData.forEach(log => {
      // Consistent date conversion
      const logDate = log.timestamp.toDate();
      
      let index;
      
      if (reportRange === 'Weekly') {
        // Calculate days ago (0-6)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(today - logDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        index = 6 - Math.min(diffDays, 6);
      } else if (reportRange === 'Monthly') {
        // Calculate week index (0-3)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(today - logDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        index = 3 - Math.min(Math.floor(diffDays / 7), 3);
      } else {
        // Annual view - month index (0-11)
        index = logDate.getMonth();
      }
      
      // Make sure the index is valid
      if (index >= 0 && index < durationData.length) {
        if (log.duration) {
          durationData[index] += log.duration / 60;
          countData[index]++;
        }
      }
    });
    
    // Rest of the function remains the same
    const avgDurationData = durationData.map((total, i) => 
      countData[i] ? parseFloat((total / countData[i]).toFixed(1)) : 0
    );
    
    const totalDuration = durationData.reduce((sum, val) => sum + val, 0);
    const totalCount = countData.reduce((sum, val) => sum + val, 0);
    const avgDuration = totalCount ? parseFloat((totalDuration / totalCount).toFixed(1)) : 0;
    
    const timeDistribution = {};
    sleepData.forEach(log => {
      const startHour = log.timestamp.toDate().getHours();
      timeDistribution[startHour] = (timeDistribution[startHour] || 0) + 1;
    });
    
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
    
    // Initialize datasets
    const wetCount = Array(periodLabels.length).fill(0);
    const bmCount = Array(periodLabels.length).fill(0);
    const wetBmCount = Array(periodLabels.length).fill(0);
    const dryCount = Array(periodLabels.length).fill(0);
    
    diaperData.forEach(log => {
      // Consistent date conversion without timezone issues
      const logDate = new Date(log.time.seconds * 1000);
      logDate.setHours(0, 0, 0, 0); // Normalize to start of day
      
      let index;
      
      if (reportRange === 'Weekly') {
        // Calculate day index normalized
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(today - logDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        index = 6 - Math.min(diffDays, 6); // Ensure it's within bounds 0-6
      } else if (reportRange === 'Monthly') {
        // Calculate week index normalized
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(today - logDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        index = 3 - Math.min(Math.floor(diffDays / 7), 3); // Ensure it's within bounds 0-3
      } else {
        // For annual view, use month index directly
        index = logDate.getMonth();
      }
      
      // Make sure the index is valid
      if (index >= 0 && index < wetCount.length) {
        // Debug to check what stool types we're receiving
        console.log("Stool type:", log.stoolType);
        
        // Increment based on stool type (case-insensitive comparison)
        const type = (log.stoolType || '').toLowerCase().replace(/\s+/g, '');
        if (type.includes('wet') && type.includes('bm')) {
          wetBmCount[index]++;
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
    // Total each type
    const totalWet = wetCount.reduce((sum, val) => sum + val, 0);
    const totalBM = bmCount.reduce((sum, val) => sum + val, 0);
    const totalWetBM = wetBmCount.reduce((sum, val) => sum + val, 0);
    const totalDry = dryCount.reduce((sum, val) => sum + val, 0);
    const totalChanges = totalWet + totalBM + totalWetBM + totalDry;
    
    // Average per time period
    const divisor = reportRange === 'Weekly' ? 7 : reportRange === 'Monthly' ? 4 : 12;
    const avgChanges = parseFloat((totalChanges / divisor).toFixed(1));

    // Ensure no negative values in any diaper data
    const sanitize = (arr) => arr.map(val => Math.max(0, val));

    const sanitizedWetCount = sanitize(wetCount);
    const sanitizedBmCount = sanitize(bmCount);
    const sanitizedWetBmCount = sanitize(wetBmCount);
    const sanitizedDryCount = sanitize(dryCount);

    // Create a dummy 'Base' array of all zeros
    const baseZeroArray = new Array(periodLabels.length).fill(0);

    return {
      series: [
        { name: "Base", data: baseZeroArray }, // Invisible stabilizer
        { name: "Wet", data: sanitizedWetCount },
        { name: "BM", data: sanitizedBmCount },
        { name: "Wet + BM", data: sanitizedWetBmCount },
        { name: "Dry", data: sanitizedDryCount }
      ],
      options: {
        xaxis: {
          categories: periodLabels
        }
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
    
    const feedingCounts = Array(periodLabels.length).fill(0);
    const feedTimestamps = [];
    const feedingMethodCounts = {};
    const hourBuckets = new Array(24).fill(0);
  
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
      }
    });
  
    // Calculate average gap
    let averageGapMinutes = 0;
    if (feedTimestamps.length >= 2) {
      feedTimestamps.sort((a, b) => a - b);
      let totalGap = 0;
      for (let i = 1; i < feedTimestamps.length; i++) {
        totalGap += (feedTimestamps[i] - feedTimestamps[i - 1]) / (1000 * 60);
      }
      averageGapMinutes = totalGap / (feedTimestamps.length - 1);
    }
  
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
  
    return {
      summary: [
        { key: 'totalFeedings', value: feedingData.length },
        { key: 'averageGap', value: averageGapMinutes },
        { key: 'mostCommonTime', value: mostCommonHour },
        { key: 'mostUsedMethod', value: mostUsedMethod },
      ],
      lineData: {
        labels: periodLabels,
        datasets: [
          {
            data: feedingCounts,
            color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`, // Orange color
            strokeWidth: 2,
          }
        ],
        legend: ["Feedings"],
      },
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


  const exportReportAsPDF = async () => {
    try {
      const date = new Date().toLocaleDateString();
      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial; padding: 20px; }
              h1 { color: #1976d2; text-align: center; }
              .section { margin-top: 20px; }
              .title { font-size: 18px; font-weight: bold; color: #333; }
              .entry { margin: 5px 0; font-size: 14px; color: #444; }
            </style>
          </head>
          <body>
            <h1>${name || "Child"}'s Report (${reportRange})</h1>
  
            <div class="section">
              <div class="title">Feeding Logs</div>
              ${feedingData.map(log => `
                <div class="entry">• ${new Date(log.timestamp.toDate()).toLocaleString()} - ${log.amount || '?'}ml (${log.feedType || 'N/A'})</div>
              `).join('')}
            </div>
  
            <div class="section">
              <div class="title">Sleep Logs</div>
              ${sleepData.map(log => `
                <div class="entry">• ${new Date(log.timestamp.toDate()).toLocaleString()} - ${log.duration || '?'} mins</div>
              `).join('')}
            </div>
  
            <div class="section">
              <div class="title">Diaper Logs</div>
              ${diaperData.map(log => `
                <div class="entry">• ${new Date(log.time.toDate()).toLocaleString()} - ${log.stoolType || 'Unknown'}</div>
              `).join('')}
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
      ["Timestamp", "Amount", "Unit", "Type"], // Header
      ...feedingData.map(log => [
        new Date(log.timestamp.toDate()).toLocaleString(),
        log.amount || '?',
        log.unit || 'ml', // Show 'ml', 'oz', 'cups', etc.
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
    const uri = FileSystem.cacheDirectory + `${name || 'Child'}_Report.xlsx`;

    await FileSystem.writeAsStringAsync(uri, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await Sharing.shareAsync(uri);
  } catch (err) {
    console.error('Excel Export Error:', err);
    Alert.alert('Error', 'Failed to export Excel file.');
  }
};

  
  // Generate legend items

  const getLegend = (chartData) => {
    if (!chartData?.datasets) return null;
  
    if (chartData.legend && Array.isArray(chartData.legend)) {
      return (
        <View style={styles.legendRow}>
          {chartData.legend.map((legendItem, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendColor, { 
                backgroundColor: chartData.datasets[index]?.color?.(1) || '#1976d2' 
              }]} />
              <Text style={styles.legendText}>
                {legendItem}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    return (
      <View style={styles.legendRow}>
        {chartData.datasets.map((dataset, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: dataset.color?.(1) || '#1976d2' }]} />
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
    
    const legendLabels = {
      'duration': 'Sleep Duration',
      'count': 'Nap Duration',
      'changes': 'Diaper Changes',
      'wet': 'Wet Diapers',
      'bm': 'BM Diapers',
      'amount': 'Feeding Amount',
      'feedings': 'Feeding Count'
    };
  
    const summaryMetrics = data.summary || [];
  
    return (
      <View style={styles.chartContainer}>
  
        {/* Summary cards */}
        {activeTab === 'Feeding' ? (
          renderFeedingSummary(data.summary)
        ) : (
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
                  {`Avg. per ${reportRange === "Weekly" ? "day" : reportRange === "Monthly" ? "week" : "month"}`}
                </Text>
              </View>
            ))}
          </View>
        )}
  
        {/* Line Chart */}
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
  
        {/* Bar Chart */}
        {chartType === "bar" && activeTab === 'Diaper' && data.series && (
          <StackedBarChart 
            series={data.series} 
            categories={data.options?.xaxis?.categories || []} 
            height={300}
          />
        )}
  
        {/* Legend */}
        <View style={styles.legendContainer}>
          {getLegend(activeTab === 'Diaper' ? data.barData : data.lineData)}
          <TouchableOpacity 
            style={styles.dataLabelToggle}
            onPress={() => setShowDataLabels(!showDataLabels)}
          >
            <Text style={styles.dataLabelText}>
              {showDataLabels ? "Hide Values" : "Show Values"}
            </Text>
          </TouchableOpacity>
        </View>
  
        {/* Additional Charts */}
        {activeTab === 'Sleep' && data.timeDistribution && data.timeDistribution.length > 0 && (
          <View style={styles.additionalChartContainer}>
            <Text style={styles.sectionTitle}>Common Sleep and Nap Times</Text>
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
    <LinearGradient colors={['#B2EBF2', '#FCE4EC']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>← Dashboard</Text>
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/logo.png')} 
              style={styles.logo}
            />
          </View>
          <View style={styles.headerRightSpace} />
        </View>

        <Text style={styles.title}>{`${name || 'Child'}'s Reports`}</Text>

        {/* Time period toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, reportRange === 'Weekly' && styles.activeToggle]}
            onPress={() => setReportRange('Weekly')}
          >
            <Text style={[styles.toggleText, reportRange === 'Weekly' && styles.activeToggleText]}>
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, reportRange === 'Monthly' && styles.activeToggle]}
            onPress={() => setReportRange('Monthly')}
          >
            <Text style={[styles.toggleText, reportRange === 'Monthly' && styles.activeToggleText]}>
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, reportRange === 'Annual' && styles.activeToggle]}
            onPress={() => setReportRange('Annual')}
          >
            <Text style={[styles.toggleText, reportRange === 'Annual' && styles.activeToggleText]}>
              Year
            </Text>
          </TouchableOpacity>
        </View>

        
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Sleep' && styles.activeTab]}
            onPress={() => setActiveTab('Sleep')}
          >
            <Ionicons 
              name="bed-outline" 
              size={20} 
              color={activeTab === 'Sleep' ? '#1976d2' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'Sleep' && styles.activeTabText]}>
              Sleep
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Feeding' && styles.activeTab]}
            onPress={() => setActiveTab('Feeding')}
          >
            <Ionicons 
              name="restaurant-outline" 
              size={20} 
              color={activeTab === 'Feeding' ? '#1976d2' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'Feeding' && styles.activeTabText]}>
              Feeding
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Diaper' && styles.activeTab]}
            onPress={() => setActiveTab('Diaper')}
          >
            <Ionicons 
              name="water-outline" 
              size={20} 
              color={activeTab === 'Diaper' ? '#1976d2' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'Diaper' && styles.activeTabText]}>
              Diaper
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
          {renderCharts()}
        </ScrollView> 

        <ExportReportSection 
          exportReportAsPDF={exportReportAsPDF} 
          exportReportAsExcel={exportReportAsExcel} 
        />
      </SafeAreaView>
    </LinearGradient>
  );
};

// Add export report functionality
const ExportReportSection = ({ exportReportAsPDF, exportReportAsExcel }) => {
  const handleExport = (type) => {
    Alert.alert(
      'Export Report',
      `Report will be exported as ${type}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.exportContainer}>
      <Text style={styles.exportTitle}>Export Report</Text>
      <View style={styles.exportOptionsRow}>
      <TouchableOpacity 
        style={styles.exportOption}
        onPress={exportReportAsPDF}
      >
        <AntDesign
          name="pdffile1"
          size={18}
          color="#E53935"
          style={styles.exportOptionIcon}
        />
      <Text style={styles.exportOptionText}>PDF</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.exportOption}
        onPress={exportReportAsExcel}
      >
        <FontAwesome5
          name="file-excel"
          size={18}
          color="#2E7D32"
          style={styles.exportOptionIcon}
          />
        <Text style={styles.exportOptionText}>Excel</Text>
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
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 20,
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