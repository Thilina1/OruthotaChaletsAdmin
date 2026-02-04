'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { User, UserRole } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

interface UserContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  error: Error | null;
  hasRole: (role: UserRole) => boolean;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      setError(err as Error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const hasRole = (role: UserRole) => {
    if (!user) return false;
    if (user.role === 'admin') {
      return true;
    }
    return user.role === role;
  };

  const value = {
    user: user || null,
    supabaseUser: user as any, // Alias for backward compatibility if needed, though type mismatch
    loading,
    error,
    hasRole,
    refreshUser: fetchUser,
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center space-y-4">
        <p className="text-lg font-semibold text-primary animate-pulse">Loading Your Experience...</p>
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    );
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUserContext = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
};
