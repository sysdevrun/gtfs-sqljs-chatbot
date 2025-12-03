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

// Types for findItineraryByName
interface ResolvedStop {
  stop_id: string;
  stop_name: string;
}

interface ResolvedStopWithScore extends ResolvedStop {
  matchScore: number;
  matchedWords: string[];
}

interface ResolvedRoute {
  route_id: string;
  route_short_name: string;
  route_long_name?: string;
}

interface ResolvedLeg {
  fromStop: ResolvedStop;
  toStop: ResolvedStop;
  route?: ResolvedRoute;
  tripHeadsign?: string;
  departureTime: string;
  arrivalTime: string;
  isTransfer: boolean;
}

interface ResolvedJourney {
  departureTime: string;
  arrivalTime: string;
  totalDuration: number;
  transfers: number;
  legs: ResolvedLeg[];
}

interface FindItineraryByNameSuccess {
  status: 'success';
  startStop: ResolvedStopWithScore;
  endStop: ResolvedStopWithScore;
  journeys: ResolvedJourney[];
  alternativeStartStops?: ResolvedStopWithScore[];
  alternativeEndStops?: ResolvedStopWithScore[];
}

interface FindItineraryByNameError {
  status: 'error';
  errorType:
    | 'START_STOP_NOT_FOUND'
    | 'END_STOP_NOT_FOUND'
    | 'BOTH_STOPS_NOT_FOUND'
    | 'AMBIGUOUS_START_STOP'
    | 'AMBIGUOUS_END_STOP'
    | 'NO_ITINERARY_FOUND'
    | 'SAME_START_AND_END'
    | 'INVALID_DATE_TIME';
  message: string;
  [key: string]: unknown;
}

type FindItineraryByNameResult = FindItineraryByNameSuccess | FindItineraryByNameError;

/**
 * Convert seconds since midnight to HH:MM:SS format
 */
