export function hasChromeStorage() {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
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

export async function removeChromeStorageValue(key: string) {
  await chrome.storage.local.remove(key);
}

export function getLocalStorageRawValue(key: string) {
  return localStorage.getItem(key);
}

export function setLocalStorageRawValue(key: string, value: string) {
  localStorage.setItem(key, value);
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
