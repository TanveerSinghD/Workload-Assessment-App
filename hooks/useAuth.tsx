import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";

import {
  adoptOrphanTasks,
  getActiveUser,
  getOrCreateActiveUser,
  initDatabase,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
  type UserProfile,
} from "@/lib/database";

type AuthContextShape = {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextShape | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const active = await getOrCreateActiveUser();
    setUser(active);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        await initDatabase();
        await refreshUser();
      } catch (error) {
        console.error("Failed to start database", error);
        Alert.alert("Database error", "We couldn't open local storage for accounts.");
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [refreshUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const loggedIn = await signInWithEmail(email, password);
        if (loggedIn) {
          await adoptOrphanTasks(loggedIn.id);
          setUser(loggedIn);
          return true;
        }
        return false;
      } catch (error) {
        console.error("Sign in failed", error);
        Alert.alert("Sign in failed", "Check your email and password.");
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      setLoading(true);
      try {
        const created = await signUpWithEmail(name, email, password);
        if (created) {
          await adoptOrphanTasks(created.id);
          setUser(created);
          return true;
        }
        return false;
      } catch (error: any) {
        console.error("Sign up failed", error);
        const message =
          typeof error?.message === "string" ? error.message : "Please try again with a different email.";
        Alert.alert("Sign up failed", message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    await signOutUser();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
