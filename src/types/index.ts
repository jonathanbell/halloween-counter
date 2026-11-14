export interface CounterState {
  currentCount: number;
  candyRemaining: number;
  initialCandyCount: number;
}

export interface StatsData {
  candiesGivenPastFiveMinutes: number | null;
  averageTimeBetween: number;
  candyDepletionRate: number;
}