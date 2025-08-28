import type { QueryParams } from '../types';

export const useQueryParams = (): QueryParams => {
  // Read directly from URL - no need for state since manual URL changes reload the page
  const urlParams = new URLSearchParams(window.location.search);
  const currentCount = urlParams.get('currentCount');
  const initialCandyCount = urlParams.get('initialCandyCount');
  
  return {
    currentCount: currentCount ? parseInt(currentCount, 10) : undefined,
    initialCandyCount: initialCandyCount ? parseInt(initialCandyCount, 10) : undefined,
  };
};

export const updateURLParam = (key: string, value: string | number): void => {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value.toString());
  window.history.replaceState({}, '', url.toString());
};