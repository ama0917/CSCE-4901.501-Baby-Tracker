const agg = require('../src/ai/featureAggregator');

function assertEqual(a,b,message){
  if (JSON.stringify(a)!==JSON.stringify(b)) throw new Error(message || `Assertion failed: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}

// Simple test: feeds with two bottle entries, sleeps with two stretches, diapers 3
const feeds = [{amountMl:120},{amountMl:90}];
const sleeps = [{start: '2025-09-07T20:00:00Z', end: '2025-09-08T00:00:00Z'}, {start: '2025-09-09T22:00:00Z', end: '2025-09-10T01:00:00Z'}];
const diapers = [{},{},{}];

const metrics = agg.aggregateLogsToWeeklyMetrics({feeds,sleeps,diapers});
assertEqual(metrics.totalDiapers, 3, 'Diaper count should be 3');
assertEqual(metrics.avgFeedCount, Math.round(feeds.length/7) || 0, 'Avg feed count mismatch');
if (metrics.avgBottleMl === null) throw new Error('avgBottleMl should be computed');
console.log('aggregator.test.js passed');
