import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { LineChart, PieChart } from 'react-native-chart-kit';
import StackedBarChart from './StackedBarChart';
import TimeOfDayHeatmap from './TimeOfDayHeatmap';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width - 40;


const ChartCarousel = ({ 
  activeTab, 
  chartData, 
  chartConfig, 
  yAxisLabel,
  darkMode,
  theme,
  handleDataPointClick,
  feedingData,
  sleepData,
  diaperData,
  processSleepTimeOfDay,
  processFeedingTimeOfDay,
  processDiaperTimeOfDay,
  hasAIConsent
}) => {
  const scrollViewRef = useRef(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [feedingChartMode, setFeedingChartMode] = useState('frequency');
  const getChartsForTab = () => {
    const charts = [];

    if (activeTab === 'Sleep' && chartData) {
      // Main Sleep Chart
      if (chartData.lineData) {
        charts.push({
          title: 'Daily Sleep Duration',
          type: 'line',
          data: chartData.lineData,
        });
      }

      // Sleep Distribution Pie Chart
      if (chartData.breakdown) {
        const totalNightHours = chartData.breakdown.night.reduce((a, b) => a + b, 0);
        const totalNapHours = chartData.breakdown.naps.reduce((a, b) => a + b, 0);
        
        if (totalNightHours + totalNapHours > 0) {
          charts.push({
            title: 'Sleep Type Distribution',
            type: 'pie',
            data: [
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
            ].filter(item => item.hours > 0),
          });
        }
      }

      // Sleep Time Heatmap
      if (sleepData && sleepData.length > 0 && processSleepTimeOfDay) {
        charts.push({
          title: 'Sleep Start Times',
          type: 'heatmap',
          data: processSleepTimeOfDay(),
          color: '#1976d2',
        });
      }
    }

    if (activeTab === 'Feeding' && chartData) {
      // Main Feeding Chart
      if (chartData.lineData) {
        charts.push({
          title: 'Feeding Frequency',
          type: 'line',
          data: chartData.lineData,
        });
      }

      // Feeding Type Breakdown (with toggle between frequency and calories)
      if (feedingData && feedingData.length > 0) {
        const feedTypeData = {};
        feedingData.forEach(log => {
          const type = log.feedType || 'Other';
          if (!feedTypeData[type]) {
            feedTypeData[type] = { count: 0, calories: 0 };
          }
          feedTypeData[type].count++;
          
          // Calculate calories if AI consent
          if (hasAIConsent) {
            const getCalorieEstimate = (feedType, amount, unit) => {
              const estimates = {
                'breast milk': 20, 'breastmilk': 20,
                'formula': 20,
                'solid': 50, 'solids': 50,
                'puree': 30, 'purée': 30,
                'juice': 15,
                'water': 0,
                'milk': 18,
              };
              
              const type = (feedType || '').toLowerCase();
              for (const [key, cal] of Object.entries(estimates)) {
                if (type.includes(key)) return cal * 4;
              }
              return 50;
            };
            
            feedTypeData[type].calories += getCalorieEstimate(type, log.amount, log.amountUnit);
          }
        });

        const colors = ['#1976d2', '#FF9800', '#4CAF50', '#F44336', '#9C27B0', '#53e6d2ff'];
        const pieData = Object.entries(feedTypeData)
          .map(([type, data], index) => ({
            name: type,
            count: data.count,
            calories: Math.round(data.calories),
            color: colors[index % colors.length],
            legendFontColor: darkMode ? '#ddd' : '#333',
            legendFontSize: 12
          }))
          .sort((a, b) => b.count - a.count);

        if (pieData.length > 0) {
          charts.push({
            title: hasAIConsent ? 'Feeding Distribution' : 'Feeding Type Distribution',
            type: 'feedingPie',
            data: pieData,
            showToggle: hasAIConsent, // Only show toggle if AI consent
          });
        }
      }

      // Feeding Time Heatmap
      if (feedingData && feedingData.length > 0 && processFeedingTimeOfDay) {
        charts.push({
          title: 'Feeding Times',
          type: 'heatmap',
          data: processFeedingTimeOfDay(),
          color: '#FF9800',
        });
      }
    }

    if (activeTab === 'Diaper' && chartData) {
      // Main Diaper Chart
      if (chartData.series) {
        charts.push({
          title: 'Diaper Changes',
          type: 'stackedBar',
          data: chartData,
        });
      }

      // Diaper Time Heatmap
      if (diaperData && diaperData.length > 0 && processDiaperTimeOfDay) {
        charts.push({
          title: 'Diaper Change Times',
          type: 'heatmap',
          data: processDiaperTimeOfDay(),
          color: '#00BCD4',
        });
      }
    }

    return charts;
  };

  const charts = getChartsForTab();

  if (charts.length === 0) {
    return null;
  }

  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / width);
    setActiveSlide(currentIndex);
  };

  const scrollToIndex = (index) => {
    scrollViewRef.current?.scrollTo({
      x: index * width,
      animated: true,
    });
  };

  return (
    <View style={styles.carouselContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={width}
        snapToAlignment="center"
        contentContainerStyle={styles.scrollContent}
      >
        {charts.map((item, index) => (
          <View 
            key={index} 
            style={[
              styles.chartSlide, 
              { 
                width: width,
                backgroundColor: darkMode ? '#1f1f1f' : '#fff' 
              }
            ]}
          >
            <View style={styles.chartSlideInner}>
              <Text style={[styles.chartTitle, { color: theme.textPrimary }]}>
                {item.title}
              </Text>
              
              {item.type === 'line' && item.data && (
                <LineChart
                  data={item.data}
                  width={ITEM_WIDTH}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix={yAxisLabel}
                  fromZero
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                  withInnerLines
                  withOuterLines
                  withVerticalLines={false}
                  withHorizontalLines
                  withDots
                  onDataPointClick={handleDataPointClick}
                />
              )}

              {item.type === 'pie' && item.data && (
                <>
                  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <PieChart
                      data={item.data}
                      width={ITEM_WIDTH}
                      height={220}
                      chartConfig={chartConfig}
                      accessor="hours"
                      backgroundColor="transparent"
                      paddingLeft="15"
                      center={[ITEM_WIDTH / 4, 0]}
                      absolute
                      hasLegend={false}
                    />
                  </View>
    
        {/* Interactive Legend */}
                  <View style={styles.interactiveLegendContainer}>
                    <Text style={[styles.legendTitle, { color: theme.textSecondary }]}>
                      Tap to view detailed breakdown
                    </Text>
                    <View style={styles.legendGrid}>
                      {item.data.map((pieItem, idx) => {
                        const totalHours = item.data.reduce((sum, d) => sum + d.hours, 0);
                        const percentage = Math.round((pieItem.hours / totalHours) * 100);
                        
                        return (
                          <TouchableOpacity 
                            key={idx}
                            style={[styles.legendItemCard, { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }]}
                            onPress={() => {
                              Alert.alert(
                                pieItem.name,
                                `Total Hours: ${pieItem.hours}hrs\nPercentage: ${percentage}%\nAverage per day: ${(pieItem.hours / 7).toFixed(1)}hrs`,
                                [{ text: 'OK' }]
                              );
                            }}
                          >
                            <View style={[styles.legendColorDot, { backgroundColor: pieItem.color }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.legendItemText, { color: theme.textPrimary }]}>
                                {pieItem.name}
                              </Text>
                              <Text style={[styles.legendItemCount, { color: theme.textSecondary, fontSize: 10 }]}>
                                {pieItem.hours}hrs ({percentage}%)
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}

              {item.type === 'feedingPie' && item.data && (
                <>
                  {/* Toggle between Frequency and Calories (only if AI consent) */}
                  {item.showToggle && (
                    <View style={styles.chartModeToggle}>
                      <TouchableOpacity
                        style={[
                          styles.chartModeButton,
                          feedingChartMode === 'frequency' && styles.chartModeButtonActive
                        ]}
                        onPress={() => setFeedingChartMode('frequency')}
                      >
                        <Text style={[
                          styles.chartModeButtonText,
                          feedingChartMode === 'frequency' && styles.chartModeButtonTextActive
                        ]}>
                          Frequency
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.chartModeButton,
                          feedingChartMode === 'calories' && styles.chartModeButtonActive
                        ]}
                        onPress={() => setFeedingChartMode('calories')}
                      >
                        <Text style={[
                          styles.chartModeButtonText,
                          feedingChartMode === 'calories' && styles.chartModeButtonTextActive
                        ]}>
                          Calories (AI Est.)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <PieChart
                      data={item.data}
                      width={ITEM_WIDTH}
                      height={220}
                      chartConfig={chartConfig}
                      accessor={item.showToggle && feedingChartMode === 'calories' ? 'calories' : 'count'}
                      backgroundColor="transparent"
                      paddingLeft="15"
                      center={[ITEM_WIDTH / 4, 0]}
                      absolute
                      hasLegend={false}
                    />
                  </View>
                  
                  {/* Interactive Legend */}
                  <View style={styles.interactiveLegendContainer}>
                    <Text style={[styles.legendTitle, { color: theme.textSecondary }]}>
                      Tap to view {item.showToggle && feedingChartMode === 'calories' ? 'calorie estimates &' : ''} details
                    </Text>
                    <View style={styles.legendGrid}>
                      {item.data.map((pieItem, idx) => {
                        const totalValue = item.showToggle && feedingChartMode === 'calories'
                          ? item.data.reduce((sum, d) => sum + d.calories, 0)
                          : item.data.reduce((sum, d) => sum + d.count, 0);
                        const currentValue = item.showToggle && feedingChartMode === 'calories' 
                          ? pieItem.calories 
                          : pieItem.count;
                        const percentage = Math.round((currentValue / totalValue) * 100);
                        
                        return (
                          <TouchableOpacity 
                            key={idx}
                            style={[styles.legendItemCard, { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }]}
                            onPress={() => {
                              const message = item.showToggle && feedingChartMode === 'calories'
                                ? `Feedings: ${pieItem.count}\nEstimated Calories: ~${pieItem.calories} cal\nPercentage: ${percentage}%\n\nNote: Calorie estimates are AI-powered approximations.`
                                : `Feedings: ${pieItem.count} (${percentage}%)`;
                                
                              Alert.alert(pieItem.name, message, [{ text: 'OK' }]);
                            }}
                          >
                            <View style={[styles.legendColorDot, { backgroundColor: pieItem.color }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.legendItemText, { color: theme.textPrimary }]}>
                                {pieItem.name}
                              </Text>
                              <Text style={[styles.legendItemCount, { color: theme.textSecondary, fontSize: 10 }]}>
                                {item.showToggle && feedingChartMode === 'calories' 
                                  ? `~${pieItem.calories} cal (${percentage}%)`
                                  : `${pieItem.count} feedings (${percentage}%)`
                                }
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                  
                  {/* AI Disclaimer (only show when in calories mode) */}
                  {item.showToggle && feedingChartMode === 'calories' && (
                    <View style={[
                      styles.calorieDisclaimer,
                      { backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8' }
                    ]}>
                      <Ionicons name="information-circle-outline" size={16} color={darkMode ? '#64b5f6' : '#1976d2'} />
                      <Text style={[
                        styles.disclaimerText,
                        { color: darkMode ? '#bbb' : '#666' }
                      ]}>
                        Calorie estimates are AI-powered approximations. Consult your pediatrician for accurate nutrition tracking.
                      </Text>
                    </View>
                  )}
                </>
              )}

              {item.type === 'stackedBar' && item.data && (
                <StackedBarChart
                  series={item.data.series}
                  categories={item.data.options?.xaxis?.categories || []}
                  height={300}
                />
              )}

              {item.type === 'heatmap' && item.data && (
                <TimeOfDayHeatmap
                  data={item.data}
                  title=""
                  color={item.color}
                  darkMode={darkMode}
                />
              )}
            </View>
          </View>
        ))}
      </ScrollView>
      
      {/* Custom Pagination Dots */}
      {charts.length > 1 && (
        <View style={styles.paginationContainer}>
          {charts.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => scrollToIndex(index)}
              style={[
                styles.paginationDot,
                {
                  backgroundColor: activeSlide === index 
                    ? (darkMode ? '#64b5f6' : '#1976d2')
                    : '#ccc',
                  opacity: activeSlide === index ? 1 : 0.4,
                  transform: [{ scale: activeSlide === index ? 1 : 0.6 }],
                }
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  carouselContainer: {
    marginBottom: 15,
  },
  scrollContent: {
    paddingVertical: 10,
  },
  chartSlide: {
    paddingHorizontal: 20,
  },
  chartSlideInner: {
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    backgroundColor: '#fff',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 10,
    marginVertical: 8,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    minWidth: '45%',
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
    fontWeight: '500',
  },
  legendItemCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
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
  chartModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
    alignSelf: 'center',
  },
  chartModeButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  chartModeButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chartModeButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  chartModeButtonTextActive: {
    color: '#1976d2',
    fontWeight: '600',
  },
});

export default ChartCarousel;