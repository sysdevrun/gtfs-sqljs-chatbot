import type { GtfsWorkerApi } from '../workers/gtfs.worker';
import type { StopFilters, RouteFilters, TripFilters, StopTimeFilters } from '../types';

export type ToolName = 'getCurrentDateTime' | 'getStops' | 'getRoutes' | 'getTrips' | 'getStopTimes' | 'searchStopsByWords' | 'findItinerary' | 'findItineraryByName';

export interface ToolInput {
  [key: string]: unknown;
}

/**
 * Convert input to string or string array, preserving arrays
 */
function toStringOrArray(value: unknown): string | string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    return value.map(v => String(v));
  }
  return String(value);
}

/**
 * Get the current date and time in various formats useful for GTFS queries
 */
function getCurrentDateTime(): {
  date: string;
  time: string;
  dateYYYYMMDD: string;
  dayOfWeek: string;
  isoDateTime: string;
  timezone: string;
} {
  const now = new Date();

  // Get date in YYYYMMDD format (for GTFS date filters)
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateYYYYMMDD = `${year}${month}${day}`;

  // Get time in HH:MM:SS format
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const time = `${hours}:${minutes}:${seconds}`;

  // Get day of week
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = daysOfWeek[now.getDay()];

  // Get timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    date: `${year}-${month}-${day}`,
    time,
    dateYYYYMMDD,
    dayOfWeek,
    isoDateTime: now.toISOString(),
    timezone,
  };
}

export async function executeTool(
  gtfsApi: GtfsWorkerApi | null,
  toolName: string,
  input: ToolInput
): Promise<string> {
  try {
    let result: unknown;

    // getCurrentDateTime doesn't need GTFS
    if (toolName === 'getCurrentDateTime') {
      result = getCurrentDateTime();
      return JSON.stringify(result, null, 2);
    }

    // All other tools need GTFS
    if (!gtfsApi) {
      return JSON.stringify({ error: 'GTFS not initialized' });
    }

    switch (toolName) {
      case 'getStops': {
        const filters: StopFilters = {};
        const stopId = toStringOrArray(input.stopId);
        if (stopId) filters.stopId = stopId;
        if (input.stopCode) filters.stopCode = String(input.stopCode);
        if (input.name) filters.name = String(input.name);
        if (input.tripId) filters.tripId = String(input.tripId);
        if (input.limit) filters.limit = Number(input.limit);
        result = await gtfsApi.getStops(filters);
        break;
      }

      case 'getRoutes': {
        const filters: RouteFilters = {};
        const routeId = toStringOrArray(input.routeId);
        const agencyId = toStringOrArray(input.agencyId);
        if (routeId) filters.routeId = routeId;
        if (agencyId) filters.agencyId = agencyId;
        if (input.limit) filters.limit = Number(input.limit);
        result = await gtfsApi.getRoutes(filters);
        break;
      }

      case 'getTrips': {
        const filters: TripFilters = {};
        const tripId = toStringOrArray(input.tripId);
        const routeId = toStringOrArray(input.routeId);
        const serviceIds = toStringOrArray(input.serviceIds);
        if (tripId) filters.tripId = tripId;
        if (routeId) filters.routeId = routeId;
        if (serviceIds) filters.serviceIds = serviceIds;
        if (input.directionId !== undefined) filters.directionId = Number(input.directionId);
        // If date is provided and no serviceIds, get active service IDs for that date
        if (input.date && !serviceIds) {
          const activeServiceIds = await gtfsApi.getActiveServiceIds(String(input.date));
          if (activeServiceIds.length > 0) {
            filters.serviceIds = activeServiceIds;
          }
        }
        if (input.limit) filters.limit = Number(input.limit);
        result = await gtfsApi.getTrips(filters);
        break;
      }

      case 'getStopTimes': {
        const filters: StopTimeFilters = {};
        const tripId = toStringOrArray(input.tripId);
        const stopId = toStringOrArray(input.stopId);
        const routeId = toStringOrArray(input.routeId);
        const serviceIds = toStringOrArray(input.serviceIds);
        if (tripId) filters.tripId = tripId;
        if (stopId) filters.stopId = stopId;
        if (routeId) filters.routeId = routeId;
        if (serviceIds) filters.serviceIds = serviceIds;
        // If date is provided and no serviceIds, get active service IDs for that date
        if (input.date && !serviceIds) {
          const activeServiceIds = await gtfsApi.getActiveServiceIds(String(input.date));
          if (activeServiceIds.length > 0) {
            filters.serviceIds = activeServiceIds;
          }
        }
        if (input.limit) filters.limit = Number(input.limit);
        result = await gtfsApi.getStopTimes(filters);
        break;
      }

      case 'searchStopsByWords': {
        const query = String(input.query || '');
        const limit = input.limit ? Number(input.limit) : 20;
        result = await gtfsApi.searchStopsByWords(query, limit);
        break;
      }

      case 'findItinerary': {
        const startStopId = String(input.startStopId || '');
        const endStopId = String(input.endStopId || '');
        const date = String(input.date || '');
        const departureTime = String(input.departureTime || '');
        const options: {
          maxPaths?: number;
          maxTransfers?: number;
          minTransferDuration?: number;
          journeysCount?: number;
        } = {};
        if (input.maxTransfers !== undefined) options.maxTransfers = Number(input.maxTransfers);
        if (input.journeysCount !== undefined) options.journeysCount = Number(input.journeysCount);
        result = await gtfsApi.findItinerary(startStopId, endStopId, date, departureTime, options);
        break;
      }

      case 'findItineraryByName': {
        const startName = String(input.startName || '');
        const endName = String(input.endName || '');
        const date = String(input.date || '');
        const departureTime = String(input.departureTime || '');
        const options: {
          maxTransfers?: number;
          journeysCount?: number;
        } = {};
        if (input.maxTransfers !== undefined) options.maxTransfers = Number(input.maxTransfers);
        if (input.journeysCount !== undefined) options.journeysCount = Number(input.journeysCount);
        result = await gtfsApi.findItineraryByName(startName, endName, date, departureTime, options);
        break;
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }

    // Return result as JSON string
    return JSON.stringify(result, null, 2);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ error: message });
  }
}
