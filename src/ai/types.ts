export interface WeeklyMetrics {
  avgBottleMl: number | null;
  avgFeedCount: number;
  totalDiapers: number;
  avgSleepHours: number | null;
  longestSleepHours: number | null;
}

export interface WeeklySummary {
  id: string;
  childId: string;
  text: string;
  metrics: WeeklyMetrics;
  generatedAt: string; // ISO
}
