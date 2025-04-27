import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const StackedBarChart = ({ series, categories, height = 350 }) => {
  const chartHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
      <style>
        body { margin: 0; padding: 0; background: #f0f9ff; }
        #chart { max-width: 100%; height: ${height}px; }
      </style>
    </head>
    <body>
      <div id="chart"></div>
      <script>
        var options = {
          chart: {
            type: 'bar',
            stacked: true,
            toolbar: { show: false },
            animations: {
            enabled: true,
            easing: 'easeout',
            speed: 800,
            animateGradually: {
              enabled: true,
              delay: 150
            },
            dynamicAnimation: {
              enabled: true,
              speed: 350
            }
            }
          },
          plotOptions: {
            bar: {
              horizontal: false,
              borderRadius: 6,
              columnWidth: '50%',
            },
          },
          xaxis: {
            categories: ${JSON.stringify(categories)},
          },
          yaxis: {
            title: {
              text: 'Count'
            }
          },
          legend: {
            position: 'top',
            labels: {
              colors: ['#444']
            }
          },
          fill: {
            opacity: 1
          },
          plotOptions: {
          bar: {
            horizontal: false,
            borderRadius: 6,
            columnWidth: '50%',
            dataLabels: {
              position: 'center',
            },
          },
        },
          colors: ['transparent', '#36A2EB', '#FF9F40', '#9966FF', '#4BC0C0'],
          series: ${JSON.stringify(series)}
        };

        chart = new ApexCharts(document.querySelector("#chart"), options);
        chart.render().then(() => {
          chart.updateSeries(chart.w.config.series, true);
        });
        chart.render().then(() => {
          chart.updateSeries(chart.w.config.series, true);
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: chartHTML }}
        style={{ height: height, width: Dimensions.get('window').width - 40 }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginVertical: 10,
  },
});

export default StackedBarChart;
