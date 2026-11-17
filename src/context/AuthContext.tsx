"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AuthenticatedUser } from "@/types/auth";
import { LoginInput, RegisterInput } from "@/schemas/auth";

interface AuthContextType {
  user: AuthenticatedUser | null;
  loading: boolean;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/session", {
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.success && json.data.isAuthenticated) {
        setUser(json.data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (data: LoginInput) => {
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || "Login failed");
    }
    setUser(json.data.user);
  };

  const register = async (data: RegisterInput) => {
    const res = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || "Registration failed");
    }
    setUser(json.data.user);
  };

  const logout = async () => {
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      setUser(null);
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

