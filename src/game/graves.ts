// Where things stand in the graveyard. The server only knows grave indexes
// 0-8 (GameSchedule.GRAVE_COUNT); both cameras read positions from here so
// a pop or a splat lands on the same spot on the phone and the door.
//
//            back (-z)         fence, crypt, pines
//        [0]    [1]    [2]
//        [3]    [4]    [5]     x: columns, z: rows
//        [6]    [7]    [8]
//            front (+z)        cameras look from here

export const GRAVE_COUNT = 9;
const COLUMNS = 3;
export const COLUMN_SPACING = 1.25;
export const ROW_SPACING = 1.9;

export interface Spot {
  x: number;
  z: number;
}

export const GRAVES: Spot[] = Array.from({ length: GRAVE_COUNT }, (_, i) => ({
  x: ((i % COLUMNS) - 1) * COLUMN_SPACING,
  z: (Math.floor(i / COLUMNS) - 1) * ROW_SPACING,
}));

// The grid's footprint, for fitting the camera (characters included)
export const GRID_HALF_WIDTH = COLUMN_SPACING + 0.6;
export const GRID_HALF_DEPTH = ROW_SPACING + 0.9;

// Headstone sits at the back end of each mound
export const HEADSTONE_OFFSET_Z = -0.72;

// Characters rise from this depth to stand on the mound
export const BURIED_Y = -1.5;

export const graveOf = (index: number): Spot => GRAVES[index] ?? GRAVES[0];
