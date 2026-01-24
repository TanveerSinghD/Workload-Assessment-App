import { useCallback, useEffect, useState } from "react";

import { DEFAULT_NAV_QUICK_ACTIONS, NavItemId, QuickActionId } from "@/lib/nav-config";
import { loadNavQuickActions, saveNavQuickAction } from "@/lib/nav-quick-actions-store";

export function useNavQuickActions() {
  const [mapping, setMapping] = useState<Record<NavItemId, QuickActionId>>(DEFAULT_NAV_QUICK_ACTIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await loadNavQuickActions();
        setMapping(saved);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setAction = useCallback(async (navId: NavItemId, actionId: QuickActionId) => {
    setMapping((prev) => ({ ...prev, [navId]: actionId }));
    await saveNavQuickAction(navId, actionId);
  }, []);

  return { mapping, setAction, loading };
}
