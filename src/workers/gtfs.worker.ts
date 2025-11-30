import * as Comlink from 'comlink';
import { GtfsSqlJs } from 'gtfs-sqljs';
import type {
  Stop,
  Route,
  Trip,
  StopTime,
  StopFilters,
  RouteFilters,
  TripFilters,
  StopTimeFilters,
} from 'gtfs-sqljs';

// Progress Info type (defined locally as gtfs-sqljs doesn't export it)
interface ProgressInfo {
  phase: string;
  currentFile: string | null;
  filesCompleted: number;
  totalFiles: number;
  rowsProcessed: number;
  totalRows: number;
  bytesDownloaded?: number;
  totalBytes?: number;
  percentComplete: number;
  message: string;
}

let gtfsInstance: GtfsSqlJs | null = null;

const gtfsApi = {
  async initialize(
    url: string,
    onProgress: (progress: ProgressInfo) => void
  ): Promise<void> {
    // Close existing instance if any
    if (gtfsInstance) {
      gtfsInstance.close();
      gtfsInstance = null;
    }

    gtfsInstance = await GtfsSqlJs.fromZip(url, {
      onProgress: Comlink.proxy(onProgress),
    });
  },

  isReady(): boolean {
    return gtfsInstance !== null;
  },

  getStops(filters?: StopFilters): Stop[] {
    if (!gtfsInstance) {
      throw new Error('GTFS not initialized');
    }
    return gtfsInstance.getStops({ ...filters, limit: filters?.limit ?? 10 });
  },

  getRoutes(filters?: RouteFilters): Route[] {
    if (!gtfsInstance) {
      throw new Error('GTFS not initialized');
    }
    return gtfsInstance.getRoutes({ ...filters, limit: filters?.limit ?? 10 });
  },

  getTrips(filters?: TripFilters): Trip[] {
    if (!gtfsInstance) {
      throw new Error('GTFS not initialized');
    }
    return gtfsInstance.getTrips({ ...filters, limit: filters?.limit ?? 10 });
  },

  getStopTimes(filters?: StopTimeFilters): StopTime[] {
    if (!gtfsInstance) {
      throw new Error('GTFS not initialized');
    }
    return gtfsInstance.getStopTimes({ ...filters, limit: filters?.limit ?? 20 });
  },

  close(): void {
    if (gtfsInstance) {
      gtfsInstance.close();
      gtfsInstance = null;
    }
  },
};

export type GtfsWorkerApi = typeof gtfsApi;

Comlink.expose(gtfsApi);
