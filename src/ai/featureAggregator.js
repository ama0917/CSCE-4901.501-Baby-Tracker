// CommonJS version of featureAggregator for node-based tests
function aggregateLogsToWeeklyMetrics({feeds, sleeps, diapers}) {
  const metrics = {
    avgBottleMl: null,
    avgFeedCount: 0,
    totalDiapers: 0,
    avgSleepHours: null,
    longestSleepHours: null,
  };

  if (feeds && feeds.length) {
    const bottleFeeds = feeds.filter(f => f.amountMl != null);
    if (bottleFeeds.length) {
      const totalMl = bottleFeeds.reduce((s, f) => s + (f.amountMl || 0), 0);
      metrics.avgBottleMl = Math.round(totalMl / bottleFeeds.length);
    }
    metrics.avgFeedCount = Math.round(feeds.length / 7) || 0;
  }

  if (diapers && diapers.length) {
    metrics.totalDiapers = diapers.length;
  }

  if (sleeps && sleeps.length) {
    const sleepHours = sleeps.map(s => {
      const start = new Date(s.start).getTime();
      const end = new Date(s.end).getTime();
      return Math.max(0, (end - start) / 1000 / 3600);
    });
    const total = sleepHours.reduce((a,b) => a+b, 0);
    metrics.avgSleepHours = Math.round((total / sleepHours.length) * 10) / 10;
    metrics.longestSleepHours = Math.round(Math.max(...sleepHours) * 10) / 10;
  }

  return metrics;
}

module.exports = { aggregateLogsToWeeklyMetrics };
