const { aggregateLogsToWeeklyMetrics } = require('./featureAggregator');

async function generateSummaryClient({feeds = [], sleeps = [], diapers = []}) {
  const metrics = aggregateLogsToWeeklyMetrics({feeds, sleeps, diapers});

  if ((!feeds || !feeds.length) && (!sleeps || !sleeps.length) && (!diapers || !diapers.length)) {
    return {text: '', metrics};
  }

  const parts = [];
  if (metrics.avgBottleMl != null) {
    parts.push(`Average bottle: ${metrics.avgBottleMl} ml`);
  } else {
    parts.push('No bottle data');
  }

  parts.push(`Avg feeds/day: ${metrics.avgFeedCount}`);
  parts.push(`Diapers this week: ${metrics.totalDiapers}`);

  if (metrics.avgSleepHours != null) {
    parts.push(`Avg sleep per stretch: ${metrics.avgSleepHours} hrs (longest ${metrics.longestSleepHours} hrs)`);
  } else {
    parts.push('No sleep data');
  }

  const text = parts.join('. ') + '.';
  return {text, metrics};
}

module.exports = { generateSummaryClient };
