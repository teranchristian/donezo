export function hasChromeStorage() {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

export async function getStoredValue<T>(key: string) {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(key);
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

export async function setStoredJsonValue(key: string, value: unknown) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }

  setLocalStorageJsonValue(key, value);
}
