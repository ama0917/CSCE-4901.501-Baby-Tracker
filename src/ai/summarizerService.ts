import { WeeklyMetrics } from './types';
import { aggregateLogsToWeeklyMetrics } from './featureAggregator';

// Generates a short summary text given arrays of logs. Runs client-side.
export async function generateSummaryClient({feeds, sleeps, diapers}: {feeds: any[]; sleeps: any[]; diapers: any[]}): Promise<{text: string; metrics: WeeklyMetrics}> {
  const metrics = aggregateLogsToWeeklyMetrics({feeds, sleeps, diapers});

  // Build concise human-readable paragraph
  if (!feeds.length && !sleeps.length && !diapers.length) {
    return {text: '', metrics};
  }

  const parts: string[] = [];
  if (metrics.avgBottleMl != null) {
    parts.push(`Average bottle: ${metrics.avgBottleMl} ml`);
  } else {
    parts.push(`No bottle data`) }

  parts.push(`Avg feeds/day: ${metrics.avgFeedCount}`);
  parts.push(`Diapers this week: ${metrics.totalDiapers}`);

  if (metrics.avgSleepHours != null) {
    parts.push(`Avg sleep per stretch: ${metrics.avgSleepHours} hrs (longest ${metrics.longestSleepHours} hrs)`);
  } else {
    parts.push(`No sleep data`);
  }

  const text = parts.join('. ') + '.';
  return {text, metrics};
}
