import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/api-client';
import type { UserProfile, AuthState } from '../types';

interface AuthStore extends AuthState {
  setUser: (user: UserProfile | null) => void;
  setLoading: (isLoading: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchUserProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setLoading: (isLoading) => set({ isLoading }),

  signIn: async (email: string, password: string) => {
    try {
      set({ isLoading: true });

      // Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Fetch user profile from backend API
        const profile = await apiClient.users.getMe();

        set({
          user: profile as UserProfile,
          isAuthenticated: true,
          isLoading: false,
        });
      }
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      set({
        user: null,
        isAuthenticated: false,
      });
    } catch (error) {
      throw error;
    }
  },

  fetchUserProfile: async () => {
    try {
      set({ isLoading: true });

      // Check if user is authenticated with Supabase
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Fetch user profile from backend API
        const profile = await apiClient.users.getMe();

        set({
          user: profile as UserProfile,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
