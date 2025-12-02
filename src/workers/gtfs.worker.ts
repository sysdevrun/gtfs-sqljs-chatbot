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
import { GraphBuilder } from 'gtfs-sqljs-itinerary';
import type { ScheduledJourney, PathSegment } from 'gtfs-sqljs-itinerary';

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

interface StopWithScore extends Stop {
  matchScore: number;
  matchedWords: string[];
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

  /**
   * Get active service IDs for a specific date.
   * Uses GTFS calendar and calendar_dates to determine which services are active.
   */
  getActiveServiceIds(date: string): string[] {
    if (!gtfsInstance) {
      throw new Error('GTFS not initialized');
    }

    // Get exceptions for this date (added or removed services)
    const calendarDates = gtfsInstance.getCalendarDatesForDate(date);
    const addedServices = new Set<string>();
    const removedServices = new Set<string>();

    for (const cd of calendarDates) {
      if (cd.exception_type === 1) {
        addedServices.add(cd.service_id);
      } else if (cd.exception_type === 2) {
        removedServices.add(cd.service_id);
      }
    }

    // Parse the date to get day of week
    const year = parseInt(date.substring(0, 4), 10);
    const month = parseInt(date.substring(4, 6), 10) - 1;
    const day = parseInt(date.substring(6, 8), 10);
    const dateObj = new Date(year, month, day);
    const dayOfWeek = dateObj.getDay(); // 0=Sunday, 1=Monday, etc.

    const dayNames: ('sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday')[] =
      ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];

    // Get all trips to find unique service IDs, then check each calendar
    const trips = gtfsInstance.getTrips({ limit: 10000 });
    const uniqueServiceIds = new Set(trips.map(t => t.service_id).filter(Boolean));

    const activeServices: string[] = [];

    for (const serviceId of uniqueServiceIds) {
      // Skip if removed by calendar_dates
      if (removedServices.has(serviceId)) continue;

      // If added by calendar_dates, include it
      if (addedServices.has(serviceId)) {
        activeServices.push(serviceId);
        continue;
      }

      // Check regular calendar
      const calendar = gtfsInstance.getCalendarByServiceId(serviceId);
      if (calendar) {
        // Check if date is within service date range
        if (date >= calendar.start_date && date <= calendar.end_date) {
          // Check if service runs on this day of week
          if (calendar[dayName] === 1) {
            activeServices.push(serviceId);
          }
        }
      }
    }

    return activeServices;
  },

  /**
   * Search for stops by splitting the query into words and finding stops matching any word.
   * This is useful when the stop name may be incomplete or misspelled.
   * Returns stops with a match score indicating how many words matched.
   */
  searchStopsByWords(query: string, limit: number = 20): StopWithScore[] {
    if (!gtfsInstance) {
      throw new Error('GTFS not initialized');
    }

    // Split query into words, filter out short words and normalize
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length >= 2)
      .map(word => word.normalize('NFD').replace(/[\u0300-\u036f]/g, '')); // Remove accents

    if (words.length === 0) {
      return [];
    }

    // Search for each word and collect results
    const stopMap = new Map<string, StopWithScore>();

    for (const word of words) {
      const stops = gtfsInstance.getStops({ name: word, limit: 100 });

      for (const stop of stops) {
        const existing = stopMap.get(stop.stop_id);
        if (existing) {
          // Increment match score and add matched word
          existing.matchScore += 1;
          if (!existing.matchedWords.includes(word)) {
            existing.matchedWords.push(word);
          }
        } else {
          stopMap.set(stop.stop_id, {
            ...stop,
            matchScore: 1,
            matchedWords: [word],
          });
        }
      }
    }

    // Sort by match score (descending), then by stop name
    const results = Array.from(stopMap.values())
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore;
        }
        return (a.stop_name || '').localeCompare(b.stop_name || '');
      })
      .slice(0, limit);

    return results;
  },

  /**
   * Find itineraries between two stops.
   * Uses graph-based path finding and matches with scheduled trips.
   * @param startStopId - The starting stop ID
   * @param endStopId - The destination stop ID
   * @param date - Date in YYYYMMDD format
   * @param departureTime - Departure time in HH:MM:SS format
   * @param options - Optional parameters
   * @returns Array of scheduled journeys
   */
  findItinerary(
    startStopId: string,
    endStopId: string,
    date: string,
    departureTime: string,
    options?: {
      maxPaths?: number;
      maxTransfers?: number;
      minTransferDuration?: number;
      journeysCount?: number;
    }
  ): { journeys: ScheduledJourney[]; paths: PathSegment[][] } {
    if (!gtfsInstance) {
      throw new Error('GTFS not initialized');
    }

    const maxPaths = options?.maxPaths ?? 2;
    const maxTransfers = options?.maxTransfers ?? 3;
    const minTransferDuration = options?.minTransferDuration ?? 300; // 5 minutes default
    const journeysCount = options?.journeysCount ?? 2;

    // Create graph builder and build graph for the date
    const graphBuilder = new GraphBuilder(gtfsInstance);
    graphBuilder.buildGraph(date);

    // Find all possible paths
    const paths = graphBuilder.findAllPaths(startStopId, endStopId, maxPaths, maxTransfers);

    if (paths.length === 0) {
      return { journeys: [], paths: [] };
    }

    // Convert departure time to seconds since midnight
    const timeParts = departureTime.split(':').map(Number);
    const departureSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + (timeParts[2] || 0);

    // Find scheduled trips for each path and collect all journeys
    const allJourneys: ScheduledJourney[] = [];
    const usedPaths: PathSegment[][] = [];

    for (const path of paths) {
      const journeys = GraphBuilder.findScheduledTrips(
        gtfsInstance,
        path,
        date,
        departureSeconds,
        minTransferDuration,
        journeysCount
      );
      if (journeys.length > 0) {
        allJourneys.push(...journeys);
        usedPaths.push(path);
      }
    }

    // Sort by departure time and limit results
    allJourneys.sort((a, b) => a.departureTime - b.departureTime);

    return {
      journeys: allJourneys.slice(0, journeysCount),
      paths: usedPaths,
    };
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
