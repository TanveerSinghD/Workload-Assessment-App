import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";

import { getAppLockState, verifyPin } from "@/lib/app-lock-storage";
import { LockScreen } from "@/components/lock-screen";

type Props = {
  children: React.ReactNode;
};

export function AppLockGate({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [missingPin, setMissingPin] = useState(false);

  const loadState = useCallback(async () => {
    const state = await getAppLockState();
    const shouldLock = state.enabled === true;
    const pinMissing = shouldLock && (!state.pinHash || !state.salt);
    setMissingPin(pinMissing);
    setLocked(shouldLock && !pinMissing);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const handleUnlock = useCallback(async (pin: string) => {
    const ok = await verifyPin(pin);
    if (ok) {
      setLocked(false);
    }
    return ok;
  }, []);

  const handleResetPin = useCallback(() => {
    // If a pin is missing/corrupt, push to the set-pin flow to re-establish it.
    setLocked(false);
    setMissingPin(false);
    router.replace("/set-pin");
  }, []);

  const content = useMemo(() => {
    if (loading) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      );
    }

    if (locked || missingPin) {
      return (
        <LockScreen
          missingPin={missingPin}
          onUnlock={handleUnlock}
          onResetPin={handleResetPin}
        />
      );
    }

    return children;
  }, [children, handleResetPin, handleUnlock, loading, locked, missingPin]);

  return <>{content}</>;
}
