import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LocationState {
  selectedLocationId: string | null;
  selectedLocationName: string | null;
  setLocation: (id: string, name: string) => void;
  clearLocation: () => void;
}

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
    }
  )
);
