export function useSearchParamsFlag(flag: string): boolean {
  return new URLSearchParams(window.location.search).has(flag);
}

export function useProjectionMode(): boolean {
  return useSearchParamsFlag('projection');
}
