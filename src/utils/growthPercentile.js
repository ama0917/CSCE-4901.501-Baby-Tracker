import growthData from '../data/cdcGrowthCharts_0_36mo.json';

export function getClosestAgeData(table, ageMonths) {
  const ages = Object.keys(table).map(n => Number(n)).sort((a, b) => a - b);
  let closest = ages[0];
  for (const a of ages) {
    if (Math.abs(a - ageMonths) < Math.abs(closest - ageMonths)) {
      closest = a;
    }
  }
  return table[closest];
}

export function getGrowthPercentile(type, ageMonths, sex, value) {
  const dataset = type === 'weight'
    ? growthData.weight_for_age
    : growthData.height_for_age;

  const table = dataset[sex.toLowerCase()];
  if (!table) return null;
  
  const row = getClosestAgeData(table, ageMonths);
  if (!row) return null;

  if (value < row.p3) return '<3rd';
  if (value < row.p15) return '3–15th';
  if (value < row.p50) return '15–50th';
  if (value < row.p85) return '50–85th';
  if (value < row.p97) return '85–97th';
  return '>97th';
}
