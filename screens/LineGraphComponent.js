import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');
const adjustedWidth = width - 40;

const LineGraphComponent = ({ data, title, yAxisSuffix = '', yAxisLabel = '' }) => {
  const chartConfig = {
    backgroundGradientFrom: "#f0f9ff",
    backgroundGradientTo: "#f0f9ff",
    decimalPlaces: 0,
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
    paddingLeft: 10,
    paddingTop: 15,
    formatYLabel: (value) => String(value),
    useShadowColorFromDataset: false,
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <LineChart
        data={data}
        width={adjustedWidth}
        height={220}
        chartConfig={chartConfig}
        bezier
        fromZero
        withInnerLines={false}
        withOuterLines={true}
        withDots={true}
        withShadow={false}
        yAxisSuffix={yAxisSuffix}
        yAxisLabel={yAxisLabel}
        style={styles.chart}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 5,
    marginVertical: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    marginLeft: 10,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 10,
  },
});

export default LineGraphComponent;