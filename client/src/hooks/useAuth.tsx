import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Fetch user data using centralized apiRequest (handles token + cookies)
  const { data: userData, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      try {
        const data = await apiRequest("/api/auth/user", { method: 'GET' });
        // Handle both formats: { user: User } and direct User object
        return (data.user || data) as User;
      } catch (err: any) {
        // If unauthorized or invalid token, clear stale token and return null
        const msg = String(err?.message || '').toLowerCase();
        if (
          msg.includes('401') ||
          msg.includes('access token required') ||
          msg.includes('authentication required') ||
          msg.includes('invalid token')
        ) {
          try { localStorage.removeItem('auth_token'); } catch {}
          return null;
        }
        throw err;
      }
    },
    retry: false,
    refetchOnWindowFocus: true, // Refetch when window regains focus (helps after redirect)
    refetchOnMount: true,
  });

  // Check for authentication on page load/focus
  useEffect(() => {
    const handleFocus = () => {
      refetch();
    };
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refetch();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetch]);

  // Update user when userData changes
  useEffect(() => {
    setUser(userData || null);
  }, [userData]);

  const logout = () => {
    setUser(null);
    // Redirect to logout endpoint which handles session cleanup
    window.location.href = "/api/logout";
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
