import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
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

  // Fetch user data with session-based authentication
  const { data: userData, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user", {
        credentials: 'include', // Include cookies for session-based auth
      });
      
      if (!response.ok) {
        // If not authenticated, return null (don't throw error)
        if (response.status === 401) {
          return null;
        }
        throw new Error("Failed to fetch user");
      }
      
      const data = await response.json();
      // Handle both formats: { user: User } and direct User object
      return (data.user || data) as User;
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