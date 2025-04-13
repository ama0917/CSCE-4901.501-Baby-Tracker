import React, { useState } from 'react';
import { View, Text, Dimensions, TouchableOpacity, ScrollView, Alert, StyleSheet, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AntDesign, Feather } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundGradientFrom: "#f0f9ff",
  backgroundGradientTo: "#f0f9ff",
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
  labelColor: () => '#333',
  propsForLabels: {
    fontSize: 12,
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
  paddingTop: 10,
  formatYLabel: (value) => String(value),
};

const ReportsScreen = () => {
  const navigation = useNavigation();
  const [reportRange, setReportRange] = useState("Weekly");
  const [expandedSection, setExpandedSection] = useState("Feeding"); // Default expanded section

  const mockData = {
    Weekly: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      feeding: {
        count: [4, 5, 3, 4, 5, 6, 5],
        duration: [120, 135, 110, 125, 140, 150, 130], // in minutes
      },
      diaper: {
        wet: [4, 5, 3, 5, 4, 5, 3],
        soiled: [2, 3, 2, 4, 3, 2, 2],
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
        duration: [850, 820, 890, 860], // in minutes
      },
      diaper: {
        wet: [28, 26, 30, 27],
        soiled: [20, 18, 22, 19],
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
        duration: [3600, 3450, 3750, 3540, 3660, 3900, 3780, 3600, 3450, 3540, 3720, 3840], // in minutes
      },
      diaper: {
        wet: [112, 105, 115, 108, 114, 120, 118, 112, 106, 110, 116, 120],
        soiled: [80, 75, 85, 79, 82, 88, 86, 80, 76, 82, 86, 90],
      },
      sleeping: {
        nighttime: [240, 230, 250, 235, 245, 260, 255, 240, 235, 240, 250, 255],
        naps: [108, 104, 112, 106, 110, 116, 114, 108, 102, 106, 112, 115]
      }
    }
  };

  const current = mockData[reportRange];

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const renderChart = (title, datasets, yLabel, colors = ['#1976d2', '#4caf50']) => {
    if (expandedSection !== title) return null;
    
    const adjustedWidth = screenWidth - 40;
    
    const chartData = {
      labels: current.labels,
      datasets: Object.entries(datasets).map(([key, data], index) => ({
        data,
        color: () => colors[index % colors.length],
        strokeWidth: 2,
      }))
    };
    
    const legend = Object.keys(datasets).map((key, index) => (
      <View key={key} style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: colors[index % colors.length] }]} />
        <Text style={styles.legendText}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
      </View>
    ));

    return (
      <View style={styles.chartContainer}>
        <LineChart
          data={chartData}
          width={adjustedWidth}
          height={220}
          yAxisLabel=""
          yAxisSuffix={yLabel}
          fromZero
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withInnerLines={true}
          withOuterLines={true}
          withVerticalLines={false}
          withHorizontalLines={true}
          withVerticalLabels={true}
          withHorizontalLabels={true}
          yAxisInterval={1}
        />
        <View style={styles.legendContainer}>
          {legend}
        </View>
      </View>
    );
  };

  const handleDownloadExcel = async () => {
    // Convert mock data into CSV format
    let csv = `Baby Tracker Report (${reportRange})\n\n`;
    
    // Add Feeding Data
    csv += "Date,Feeding Count,Feeding Duration (min)\n";
    current.labels.forEach((label, index) => {
      csv += `${label},${current.feeding.count[index]},${current.feeding.duration[index]}\n`;
    });
    
    csv += "\nDate,Wet Diapers,Soiled Diapers\n";
    current.labels.forEach((label, index) => {
      csv += `${label},${current.diaper.wet[index]},${current.diaper.soiled[index]}\n`;
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
        style={styles.sectionHeader} 
        onPress={() => toggleSection(title)}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
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
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back to dashboard"
            accessible={true}
          >
            <AntDesign name="arrowleft" size={24} color="#1976d2" />
            <Text style={styles.backText}>Back to Dashboard</Text>
          </TouchableOpacity>
          
        </View>

        <Text style={styles.screenTitle}>Reports</Text>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
          {/* Feeding Section */}
          {renderSectionHeader("Feeding")}
          {renderChart("Feeding", 
            { count: current.feeding.count, duration: current.feeding.duration }, 
            "", 
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
            { wet: current.diaper.wet, soiled: current.diaper.soiled }, 
            "",
            ['#00897b', '#43a047']
          )}

          {/* Generate Reports Section */}
          <View style={styles.generateSection}>
            <Text style={styles.generateTitle}>Generate Reports</Text>
            <Text style={styles.generateSubtitle}>Select report type</Text>
            
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
            
            <TouchableOpacity
              onPress={handleDownloadExcel}
              style={styles.downloadButton}
              accessibilityLabel="Download Excel Report"
            >
              <Feather name="download" size={18} color="#2e7d32" style={styles.downloadIcon} />
              <Text style={styles.downloadText}>Download Excel Report</Text>
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
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#f0f9ff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8, // Larger touch target
  },
  backText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#1976d2',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    marginRight: 40,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 16,
    textAlign: 'center',
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
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1976d2',
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
    marginLeft: -10, // Adjust chart position
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
    marginBottom: 12,
  },
  reportTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  reportTypeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 4,
    borderRadius: 8,
  },
  reportTypeButtonActive: {
    backgroundColor: '#e3f2fd',
  },
  reportTypeText: {
    fontSize: 14,
    color: '#666',
  },
  reportTypeTextActive: {
    color: '#1976d2',
    fontWeight: 'bold',
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