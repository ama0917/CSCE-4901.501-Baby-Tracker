import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDarkMode } from './DarkMode';
import { appTheme } from './ThemedBackground';

const { width } = Dimensions.get('window');
const adjustedWidth = width - 40;

const StackedBarChart = ({ series, categories, height = 300 }) => {
  const { darkMode } = useDarkMode();
  const theme = darkMode ? appTheme.dark : appTheme.light;
  const [selectedBar, setSelectedBar] = useState(null);
  
  if (!series || series.length === 0 || !categories || categories.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
        <Text style={[styles.noDataText, { color: theme.textSecondary }]}>
          No data available
        </Text>
      </View>
    );
  }

  // Calculate max value for scaling
  const maxValue = Math.max(
    ...categories.map((_, catIndex) => 
      series.slice(1).reduce((sum, s) => sum + (s.data[catIndex] || 0), 0)
    )
  );

  const barWidth = (adjustedWidth - 60) / categories.length;
  const colors = {
    'Wet': '#2196F3',
    'BM': '#8BC34A',
    'Wet + BM': '#FF9800',
    'Dry': '#9E9E9E'
  };

  const handleBarPress = (catIndex) => {
    const barData = series.slice(1).map(s => ({
      name: s.name,
      value: s.data[catIndex] || 0,
      color: colors[s.name]
    })).filter(item => item.value > 0);

    setSelectedBar({
      category: categories[catIndex],
      data: barData,
      total: barData.reduce((sum, item) => sum + item.value, 0)
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
      <View style={styles.chartArea}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          {[maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0].map((val, i) => (
            <Text key={i} style={[styles.yAxisLabel, { color: theme.textSecondary }]}>
              {Math.round(val)}
            </Text>
          ))}
        </View>

        {/* Bars */}
        <View style={styles.barsContainer}>
          {categories.map((category, catIndex) => {
            const totalHeight = series.slice(1).reduce((sum, s) => sum + (s.data[catIndex] || 0), 0);
            
            return (
              <View key={catIndex} style={[styles.barColumn, { width: barWidth }]}>
                <TouchableOpacity 
                  style={styles.stackedBar}
                  onPress={() => handleBarPress(catIndex)}
                  activeOpacity={0.7}
                >
                  {series.slice(1).map((s, sIndex) => {
                    const value = s.data[catIndex] || 0;
                    const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
                    
                    if (value === 0) return null;
                    
                    return (
                      <View
                        key={sIndex}
                        style={[
                          styles.barSegment,
                          {
                            height: `${heightPercent}%`,
                            backgroundColor: colors[s.name] || '#ccc',
                          }
                        ]}
                      >
                        {/* Only show value if it's a single digit or bar is tall enough */}
                        {value < 10 && heightPercent > 15 && (
                          <Text style={styles.barValue}>{value}</Text>
                        )}
                      </View>
                    );
                  })}
                </TouchableOpacity>
                <Text style={[styles.xAxisLabel, { color: theme.textSecondary }]}>
                  {category}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {series.slice(1).map((s, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: colors[s.name] }]} />
            <Text style={[styles.legendText, { color: theme.textPrimary }]}>{s.name}</Text>
          </View>
        ))}
      </View>

      {/* Tap to view hint */}
      <View style={[styles.tapHint, { backgroundColor: darkMode ? '#2a2a2a' : '#f0f0f0' }]}>
        <Ionicons name="hand-left-outline" size={14} color={theme.textSecondary} />
        <Text style={[styles.tapHintText, { color: theme.textSecondary }]}>
          Tap bars to view detailed values
        </Text>
      </View>

      {/* Detail Modal */}
      <Modal
        visible={selectedBar !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBar(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedBar(null)}
        >
          <View style={[
            styles.modalContent,
            { backgroundColor: darkMode ? '#2c2c2c' : '#fff' }
          ]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                {selectedBar?.category}
              </Text>
              <TouchableOpacity onPress={() => setSelectedBar(null)}>
                <Ionicons name="close-circle" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={[styles.totalText, { color: theme.textPrimary }]}>
                Total Changes: <Text style={{ fontWeight: '700' }}>{selectedBar?.total}</Text>
              </Text>
              
              <View style={styles.detailsList}>
                {selectedBar?.data.map((item, index) => (
                  <View key={index} style={[
                    styles.detailItem,
                    { borderBottomColor: darkMode ? '#404040' : '#e0e0e0' }
                  ]}>
                    <View style={styles.detailLeft}>
                      <View style={[styles.detailColor, { backgroundColor: item.color }]} />
                      <Text style={[styles.detailName, { color: theme.textPrimary }]}>
                        {item.name}
                      </Text>
                    </View>
                    <Text style={[styles.detailValue, { color: theme.textPrimary }]}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 15,
    marginVertical: 10,
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 20,
  },
  chartArea: {
    flexDirection: 'row',
    height: 250,
    marginBottom: 15,
  },
  yAxis: {
    width: 35,
    justifyContent: 'space-between',
    paddingRight: 5,
  },
  yAxisLabel: {
    fontSize: 10,
    textAlign: 'right',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  barColumn: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  stackedBar: {
    width: '80%',
    maxHeight: '90%',
    justifyContent: 'flex-end',
  },
  barSegment: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 5,
  },
  barValue: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  xAxisLabel: {
    fontSize: 9,
    marginTop: 5,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 15,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  tapHintText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    gap: 15,
  },
  totalText: {
    fontSize: 15,
    textAlign: 'center',
  },
  detailsList: {
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  detailName: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default StackedBarChart;