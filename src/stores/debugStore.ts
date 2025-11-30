import { create } from 'zustand';
import type { DebugLog, DebugLogType } from '../types';

interface DebugState {
  logs: DebugLog[];
  addLog: (type: DebugLogType, data: unknown) => void;
  clearLogs: () => void;
}

let logId = 0;

export const useDebugStore = create<DebugState>((set) => ({
  logs: [],
  addLog: (type, data) =>
    set((state) => ({
      logs: [
        ...state.logs,
        {
          id: `log-${++logId}`,
          timestamp: new Date(),
          type,
          data,
        },
      ],
    })),
  clearLogs: () => {
    logId = 0;
    set({ logs: [] });
  },
}));
