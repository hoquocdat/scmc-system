import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StoreState {
  selectedStoreId: string | null;
  selectedStoreName: string | null;
  setStore: (id: string, name: string) => void;
  clearStore: () => void;
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set) => ({
      selectedStoreId: null,
      selectedStoreName: null,

      setStore: (id: string, name: string) =>
        set({ selectedStoreId: id, selectedStoreName: name }),

      clearStore: () =>
        set({ selectedStoreId: null, selectedStoreName: null }),
    }),
    {
      name: 'scmc-store',
    }
  )
);
