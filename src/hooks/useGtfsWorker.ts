import { useEffect, useRef, useState, useCallback } from 'react';
import * as Comlink from 'comlink';
import type { GtfsWorkerApi } from '../workers/gtfs.worker';
import type { ProgressInfo, GtfsLoadingState } from '../types';
import { useSettingsStore } from '../stores/settingsStore';
import { useDebugStore } from '../stores/debugStore';

export function useGtfsWorker() {
  const gtfsUrl = useSettingsStore((state) => state.gtfsUrl);
  const addLog = useDebugStore((state) => state.addLog);

  const [loadingState, setLoadingState] = useState<GtfsLoadingState>('idle');
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const apiRef = useRef<Comlink.Remote<GtfsWorkerApi> | null>(null);

  const initializeWorker = useCallback(async () => {
    // Clean up existing worker
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      apiRef.current = null;
    }

    setLoadingState('loading');
    setError(null);
    setProgress(null);

    try {
      addLog('system', { message: 'Initializing GTFS worker', url: gtfsUrl });

      // Create worker
      const worker = new Worker(
        new URL('../workers/gtfs.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      // Wrap with Comlink
      const api = Comlink.wrap<GtfsWorkerApi>(worker);
      apiRef.current = api;

      // Initialize GTFS data
      await api.initialize(
        gtfsUrl,
        Comlink.proxy((progressInfo: ProgressInfo) => {
          setProgress(progressInfo);
        })
      );

      setLoadingState('ready');
      addLog('system', { message: 'GTFS data loaded successfully' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setLoadingState('error');
      addLog('error', { message: 'Failed to load GTFS data', error: message });
    }
  }, [gtfsUrl, addLog]);

  // Initialize on mount and when URL changes
  useEffect(() => {
    initializeWorker();

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [initializeWorker]);

  const reload = useCallback(() => {
    initializeWorker();
  }, [initializeWorker]);

  return {
    api: apiRef.current,
    loadingState,
    progress,
    error,
    reload,
  };
}
