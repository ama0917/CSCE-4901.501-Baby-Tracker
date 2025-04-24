import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, TouchableOpacity, ScrollView, Alert, StyleSheet, SafeAreaView, Platform, StatusBar, Image, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AntDesign, Feather, FontAwesome } from '@expo/vector-icons';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig'; 
import { format, subDays, startOfWeek, endOfWeek, subMonths, subYears, isWithinInterval, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays } from 'date-fns';

const screenWidth = Dimensions.get('window').width;

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
  paddingLeft: 40, // Increased padding to prevent y-axis label cutoff
  paddingTop: 15,
  formatYLabel: (value) => String(value),
  useShadowColorFromDataset: false,
};

const ReportsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { childId: initialChildId } = route.params || {};
  const [reportRange, setReportRange] = useState("Weekly");
  const [expandedSection, setExpandedSection] = useState("Feeding");
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [selectedChild, setSelectedChild] = useState(initialChildId || null);
  const [children, setChildren] = useState([]);


  useEffect(() => {
    if (!reportData && !isLoading) {
      setReportData({
        labels: [],
        feeding: { count: [], ounces: [] },
        diaper: { wet: [], bm: [] },
        sleeping: { nighttime: [], naps: [] },
        rawData: { feeding: [], diaper: [], sleep: [] }
      });
    }
  }, [reportData, isLoading]);

  // Use useEffect to fetch data when component mounts or filters change
  useEffect(() => {
    const fetchChildren = async () => {
      try {
        // Get current user to fetch only their children
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.error("No authenticated user");
          return;
        }

        // Query children collection to get children associated with current user
        const childrenRef = collection(db, "Children");
        const q = query(childrenRef, where("UserID", "==", currentUser.uid));
        const childrenSnapshot = await getDocs(q);
        
        const childrenData = childrenSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setChildren(childrenData);
        
        // Set default selected child if available
        if (childrenData.length > 0 && !selectedChild) {
          setSelectedChild(childrenData[0].id);
        }
      } catch (error) {
        console.error("Error fetching children: ", error);
        Alert.alert("Error", "Failed to load children data.");
      }
    };

    fetchChildren();
  }, []);

  // Fetch report data whenever selectedChild or reportRange changes
  useEffect(() => {
    if (selectedChild) {
      fetchReportData(selectedChild, reportRange);
    }
  }, [selectedChild, reportRange]);

  const fetchReportData = async (childId, range) => {
    setIsLoading(true);
  
    try {
      const today = new Date();
      let startDate, endDate, labels;
  
      if (range === "Weekly") {
        startDate = startOfWeek(today, { weekStartsOn: 1 });
        endDate = endOfWeek(today, { weekStartsOn: 1 });
        labels = Array.from({ length: 7 }, (_, i) =>
          format(new Date(startDate.getTime() + i * 86400000), 'EEE')
        );
      } else if (range === "Monthly") {
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        const weeks = Math.ceil((endDate.getDate() - startDate.getDate() + 1) / 7);
        labels = Array.from({ length: weeks }, (_, i) => `Wk${i + 1}`);
      } else {
        startDate = startOfYear(today);
        endDate = endOfYear(today);
        labels = Array.from({ length: 12 }, (_, i) =>
          format(new Date(today.getFullYear(), i, 1), 'MMM').charAt(0)
        );
      }
  
      const data = {
        labels,
        feeding: {
          count: Array(labels.length).fill(0),
        },
        rawData: {
          feeding: [],
        },
        summary: {
          feeding: {
            byMealType: {},
            byFoodType: {}
          }
        }
      };
  
      const feedQuery = query(
        collection(db, 'feedLogs'),
        where('childId', '==', childId),
        where('timestamp', '>=', startDate),
        where('timestamp', '<=', endDate),
        orderBy('timestamp', 'asc')
      );
  
      const feedSnapshot = await getDocs(feedQuery);
  
      feedSnapshot.forEach(doc => {
        const log = doc.data();
        const feedTime = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
        data.rawData.feeding.push({ ...log, FeedTime: feedTime });
  
        // Determine index for current log
        let index = 0;
        if (range === "Weekly") {
          index = Math.floor((feedTime - startDate) / 86400000);
        } else if (range === "Monthly") {
          index = Math.floor((feedTime.getDate() - 1) / 7);
        } else {
          index = feedTime.getMonth();
        }
  
        if (index >= 0 && index < labels.length) {
          data.feeding.count[index]++;
        }
  
        // Count mealType
        const mealType = log.mealType || 'Other';
        if (data.summary.feeding.byMealType[mealType]) {
          data.summary.feeding.byMealType[mealType]++;
        } else {
          data.summary.feeding.byMealType[mealType] = 1;
        }
  
        // Count foodType
        const foodType = log.feedType || 'Other';
        if (data.summary.feeding.byFoodType[foodType]) {
          data.summary.feeding.byFoodType[foodType]++;
        } else {
          data.summary.feeding.byFoodType[foodType] = 1;
        }
      });
  
      setReportData(data);
    } catch (error) {
      console.error("Error fetching report data: ", error);
      Alert.alert("Error", "Failed to load report data.");
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };
  

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Select the appropriate chart type based on data and time range
  const chooseChartType = (title) => {
    // Use bar charts for comparative data (feeding, diaper) and line charts for trend data (sleep)
    if (title === "Sleeping") {
      return "line";
    } else if (reportRange === "Weekly") {
      return "line"; // Line charts work well for small data sets
    } else {
      return "bar"; // Bar charts are better for comparing across larger time periods
    }
  };

  // Calculate combined wet+BM total for each date point
  const getCombinedDiaperCounts = () => {
    if (!reportData) return [];
    return reportData.diaper.wet.map((wetCount, index) => 
      wetCount + reportData.diaper.bm[index]
    );
  };

  // Get trend indicators for summary cards
  const getTrend = (dataSet) => {
    if (!dataSet || dataSet.length < 2) return "neutral";
    
    const lastValue = dataSet[dataSet.length - 1];
    const previousValue = dataSet[dataSet.length - 2];
    
    if (lastValue > previousValue) return "up";
    if (lastValue < previousValue) return "down";
    return "neutral";
  };

  // Get color based on trend (contextual - depends on what's being measured)
  const getTrendColor = (trend, metric) => {
    // For sleep and feeding, more is generally better
    if (metric === "sleep" || metric === "feeding") {
      if (trend === "up") return "#4caf50";
      if (trend === "down") return "#f57c00"; 
    } 
    // For diapers, it depends on context but we're neutral here
    else {
      if (trend === "up") return "#f57c00";
      if (trend === "down") return "#4caf50";
    }
    return "#9e9e9e"; // neutral color
  };

  const renderChart = (title, datasets, yLabel, colors = ['#1976d2', '#4caf50']) => {
    if (expandedSection !== title || !reportData) return null;
    
    const adjustedWidth = screenWidth - 40;
    const chartType = chooseChartType(title);
    
    // Special handling for diaper section to add Wet+BM dataset
    let displayDatasets = {...datasets};
    let displayColors = [...colors];
    
    if (title === "Diaper Changes/Potty") {
      // Add the combined total as a third dataset
      displayDatasets = {
        ...datasets,
        "wet+bm": getCombinedDiaperCounts()
      };
      displayColors = [...colors, '#7b1fa2']; // Add a third color for the combined data
    }
    
    const chartData = {
      labels: reportData.labels,
      datasets: Object.entries(displayDatasets).map(([key, data], index) => ({
        data,
        color: () => displayColors[index % displayColors.length],
        strokeWidth: 2,
      }))
    };
    
    // Create the legend for the chart
    const legendLabels = {
      "count": "Feedings",
      "ounces": "Ounces",
      "wet": "Wet",
      "bm": "BM",
      "wet+bm": "Wet+BM",
      "nighttime": "Nighttime",
      "naps": "Naps"
    };
    
    const legend = Object.keys(displayDatasets).map((key, index) => (
      <View key={key} style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: displayColors[index % displayColors.length] }]} />
        <Text style={styles.legendText}>{legendLabels[key] || key.charAt(0).toUpperCase() + key.slice(1)}</Text>
      </View>
    ));

    // Calculate summary metrics for this section
    const summaryMetrics = Object.entries(displayDatasets).map(([key, data]) => {
      const total = data.reduce((sum, val) => sum + val, 0);
      const avg = (total / data.length).toFixed(1);
      const trend = getTrend(data);
      let metric = title.toLowerCase();
      
      return { key, avg, trend, metric };
    });

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

        {/* Render either a line chart or bar chart based on data type */}
        {chartType === "line" ? (
          <LineChart
            data={chartData}
            width={adjustedWidth}
            height={220}
            yAxisLabel=""
            yAxisSuffix={yLabel}
            fromZero
            chartConfig={{
              ...chartConfig,
              paddingLeft: 40, // Increased to prevent y-axis labels being cut off
            }}
            bezier
            style={styles.chart}
            withInnerLines={true}
            withOuterLines={true}
            withVerticalLines={false}
            withHorizontalLines={true}
            withDots={true}
          />
        ) : (
          <BarChart
            data={chartData}
            width={adjustedWidth}
            height={220}
            yAxisLabel=""
            yAxisSuffix={yLabel}
            fromZero
            chartConfig={{
              ...chartConfig,
              paddingLeft: 40, // Increased to prevent y-axis labels being cut off
              barPercentage: 0.7,
            }}
            style={styles.chart}
            withInnerLines={true}
            showBarTops={true}
            showValuesOnTopOfBars={showDataLabels}
          />
        )}
        
        <View style={styles.legendContainer}>
          {legend}
          
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
      </View>
    );
  };

  const handleDownloadExcel = async () => {
    if (!reportData || !selectedChild) {
      Alert.alert("Error", "No report data available to export");
      return;
    }
    
    try {
      // Find selected child name
      const childInfo = children.find(child => child.id === selectedChild);
      const childName = childInfo ? childInfo.Name : "Unknown";
      
      // Format date for filename
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      
      // Convert report data into CSV format
      let csv = `Baby Tracker Report for ${childName}\n`;
      csv += `Report Range: ${reportRange}\n`;
      csv += `Generated on: ${format(new Date(), 'MMMM d, yyyy')}\n\n`;
      
      // FEEDING DATA
      csv += "=== FEEDING DATA ===\n";
      csv += "Date,Feeding Count,Feeding Ounces\n";
      reportData.labels.forEach((label, index) => {
        csv += `${label},${reportData.feeding.count[index]},${reportData.feeding.ounces[index].toFixed(1)}\n`;
      });
      
      // Add feeding logs details
      csv += "\nFeeding Logs Details:\n";
      csv += "Date,Time,Type,Amount (oz),Notes\n";
      
      reportData.rawData.feeding.forEach(log => {
        const dateStr = format(log.FeedTime, 'yyyy-MM-dd');
        const timeStr = format(log.FeedTime, 'HH:mm');
        
        csv += `${dateStr},${timeStr},"${log.FoodType || ''}",${log.Amount || 0},"${log.Notes || ''}"\n`;
      });
      
      // DIAPER DATA
      csv += "\n=== DIAPER/POTTY DATA ===\n";
      csv += "Date,Wet Diapers,BM Diapers,Total Diapers\n";
      reportData.labels.forEach((label, index) => {
        const wetCount = reportData.diaper.wet[index];
        const bmCount = reportData.diaper.bm[index];
        const totalCount = wetCount + bmCount;
        csv += `${label},${wetCount},${bmCount},${totalCount}\n`;
      });
      
      // Add diaper logs details
      csv += "\nDiaper/Potty Logs Details:\n";
      csv += "Date,Time,Type,Notes\n";
      
      reportData.rawData.diaper.forEach(log => {
        const dateStr = format(log.EndTime, 'yyyy-MM-dd');
        const timeStr = format(log.EndTime, 'HH:mm');
        
        csv += `${dateStr},${timeStr},"${log.StoolType || ''}","${log.Notes || ''}"\n`;
      });
      
      // SLEEP DATA
      csv += "\n=== SLEEP DATA ===\n";
      csv += "Date,Nighttime Sleep (hrs),Naps (hrs),Total Sleep (hrs)\n";
      reportData.labels.forEach((label, index) => {
        const nightSleep = reportData.sleeping.nighttime[index];
        const napSleep = reportData.sleeping.naps[index];
        const totalSleep = nightSleep + napSleep;
        
        csv += `${label},${nightSleep.toFixed(1)},${napSleep.toFixed(1)},${totalSleep.toFixed(1)}\n`;
      });
      
      // Add sleep logs details
      csv += "\nSleep Logs Details:\n";
      csv += "Date,Start Time,End Time,Duration (hrs),Type,Notes\n";
      
      reportData.rawData.sleep.forEach(log => {
        const dateStr = format(log.StartTime, 'yyyy-MM-dd');
        const startTimeStr = format(log.StartTime, 'HH:mm');
        const endTimeStr = format(log.EndTime, 'HH:mm');
        const sleepType = log.StartTime.getHours() >= 20 || log.StartTime.getHours() < 6 ? "Nighttime" : "Nap";
        
        csv += `${dateStr},${startTimeStr},${endTimeStr},${log.DurationHours.toFixed(1)},"${sleepType}","${log.Notes || ''}"\n`;
      });

      // Save to local file
      const fileUri = FileSystem.documentDirectory + `BabyTracker_${childName}_${reportRange}_${dateStr}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Share the file
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing not available on this device");
        return;
      }

      await Sharing.shareAsync(fileUri);
    } catch (error) {
      console.error("Error exporting data:", error);
      Alert.alert("Export Error", "Failed to generate export file.");
    }
  };

  const renderSectionHeader = (title) => {
    const isExpanded = expandedSection === title;
    
    return (
      <TouchableOpacity 
        style={[styles.sectionHeader, isExpanded && styles.sectionHeaderActive]} 
        onPress={() => toggleSection(title)}
      >
        <View style={styles.sectionHeaderContent}>
          {/* Add appropriate icon for each section */}
          <View style={styles.sectionIconContainer}>
            <FontAwesome 
              name={
                title === "Feeding" ? "spoon" : 
                title === "Sleeping" ? "moon-o" : "baby"
              } 
              size={18} 
              color="#1976d2" 
            />
          </View>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <AntDesign 
          name={isExpanded ? "caretdown" : "caretright"} 
          size={18} 
          color="#555" 
        />
      </TouchableOpacity>
    );
  };

  // Child selector component
  const renderChildSelector = () => {
    if (children.length === 0) return null;
    
    return (
      <View style={styles.childSelectorContainer}>
        <Text style={styles.childSelectorLabel}>Select Child:</Text>
        <View style={styles.childButtonsContainer}>
          {children.map(child => (
            <TouchableOpacity
              key={child.id}
              style={[
                styles.childButton,
                selectedChild === child.id && styles.childButtonActive
              ]}
              onPress={() => setSelectedChild(child.id)}
            >
              <Text 
                style={[
                  styles.childButtonText,
                  selectedChild === child.id && styles.childButtonTextActive
                ]}
              >
                {child.Name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0f9ff" />
      <View style={styles.container}>
        {/* Improved header with centered logo and title */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back to dashboard"
            accessible={true}
          >
            <AntDesign name="arrowleft" size={24} color="#1976d2" />
            <Text style={styles.backText}> Dashboard</Text>
          </TouchableOpacity>
          
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          
          {/* Empty view to balance the header */}
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.screenTitle}>Reports & Analytics</Text>

        {/* Child selector */}
        {renderChildSelector()}

        {/* Time range selector */}
        <View style={styles.reportTypeContainer}>
          {["Weekly", "Monthly", "Annually"].map((range) => (
            <TouchableOpacity
              key={range}
              onPress={() => setReportRange(range)}
              style={[
                styles.reportTypeButton,
                reportRange === range && styles.reportTypeButtonActive
              ]}
              accessibilityLabel={`${range} report type`}
              accessibilityState={{ selected: reportRange === range }}
            >
              <Text style={[
                styles.reportTypeText,
                reportRange === range && styles.reportTypeTextActive
              ]}>
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={styles.loadingText}>Loading report data...</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
            {/* Feeding Section */}
            {renderSectionHeader("Feeding")}
            {reportData && renderChart("Feeding", 
              { count: reportData.feeding.count, ounces: reportData.feeding.ounces },
              "oz",
              ['#1976d2', '#f57c00']
            )}

            {/* Sleeping Section */}
            {renderSectionHeader("Sleeping")}
            {reportData && renderChart("Sleeping", 
              { nighttime: reportData.sleeping.nighttime, naps: reportData.sleeping.naps }, 
              "hrs",
              ['#5e35b1', '#8e24aa']
            )}

            {/* Diaper Changes Section */}
            {renderSectionHeader("Diaper Changes/Potty")}
            {reportData && renderChart("Diaper Changes/Potty", 
              { wet: reportData.diaper.wet, bm: reportData.diaper.bm },
              "",
              ['#00897b', '#43a047']
            )}

            {/* Generate Reports Section */}
            <View style={styles.generateSection}>
              <Text style={styles.generateTitle}>Export Data</Text>
              <Text style={styles.generateSubtitle}>Download your data in CSV format</Text>
              
              <TouchableOpacity
                onPress={handleDownloadExcel}
                style={styles.downloadButton}
                accessibilityLabel="Download CSV Report"
              >
                <Feather name="download" size={18} color="#2e7d32" style={styles.downloadIcon} />
                <Text style={styles.downloadText}>Download CSV Report</Text>
              </TouchableOpacity>
            </View>
            
            {/* Add extra space at bottom to ensure content doesn't get cut off */}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f9ff',
    // Handle iOS notch and status bar
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#f0f9ff',
  },
  backButton: {
    padding: 8, // Larger touch target
    zIndex: 1,
  },
  backText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#1976d2',
  },
  logoContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    height: 70,
    width: 70,
  },
  headerSpacer: {
    width: 40, // Match the width of the back button for balance
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 16,
    textAlign: 'center',
    color: '#1976d2',
  },
  // Child selector styles
  childSelectorContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  childSelectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  childButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  childButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  childButtonActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
  },
  childButtonText: {
    fontSize: 14,
    color: '#666',
  },
  childButtonTextActive: {
    color: '#1976d2',
    fontWeight: 'bold',
  },
  // Time range selector styles
  reportTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  reportTypeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 4,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  reportTypeButtonActive: {
    backgroundColor: '#e3f2fd',
    borderBottomWidth: 2,
    borderBottomColor: '#1976d2',
  },
  reportTypeText: {
    fontSize: 14,
    color: '#666',
  },
  reportTypeTextActive: {
    color: '#1976d2',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollViewContent: {
    paddingBottom: 40, // Extra space at bottom
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeaderActive: {
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#bbdefb',
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIconContainer: {
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1976d2',
  },
  // Summary cards for quick metrics
  summaryCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    minWidth: 100, // Reduced to fit more cards
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    marginBottom: 8,
    marginHorizontal: 4, // Added horizontal margin for spacing
  },
  summaryTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  trendIndicator: {
    marginLeft: 6,
  },
  summarySubtitle: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    // Add padding to ensure chart labels aren't cut off
    paddingHorizontal: 5,
  },
  chart: {
    borderRadius: 10,
    paddingRight: 20, // Added padding to prevent label cutoff
    marginLeft: 10, // Added margin to shift the chart right
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    flexWrap: 'wrap', // Allow wrapping for small screens
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 5,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#555',
  },
  dataLabelToggle: {
    marginLeft: 16,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dataLabelText: {
    fontSize: 10,
    color: '#665',
  },
  generateSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  generateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  generateSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  downloadButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingVertical: 12,
    borderRadius: 10,
  },
  downloadIcon: {
    marginRight: 8,
  },
  downloadText: {
    fontWeight: '600',
    color: '#2e7d32',
  },
  bottomSpacer: {
    height: 40,
  }
});

export default ReportsScreen;