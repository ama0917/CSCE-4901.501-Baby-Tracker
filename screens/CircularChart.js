export const getCircularChartHTML = (hourlyFeedings) => {
    return `
      <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
          <style>
            body { margin: 0; padding: 0; background: #fff; }
            #chart { max-width: 100%; margin: auto; }
          </style>
        </head>
        <body>
          <div id="chart"></div>
          <script>
            var options = {
              chart: {
                type: 'radialBar',
                height: 350,
                toolbar: {
                  show: false
                }
              },
              plotOptions: {
                radialBar: {
                  startAngle: -90,
                  endAngle: 270,
                  track: {
                    background: '#e7e7e7',
                    strokeWidth: '100%',
                  },
                  dataLabels: {
                    name: {
                      show: false
                    },
                    value: {
                      fontSize: '16px',
                      show: true,
                      formatter: function (val) {
                        return val + " feedings";
                      }
                    }
                  }
                }
              },
              labels: ${JSON.stringify(
                Array.from({ length: 24 }, (_, i) => {
                  const hour12 = i % 12 === 0 ? 12 : i % 12;
                  const ampm = i < 12 ? 'AM' : 'PM';
                  return `${hour12}${ampm}`;
                })
              )},
              series: ${JSON.stringify(hourlyFeedings)},
              stroke: {
                lineCap: 'round'
              },
              theme: {
                palette: 'pastel'
              }
            };
  
            var chart = new ApexCharts(document.querySelector("#chart"), options);
            chart.render();
          </script>
        </body>
      </html>
    `;
  };
  