import { useCallback, useEffect, useState } from 'react';
import {
  getDefaultSettings,
  getStoredSettings,
  saveStoredSettings,
  type DashboardSettings,
} from '../lib/storage';
import { subscribeStoredValues } from '../lib/storage/backend';
import { SETTINGS_STORAGE_KEY } from '../lib/storage/keys';

export function useDashboardSettings() {
  const [settings, setSettings] = useState<DashboardSettings>(getDefaultSettings);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const loadStoredSettings = useCallback(async (isActive: () => boolean) => {
    const storedSettings = await getStoredSettings();
    if (!isActive()) {
      return;
    }

    setSettings(storedSettings);
    setIsLoadingSettings(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    void loadStoredSettings(() => isMounted);

    return () => {
      isMounted = false;
    };
  }, [loadStoredSettings]);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeStoredValues([SETTINGS_STORAGE_KEY], () => {
      void loadStoredSettings(() => isMounted);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [loadStoredSettings]);

  const saveSettings = useCallback(async (nextSettings: DashboardSettings) => {
    await saveStoredSettings(nextSettings);
    setSettings(nextSettings);
  }, []);

  return {
    settings,
    isLoadingSettings,
    saveSettings,
  };
}
