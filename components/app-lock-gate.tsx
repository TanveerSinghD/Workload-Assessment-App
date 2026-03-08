import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";

import {
  APP_LOCK_MAX_ATTEMPTS,
  clearFailedUnlockAttempts,
  clearPin,
  getAppLockSecurityState,
  getAppLockState,
  recordFailedUnlockAttempt,
  setAppLockEnabled,
  verifyPin,
} from "@/lib/app-lock-storage";
import { LockScreen } from "@/components/lock-screen";
import { PinRecoveryScreen } from "@/components/pin-recovery-screen";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  children: React.ReactNode;
};

export function AppLockGate({ children }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [missingPin, setMissingPin] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(APP_LOCK_MAX_ATTEMPTS);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [recoveringPin, setRecoveringPin] = useState(false);

  const loadState = useCallback(async () => {
    const [state, security] = await Promise.all([
      getAppLockState(),
      getAppLockSecurityState(),
    ]);

    const shouldLock = state.enabled === true;
    const pinMissing = shouldLock && (!state.pinHash || !state.salt);
    setMissingPin(pinMissing);
    setLocked(shouldLock && !pinMissing);
    setAttemptsRemaining(Math.max(0, security.maxAttempts - security.attempts));
    setLockoutUntil(security.lockoutUntil);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const handleUnlock = useCallback(
    async (pin: string) => {
      if (lockoutUntil && lockoutUntil > Date.now()) {
        return false;
      }

      const ok = await verifyPin(pin);
      if (ok) {
        await clearFailedUnlockAttempts();
        setLocked(false);
        setAttemptsRemaining(APP_LOCK_MAX_ATTEMPTS);
        setLockoutUntil(null);
        return true;
      }

      const security = await recordFailedUnlockAttempt();
      setAttemptsRemaining(Math.max(0, security.maxAttempts - security.attempts));
      setLockoutUntil(security.lockoutUntil);
      return false;
    },
    [lockoutUntil]
  );

  const handleResetPin = useCallback(() => {
    setLocked(false);
    setMissingPin(false);
    setRecoveringPin(false);
    router.replace("/set-pin");
  }, []);

  const handleForgotPin = useCallback(() => {
    setRecoveringPin(true);
  }, []);

  const handleRecoverWithPassword = useCallback(
    async (password: string) => {
      if (!user) {
        return "No account session found. Please sign in again.";
      }
      if (user.provider !== "email") {
        return "This account does not use a password. Please sign out and sign in again to reset PIN.";
      }
      if ((user.password ?? "") !== password) {
        return "Incorrect account password.";
      }

      await clearPin();
      await clearFailedUnlockAttempts();
      await setAppLockEnabled(true);
      setRecoveringPin(false);
      setLocked(false);
      setMissingPin(false);
      setAttemptsRemaining(APP_LOCK_MAX_ATTEMPTS);
      setLockoutUntil(null);
      router.replace("/set-pin");
      return null;
    },
    [user]
  );

  const content = useMemo(() => {
    if (loading) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      );
    }

    if (recoveringPin) {
      return (
        <PinRecoveryScreen
          email={user?.email ?? null}
          onBack={() => setRecoveringPin(false)}
          onSubmit={handleRecoverWithPassword}
        />
      );
    }

    if (locked || missingPin) {
      return (
        <LockScreen
          missingPin={missingPin}
          onUnlock={handleUnlock}
          onResetPin={handleResetPin}
          onForgotPin={handleForgotPin}
          attemptsRemaining={attemptsRemaining}
          maxAttempts={APP_LOCK_MAX_ATTEMPTS}
          lockoutUntil={lockoutUntil}
        />
      );
    }

    return children;
  }, [
    attemptsRemaining,
    children,
    handleForgotPin,
    handleRecoverWithPassword,
    handleResetPin,
    handleUnlock,
    loading,
    locked,
    lockoutUntil,
    missingPin,
    recoveringPin,
    user?.email,
  ]);

  return <>{content}</>;
}
