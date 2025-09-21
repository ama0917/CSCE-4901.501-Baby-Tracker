const summ = require('../src/ai/summarizerService');

async function run(){
  const feeds = [{amountMl:120},{amountMl:80}];
  const sleeps = [{start: '2025-09-07T20:00:00Z', end: '2025-09-08T00:00:00Z'}];
  const diapers = [{},{}];

  const res = await summ.generateSummaryClient({feeds,sleeps,diapers});
  if (!res.text || typeof res.text !== 'string') throw new Error('Summary text missing');
  if (!res.metrics) throw new Error('Metrics missing');
  console.log('summarizer.test.js passed');
}

run().catch(e=>{ console.error(e); process.exit(1); });
