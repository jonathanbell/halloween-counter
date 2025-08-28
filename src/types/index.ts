export interface CounterState {
  currentCount: number;
  candyRemaining: number;
  initialCandyCount: number;
  candyPerChild: number;
}

export interface StatsData {
  candiesGivenPastFiveMinutes: number | null;
  averageTimeBetween: number; // in seconds
  candyDepletionRate: number;
  startTime: number;
  timestamps: number[];
}

export interface QueryParams {
  currentCount?: number;
  initialCandyCount?: number;
}

export interface ZombieInstance {
  id: string;
  number: number;
  position: number;
  speed: number;
  scale: number;
  yOffset: number;
  spawnTime: number; // timestamp when zombie was created
}