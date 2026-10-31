import { createContext, useContext } from 'react';

// Scene-wide animation speed. 1 is normal play; the garage door's replay
// drops it to slow motion and every animation reads it from here.
const SceneTime = createContext(1);

export const SceneTimeProvider = SceneTime.Provider;

export const useTimeScale = () => useContext(SceneTime);
