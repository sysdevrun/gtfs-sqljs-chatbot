import * as Comlink from 'comlink';
import initSqlJs from 'sql.js';
import type { SqlJsStatic } from 'sql.js';
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

// CORS proxy for fetching GTFS data
const PROXY_BASE = 'https://gtfs-proxy.sys-dev-run.re/proxy/';

const proxyUrl = (url: string): string => {
  // Don't proxy relative or absolute paths (local files)
  if (url.startsWith('./') || url.startsWith('/') || url.startsWith('../')) {
    return url;
  }

  // Only proxy remote HTTP/HTTPS URLs
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return PROXY_BASE + parsed.host + parsed.pathname + parsed.search;
    }
    return url;
  } catch {
    // If URL parsing fails, assume it's a relative path
    return url;
  }
};

let gtfsInstance: GtfsSqlJs | null = null;
let sqlInstance: SqlJsStatic | null = null;

// Initialize SQL.js with CDN WASM file
async function getSql(): Promise<SqlJsStatic> {
  if (!sqlInstance) {
    sqlInstance = await initSqlJs({
      locateFile: (file: string) =>
        `https://sql.js.org/dist/${file}`,
    });
  }
  return sqlInstance;
}

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

    // Get SQL.js instance (loads WASM from CDN)
    const SQL = await getSql();

    // Use proxy for CORS support
    const proxiedUrl = proxyUrl(url);

    gtfsInstance = await GtfsSqlJs.fromZip(proxiedUrl, {
      onProgress: Comlink.proxy(onProgress),
      SQL,
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
