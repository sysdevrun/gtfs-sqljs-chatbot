import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_GTFS_URL = 'https://pysae.com/api/v2/groups/car-jaune/gtfs/pub';

interface SettingsState {
  apiKey: string;
  gtfsUrl: string;
  setApiKey: (key: string) => void;
  setGtfsUrl: (url: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      gtfsUrl: DEFAULT_GTFS_URL,
      setApiKey: (apiKey) => set({ apiKey }),
      setGtfsUrl: (gtfsUrl) => set({ gtfsUrl }),
    }),
    {
      name: 'gtfs-chatbot-settings',
    }
  )
);
