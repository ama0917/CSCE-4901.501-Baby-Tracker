import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const SleepHeatMap = ({ series, categories, height = 600 }) => {
  const webviewRef = useRef(null);

  const initialHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
        <style>
          body { margin: 0; padding: 0; background: #ffffff; }
          #chart { width: 100%; height: ${height}px; }
        </style>
      </head>
      <body>
        <div id="chart"></div>
        <script>
          var chart;
          function renderChart(data) {
            var options = {
              chart: {
                type: 'heatmap',
                toolbar: { show: false },
              },
              plotOptions: {
                heatmap: {
                  shadeIntensity: 0.5,
                  radius: 0,
                  useFillColorAsStroke: true,
                  colorScale: {
                    ranges: [
                      { from: 0, to: 0, color: '#e3f2fd', name: 'None' },
                      { from: 1, to: 30, color: '#bbdefb', name: 'Low' },
                      { from: 31, to: 60, color: '#64b5f6', name: 'Moderate' },
                      { from: 61, to: 120, color: '#2196f3', name: 'High' },
                      { from: 121, to: 300, color: '#3f51b5', name: 'Very High' }
                    ]
                  }
                }
              },
              dataLabels: {
                enabled: false
              },
              xaxis: {
                categories: data.categories,
                labels: {
                  style: {
                    colors: '#666',
                    fontSize: '12px',
                  }
                }
              },
              yaxis: {
                labels: {
                  style: {
                    colors: '#666',
                    fontSize: '12px',
                  }
                }
              },
              legend: {
                show: true,
                position: 'bottom',
                labels: {
                  colors: '#666'
                }
              },
              grid: {
                padding: {
                  right: 0,
                  left: 0
                }
              },
              series: data.series
            };

            if (chart) {
              chart.updateOptions(options);
            } else {
              chart = new ApexCharts(document.querySelector("#chart"), options);
              chart.render();
            }
          }

          window.addEventListener("message", function(event) {
            const data = JSON.parse(event.data);
            renderChart(data);
          });

          document.addEventListener("message", function(event) {
            const data = JSON.parse(event.data);
            renderChart(data);
          });
        </script>
      </body>
    </html>
  `;

  const onWebViewLoad = () => {
    if (webviewRef.current) {
      const chartData = JSON.stringify({ series, categories });
      webviewRef.current.postMessage(chartData);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: initialHTML }}
        onLoadEnd={onWebViewLoad}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled
        style={{ height: height, width: Dimensions.get('window').width }}
        injectedJavaScriptBeforeContentLoaded={`window.isRNWebView = true;`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginVertical: 10,
    backgroundColor: '#fff',
  },
});

export default SleepHeatMap;
