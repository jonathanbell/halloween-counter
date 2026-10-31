export interface CounterState {
  currentCount: number;
  candyRemaining: number;
  initialCandyCount: number;
  candyPerChild: number;
}

export interface StatsData {
  candiesGivenPastFiveMinutes: number | null;
  averageTimeBetween: number;
  candyDepletionRate: number;
  startTime: number;
  timestamps: number[];
}