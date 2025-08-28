import { useState, useEffect } from 'react';

interface QueryParams {
  currentCount: number;
  statsInterval: number;
}

export const useQueryParams = (): QueryParams => {
  const [params, setParams] = useState<QueryParams>({
    currentCount: 0,
    statsInterval: 10
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const currentCount = parseInt(urlParams.get('currentCount') || '0', 10);
    const statsInterval = parseInt(urlParams.get('statsInterval') || '10', 10);
    
    setParams({
      currentCount: isNaN(currentCount) ? 0 : currentCount,
      statsInterval: isNaN(statsInterval) ? 10 : statsInterval
    });
  }, []);

  return params;
};

export const updateUrlWithCount = (count: number): void => {
  const url = new URL(window.location.href);
  url.searchParams.set('currentCount', count.toString());
  window.history.replaceState({}, '', url.toString());
};