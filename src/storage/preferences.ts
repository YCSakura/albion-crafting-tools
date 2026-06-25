export function readPreference<T>(key: string, fallback: T): T {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writePreference<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}