function secondsToTimeString(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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

  /**
   * Find itineraries between two stops using fuzzy name matching.
   * Combines stop search, itinerary computation, and name resolution in one call.
   * Returns fully resolved data with human-readable names.
   */
  findItineraryByName(
    startName: string,
    endName: string,
    date: string,
    departureTime: string,
    options?: {
      maxTransfers?: number;
      journeysCount?: number;
    }
  ): FindItineraryByNameResult {
    if (!gtfsInstance) {
      throw new Error('GTFS not initialized');
    }

    // 1. Validate date format (YYYYMMDD)
    if (!/^\d{8}$/.test(date)) {
      return {
        status: 'error',
        errorType: 'INVALID_DATE_TIME',
        message: 'Invalid date format',
        providedDate: date,
        expectedDateFormat: 'YYYYMMDD (e.g., 20251203)',
      };
    }

    // 2. Validate time format (HH:MM:SS or HH:MM)
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(departureTime)) {
      return {
        status: 'error',
        errorType: 'INVALID_DATE_TIME',
        message: 'Invalid time format',
        providedTime: departureTime,
        expectedTimeFormat: 'HH:MM:SS (e.g., 14:30:00)',
      };
    }

    // Normalize time to HH:MM:SS
    const normalizedTime = departureTime.length === 5 ? `${departureTime}:00` : departureTime;

    // 3. Search for start stop
    const startStops = this.searchStopsByWords(startName, 10);

    // 4. Search for end stop
    const endStops = this.searchStopsByWords(endName, 10);

    // 5. Check if both not found
    if (startStops.length === 0 && endStops.length === 0) {
      return {
        status: 'error',
        errorType: 'BOTH_STOPS_NOT_FOUND',
        message: `No stops found matching '${startName}' (start) or '${endName}' (end)`,
        startQuery: startName,
        endQuery: endName,
        suggestion: 'Verify both stop names and try again with different spellings',
      };
    }

    // 6. Check if start not found
    if (startStops.length === 0) {
      return {
        status: 'error',
        errorType: 'START_STOP_NOT_FOUND',
        message: `No stop found matching '${startName}'`,
        searchedQuery: startName,
        suggestion: 'Check spelling or try a shorter/different name',
      };
    }

    // 7. Check if end not found
    if (endStops.length === 0) {
      return {
        status: 'error',
        errorType: 'END_STOP_NOT_FOUND',
        message: `No stop found matching '${endName}'`,
        searchedQuery: endName,
        suggestion: 'Check spelling or try a shorter/different name',
      };
    }

    // 8. Check for ambiguous start stop
    // Ambiguous if top 3+ stops have the same score and none is exact match
    const startTopScore = startStops[0].matchScore;
    const startSameScoreCount = startStops.filter(s => s.matchScore === startTopScore).length;
    const startHasExactMatch = startStops.some(
      s => s.stop_name?.toLowerCase().trim() === startName.toLowerCase().trim()
    );

    if (startSameScoreCount >= 3 && !startHasExactMatch) {
      const candidates = startStops
        .filter(s => s.matchScore === startTopScore)
        .slice(0, 5)
        .map(s => ({
          stop_id: s.stop_id,
          stop_name: s.stop_name || '',
          matchScore: s.matchScore,
        }));

      return {
        status: 'error',
        errorType: 'AMBIGUOUS_START_STOP',
        message: `Multiple stops match '${startName}'. Please be more specific.`,
        searchedQuery: startName,
        candidates,
        suggestion: `Specify which stop: ${candidates.map(c => c.stop_name).join(', ')}?`,
      };
    }

    // 9. Check for ambiguous end stop
    const endTopScore = endStops[0].matchScore;
    const endSameScoreCount = endStops.filter(s => s.matchScore === endTopScore).length;
    const endHasExactMatch = endStops.some(
      s => s.stop_name?.toLowerCase().trim() === endName.toLowerCase().trim()
    );

    if (endSameScoreCount >= 3 && !endHasExactMatch) {
      const candidates = endStops
        .filter(s => s.matchScore === endTopScore)
        .slice(0, 5)
        .map(s => ({
          stop_id: s.stop_id,
          stop_name: s.stop_name || '',
          matchScore: s.matchScore,
        }));

      return {
        status: 'error',
        errorType: 'AMBIGUOUS_END_STOP',
        message: `Multiple stops match '${endName}'. Please be more specific.`,
        searchedQuery: endName,
        candidates,
        suggestion: `Specify which stop: ${candidates.map(c => c.stop_name).join(', ')}?`,
      };
    }

    // Select best matching stops
    const selectedStart = startStops[0];
    const selectedEnd = endStops[0];

    // 10. Check if same start and end
    if (selectedStart.stop_id === selectedEnd.stop_id) {
      return {
        status: 'error',
        errorType: 'SAME_START_AND_END',
        message: `Start and end stops are the same ('${selectedStart.stop_name}')`,
        stop: {
          stop_id: selectedStart.stop_id,
          stop_name: selectedStart.stop_name || '',
        },
      };
    }

    // 11. Find itinerary
    const itineraryResult = this.findItinerary(
      selectedStart.stop_id,
      selectedEnd.stop_id,
      date,
      normalizedTime,
      {
        maxTransfers: options?.maxTransfers ?? 3,
        journeysCount: options?.journeysCount ?? 3,
      }
    );

    // 12. Check if no journeys found
    if (itineraryResult.journeys.length === 0) {
      // Format date for display
      const year = date.substring(0, 4);
      const month = date.substring(4, 6);
      const day = date.substring(6, 8);
      const formattedDate = `${year}-${month}-${day}`;

      return {
        status: 'error',
        errorType: 'NO_ITINERARY_FOUND',
        message: `No transit route found between '${selectedStart.stop_name}' and '${selectedEnd.stop_name}' on ${formattedDate} at ${normalizedTime}`,
        startStop: {
          stop_id: selectedStart.stop_id,
          stop_name: selectedStart.stop_name || '',
        },
        endStop: {
          stop_id: selectedEnd.stop_id,
          stop_name: selectedEnd.stop_name || '',
        },
        date,
        departureTime: normalizedTime,
        possibleReasons: [
          'No service running at this time',
          'Stops not connected by transit network',
          'Try a different departure time or date',
        ],
      };
    }

    // 13. Collect all unique stop IDs from journeys
    const stopIds = new Set<string>();
    const tripIds = new Set<string>();

    for (const journey of itineraryResult.journeys) {
      for (const leg of journey.legs) {
        stopIds.add(leg.startStop);
        stopIds.add(leg.endStop);
        if (leg.tripId) tripIds.add(leg.tripId);
      }
    }

    // 14. Resolve stop names
    const stopsData = gtfsInstance.getStops({
      stopId: Array.from(stopIds),
      limit: stopIds.size + 10,
    });
    const stopMap = new Map<string, Stop>();
    for (const stop of stopsData) {
      stopMap.set(stop.stop_id, stop);
    }

    // 15. Resolve trip headsigns
    const tripsData = tripIds.size > 0
      ? gtfsInstance.getTrips({
          tripId: Array.from(tripIds),
          limit: tripIds.size + 10,
        })
      : [];
    const tripMap = new Map<string, Trip>();
    for (const trip of tripsData) {
      tripMap.set(trip.trip_id, trip);
    }

    // 16. Build resolved journeys
    // Note: ScheduledLeg from gtfs-sqljs-itinerary uses startStop/endStop and includes routeShortName directly
    const resolvedJourneys: ResolvedJourney[] = itineraryResult.journeys.map(journey => {
      const resolvedLegs: ResolvedLeg[] = journey.legs.map(leg => {
        const fromStop = stopMap.get(leg.startStop);
        const toStop = stopMap.get(leg.endStop);
        const trip = leg.tripId ? tripMap.get(leg.tripId) : undefined;

        const resolvedLeg: ResolvedLeg = {
          fromStop: {
            stop_id: leg.startStop,
            stop_name: fromStop?.stop_name || leg.startStop,
          },
          toStop: {
            stop_id: leg.endStop,
            stop_name: toStop?.stop_name || leg.endStop,
          },
          departureTime: secondsToTimeString(leg.departureTime),
          arrivalTime: secondsToTimeString(leg.arrivalTime),
          isTransfer: false, // The library doesn't include transfer legs in ScheduledJourney
        };

        // Use routeShortName from the leg directly (provided by gtfs-sqljs-itinerary)
        if (leg.routeShortName) {
          resolvedLeg.route = {
            route_id: '', // Not provided by library
            route_short_name: leg.routeShortName,
          };
        }

        if (trip?.trip_headsign) {
          resolvedLeg.tripHeadsign = trip.trip_headsign;
        }

        return resolvedLeg;
      });

      // Calculate transfers (number of legs - 1, since each leg change is a transfer)
      const transfers = Math.max(0, resolvedLegs.length - 1);

      return {
        departureTime: secondsToTimeString(journey.departureTime),
        arrivalTime: secondsToTimeString(journey.arrivalTime),
        totalDuration: Math.round(journey.totalDuration / 60), // Convert to minutes
        transfers,
        legs: resolvedLegs,
      };
    });

    // 18. Build alternative stops if there are other good matches
    const alternativeStartStops = startStops.length > 1
      ? startStops.slice(1, 4).map(s => ({
          stop_id: s.stop_id,
          stop_name: s.stop_name || '',
          matchScore: s.matchScore,
          matchedWords: s.matchedWords,
        }))
      : undefined;

    const alternativeEndStops = endStops.length > 1
      ? endStops.slice(1, 4).map(s => ({
          stop_id: s.stop_id,
          stop_name: s.stop_name || '',
          matchScore: s.matchScore,
          matchedWords: s.matchedWords,
        }))
      : undefined;

    // 19. Return success response
    return {
      status: 'success',
      startStop: {
        stop_id: selectedStart.stop_id,
        stop_name: selectedStart.stop_name || '',
        matchScore: selectedStart.matchScore,
        matchedWords: selectedStart.matchedWords,
      },
      endStop: {
        stop_id: selectedEnd.stop_id,
        stop_name: selectedEnd.stop_name || '',
        matchScore: selectedEnd.matchScore,
        matchedWords: selectedEnd.matchedWords,
      },
      journeys: resolvedJourneys,
      alternativeStartStops,
      alternativeEndStops,
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
