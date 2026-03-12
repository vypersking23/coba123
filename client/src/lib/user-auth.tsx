import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { queryClient } from "./queryClient";

type UserProfile = {
  id: string;
  username: string;
  email: string;
  createdAt: string;
};

type UserAuthContextType = {
  isAuthenticated: boolean;
  token: string | null;
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);

function getUserToken() {
  return localStorage.getItem("userToken");
}

function setUserToken(token: string) {
  localStorage.setItem("userToken", token);
}

function clearUserToken() {
  localStorage.removeItem("userToken");
}

function clearUserCachedData() {
  queryClient.removeQueries({
    predicate: (query) => {
      const key = query.queryKey?.[0];
      return typeof key === "string" && key.startsWith("/api/user/");
    },
  });
}

async function fetchMe(token: string): Promise<UserProfile> {
  const res = await fetch("/api/user/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Gagal mengambil profile");
  return data;
}

export function UserAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getUserToken());
  const [user, setUser] = useState<UserProfile | null>(null);

  const isAuthenticated = !!token;

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    let cancelled = false;
    fetchMe(token)
      .then((profile) => {
        if (!cancelled) setUser(profile);
      })
      .catch(() => {
        if (cancelled) return;
        clearUserToken();
        setToken(null);
        setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const refreshMe = async () => {
    if (!token) {
      setUser(null);
      return;
    }
    const profile = await fetchMe(token);
    setUser(profile);
  };

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/user/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login gagal");
    clearUserCachedData();
    setUserToken(data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (username: string, email: string, password: string) => {
    const res = await fetch("/api/user/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Register gagal");
    clearUserCachedData();
    setUserToken(data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    clearUserToken();
    clearUserCachedData();
    setToken(null);
    setUser(null);
  };

  const value = useMemo<UserAuthContextType>(
    () => ({ isAuthenticated, token, user, login, register, logout, refreshMe }),
    [isAuthenticated, token, user],
  );

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>;
}

export function useUserAuth() {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error("useUserAuth must be used within a UserAuthProvider");
  return ctx;
}
