import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
      {title && (
        <Text style={[
          styles.heatmapTitle,
          { color: darkMode ? '#e0e0e0' : '#333' }
        ]}>
          {title}
        </Text>
      )}
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

const styles = StyleSheet.create({
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
});

export default TimeOfDayHeatmap;