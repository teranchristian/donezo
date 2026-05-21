export type ChromeStorageAreaName = 'local' | 'sync';

type StoredValueOptions = {
  area?: ChromeStorageAreaName;
};

function getChromeStorageArea(area: ChromeStorageAreaName = 'local') {
  return typeof chrome !== 'undefined' ? chrome.storage?.[area] : undefined;
}

export function hasChromeStorage(area: ChromeStorageAreaName = 'local') {
  return Boolean(getChromeStorageArea(area));
}

export function subscribeStoredValues(
  keys: readonly string[],
  callback: (changedKeys: Set<string>) => void,
  options: StoredValueOptions = {},
) {
  const keySet = new Set(keys);
  const area = options.area ?? 'local';
  if (keySet.size === 0) {
    return () => {};
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    const handleStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== area) {
        return;
      }

      const changedKeys = new Set(
        Object.keys(changes).filter((key) => keySet.has(key)),
      );
      if (changedKeys.size > 0) {
        callback(changedKeys);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  }

  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorageChanged = (event: StorageEvent) => {
    if (!event.key || !keySet.has(event.key)) {
      return;
    }

    callback(new Set([event.key]));
  };

  window.addEventListener('storage', handleStorageChanged);
  return () => {
    window.removeEventListener('storage', handleStorageChanged);
  };
}

export async function getStoredValue<T>(key: string) {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  }

  return undefined;
}

export async function getStoredAreaValue<T>(
  key: string,
  options: StoredValueOptions = {},
) {
  const storageArea = getChromeStorageArea(options.area ?? 'local');
  if (storageArea) {
    const result = await storageArea.get(key);
    return result[key] as T | undefined;
  }

  return undefined;
}

export async function getChromeStorageValue<T>(key: string) {
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
}

export async function getChromeStorageValues<const T extends readonly string[]>(keys: T) {
  const result = await chrome.storage.local.get([...keys]);
  return result as Record<T[number], unknown>;
}

export async function setChromeStorageValues(values: Record<string, unknown>) {
  await chrome.storage.local.set(values);
}

export async function setStoredValue(key: string, value: unknown) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}

export async function setStoredAreaValue(
  key: string,
  value: unknown,
  options: StoredValueOptions = {},
) {
  const storageArea = getChromeStorageArea(options.area ?? 'local');
  if (storageArea) {
    await storageArea.set({ [key]: value });
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}

export async function removeChromeStorageValue(key: string) {
  await chrome.storage.local.remove(key);
}

export async function removeStoredValue(key: string) {
  if (hasChromeStorage()) {
    await chrome.storage.local.remove(key);
    return;
  }

  localStorage.removeItem(key);
}

export function getLocalStorageRawValue(key: string) {
  return localStorage.getItem(key);
}

export async function getStoredRawValue(key: string) {
  if (hasChromeStorage()) {
    const value = await getStoredValue<string>(key);
    return typeof value === 'string' ? value : undefined;
  }

  return getLocalStorageRawValue(key) ?? undefined;
}

export function setLocalStorageRawValue(key: string, value: string) {
  localStorage.setItem(key, value);
}

export async function setStoredRawValue(key: string, value: string) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }

  setLocalStorageRawValue(key, value);
}

export function removeLocalStorageValue(key: string) {
  localStorage.removeItem(key);
}

export function getLocalStorageJsonValue<T>(key: string) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setLocalStorageJsonValue(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export async function getStoredJsonValue<T>(key: string) {
  if (hasChromeStorage()) {
    return (await getStoredValue<T>(key)) ?? null;
  }

  return getLocalStorageJsonValue<T>(key);
}

export async function getStoredAreaJsonValue<T>(
  key: string,
  options: StoredValueOptions = {},
) {
  if (hasChromeStorage(options.area ?? 'local')) {
    return (await getStoredAreaValue<T>(key, options)) ?? null;
  }

  return getLocalStorageJsonValue<T>(key);
}

export async function setStoredJsonValue(key: string, value: unknown) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }

  setLocalStorageJsonValue(key, value);
}

export async function setStoredAreaJsonValue(
  key: string,
  value: unknown,
  options: StoredValueOptions = {},
) {
  await setStoredAreaValue(key, value, options);
}
