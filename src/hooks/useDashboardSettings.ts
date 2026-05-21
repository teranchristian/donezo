import { useCallback, useEffect, useState } from 'react';
import {
  getDefaultSettings,
  saveStoredDisplayName,
  getStoredSettings,
  saveStoredSettings,
  type DashboardSettings,
} from '../lib/storage';
import { subscribeStoredValues } from '../lib/storage/backend';
import {
  DISPLAY_NAME_STORAGE_KEY,
  GITHUB_OWNER_FILTER_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
} from '../lib/storage/keys';

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

    const unsubscribeSettings = subscribeStoredValues([SETTINGS_STORAGE_KEY], () => {
      void loadStoredSettings(() => isMounted);
    });
    const unsubscribeDisplayName = subscribeStoredValues(
      [DISPLAY_NAME_STORAGE_KEY],
      () => {
        void loadStoredSettings(() => isMounted);
      },
      { area: 'sync' },
    );
    const unsubscribeOwnerFilter = subscribeStoredValues(
      [GITHUB_OWNER_FILTER_STORAGE_KEY],
      () => {
        void loadStoredSettings(() => isMounted);
      },
      { area: 'sync' },
    );

    return () => {
      isMounted = false;
      unsubscribeSettings();
      unsubscribeDisplayName();
      unsubscribeOwnerFilter();
    };
  }, [loadStoredSettings]);

  const saveSettings = useCallback(async (nextSettings: DashboardSettings) => {
    await saveStoredSettings(nextSettings);
    setSettings(nextSettings);
  }, []);

  const saveDisplayName = useCallback(async (displayName: string) => {
    const normalizedDisplayName = displayName.trim().slice(0, 40);

    await saveStoredDisplayName(normalizedDisplayName);
    setSettings((currentSettings) => ({
      ...currentSettings,
      name: normalizedDisplayName,
    }));
  }, []);

  return {
    settings,
    isLoadingSettings,
    saveDisplayName,
    saveSettings,
  };
}
