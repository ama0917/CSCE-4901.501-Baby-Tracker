import React, { useState } from 'react';
import { View, Text, Dimensions, TouchableOpacity, ScrollView, Alert, StyleSheet, SafeAreaView, Platform, StatusBar, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AntDesign, Feather, FontAwesome } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

// Enhanced chart configuration with better margins and styling
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
  const [reportRange, setReportRange] = useState("Weekly");
  const [expandedSection, setExpandedSection] = useState("Feeding"); // Default expanded section
  const [showDataLabels, setShowDataLabels] = useState(false);

  const mockData = {
    Weekly: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      feeding: {
        count: [4, 5, 3, 4, 5, 6, 5],
        ounces: [20, 22, 18, 21, 24, 26, 23], // Changed from duration to ounces
      },
      diaper: {
        wet: [4, 5, 3, 5, 4, 5, 3],
        bm: [2, 3, 2, 4, 3, 2, 2], // Changed from soiled to bm
      },
      sleeping: {
        nighttime: [8, 7.5, 9, 8, 8.5, 7, 8.2],
        naps: [3.5, 4, 3, 3.5, 4.2, 3.8, 4.5]
      }
    },
    Monthly: {
      labels: ["Wk1", "Wk2", "Wk3", "Wk4"],
      feeding: {
        count: [30, 28, 32, 31],
        ounces: [150, 140, 160, 155], // Changed from duration to ounces
      },
      diaper: {
        wet: [28, 26, 30, 27],
        bm: [20, 18, 22, 19], // Changed from soiled to bm
      },
      sleeping: {
        nighttime: [58, 60, 56, 62],
        naps: [26, 28, 24, 27]
      }
    },
    Annually: {
      // Using short month names to prevent label cutoff
      labels: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
      feeding: {
        count: [120, 115, 125, 118, 122, 130, 126, 120, 115, 118, 124, 128],
        ounces: [600, 580, 620, 590, 610, 650, 630, 600, 570, 590, 620, 640], // Changed from duration to ounces
      },
      diaper: {
        wet: [112, 105, 115, 108, 114, 120, 118, 112, 106, 110, 116, 120],
        bm: [80, 75, 85, 79, 82, 88, 86, 80, 76, 82, 86, 90], // Changed from soiled to bm
      },
      sleeping: {
        nighttime: [240, 230, 250, 235, 245, 260, 255, 240, 235, 240, 250, 255],
        naps: [108, 104, 112, 106, 110, 116, 114, 108, 102, 106, 112, 115]
      }
    }
  };

  const current = mockData[reportRange];
  
  // Get trend indicators for summary cards
  const getTrend = (dataSet) => {
    if (dataSet.length < 2) return "neutral";
    
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
    return current.diaper.wet.map((wetCount, index) => 
      wetCount + current.diaper.bm[index]
    );
  };

  const renderChart = (title, datasets, yLabel, colors = ['#1976d2', '#4caf50']) => {
    if (expandedSection !== title) return null;
    
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
      labels: current.labels,
      datasets: Object.entries(displayDatasets).map(([key, data], index) => ({
        data,
        color: () => displayColors[index % displayColors.length],
        strokeWidth: 2,
      }))
    };
    
    // Create the legend for the chart
    const legendLabels = {
      "count": "Feedings",
      "ounces": "Ounces", // Changed from duration
      "wet": "Wet",
      "bm": "BM", // Changed from soiled
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
    // Convert mock data into CSV format
    let csv = `Baby Tracker Report (${reportRange})\n\n`;
    
    // Add Feeding Data
    csv += "Date,Feeding Count,Feeding Ounces\n"; // Changed from duration to ounces
    current.labels.forEach((label, index) => {
      csv += `${label},${current.feeding.count[index]},${current.feeding.ounces[index]}\n`; // Changed from duration to ounces
    });
    
    csv += "\nDate,Wet Diapers,BM Diapers,Total Diapers\n"; // Added Total column and changed soiled to BM
    current.labels.forEach((label, index) => {
      const wetCount = current.diaper.wet[index];
      const bmCount = current.diaper.bm[index]; // Changed from soiled to bm
      const totalCount = wetCount + bmCount;
      csv += `${label},${wetCount},${bmCount},${totalCount}\n`;
    });
    
    csv += "\nDate,Nighttime Sleep (hrs),Naps (hrs)\n";
    current.labels.forEach((label, index) => {
      csv += `${label},${current.sleeping.nighttime[index]},${current.sleeping.naps[index]}\n`;
    });

    // Save to local file
    const fileUri = FileSystem.documentDirectory + `Baby_Tracker_Report_${reportRange}.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Share the file
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert("Sharing not available on this device");
      return;
    }

    await Sharing.shareAsync(fileUri);
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

        {/* Time range selector moved to top for better UX */}
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

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
          {/* Feeding Section */}
          {renderSectionHeader("Feeding")}
          {renderChart("Feeding", 
            { count: current.feeding.count, ounces: current.feeding.ounces }, // Changed from duration to ounces
            "oz", // Added unit for ounces
            ['#1976d2', '#f57c00']
          )}

          {/* Sleeping Section */}
          {renderSectionHeader("Sleeping")}
          {renderChart("Sleeping", 
            { nighttime: current.sleeping.nighttime, naps: current.sleeping.naps }, 
            "hrs",
            ['#5e35b1', '#8e24aa']
          )}

          {/* Diaper Changes Section */}
          {renderSectionHeader("Diaper Changes/Potty")}
          {renderChart("Diaper Changes/Potty", 
            { wet: current.diaper.wet, bm: current.diaper.bm }, // Changed from soiled to bm
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
  // New time range selector at top
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