import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import Cookies from 'js-cookie';

interface LocationState {
  selectedLocationId: string | null;
  selectedLocationName: string | null;
  setLocation: (id: string, name: string) => void;
  clearLocation: () => void;
}

// Custom cookie storage for zustand persist
const cookieStorage = {
  getItem: (name: string) => {
    const value = Cookies.get(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    // Cookie expires in 30 days
    Cookies.set(name, value, { expires: 30, sameSite: 'lax' });
  },
  removeItem: (name: string) => {
    Cookies.remove(name);
  },
};

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      selectedLocationId: null,
      selectedLocationName: null,

      setLocation: (id: string, name: string) =>
        set({ selectedLocationId: id, selectedLocationName: name }),

      clearLocation: () =>
        set({ selectedLocationId: null, selectedLocationName: null }),
    }),
    {
      name: 'scmc-location',
      storage: createJSONStorage(() => cookieStorage),
    }
  )
);
