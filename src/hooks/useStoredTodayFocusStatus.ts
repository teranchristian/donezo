import { useEffect, useState } from 'react';
import {
  getStoredTodayFocusItemsSnapshot,
  subscribeStoredTodayFocusItems,
} from '../lib/storage';

export function useStoredTodayFocusStatus() {
  const [hasStoredTodayFocusItems, setHasStoredTodayFocusItems] =
    useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      const snapshot = await getStoredTodayFocusItemsSnapshot();
      if (!isMounted) {
        return;
      }

      setHasStoredTodayFocusItems((snapshot?.items.length ?? 0) > 0);
    }

    void loadStatus();
    const unsubscribe = subscribeStoredTodayFocusItems(() => {
      void loadStatus();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return {
    hasStoredTodayFocusItems,
  };
}
