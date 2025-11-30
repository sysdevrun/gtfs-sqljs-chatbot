import type { GtfsWorkerApi } from '../workers/gtfs.worker';
import type { StopFilters, RouteFilters, TripFilters, StopTimeFilters } from '../types';

export type ToolName = 'getStops' | 'getRoutes' | 'getTrips' | 'getStopTimes';

export interface ToolInput {
  [key: string]: unknown;
}

export async function executeTool(
  gtfsApi: GtfsWorkerApi,
  toolName: string,
  input: ToolInput
): Promise<string> {
  try {
    let result: unknown;

    switch (toolName) {
      case 'getStops': {
        const filters: StopFilters = {};
        if (input.stopId) filters.stopId = String(input.stopId);
        if (input.stopCode) filters.stopCode = String(input.stopCode);
        if (input.name) filters.name = String(input.name);
        if (input.tripId) filters.tripId = String(input.tripId);
        if (input.limit) filters.limit = Number(input.limit);
        result = await gtfsApi.getStops(filters);
        break;
      }

      case 'getRoutes': {
        const filters: RouteFilters = {};
        if (input.routeId) filters.routeId = String(input.routeId);
        if (input.agencyId) filters.agencyId = String(input.agencyId);
        if (input.limit) filters.limit = Number(input.limit);
        result = await gtfsApi.getRoutes(filters);
        break;
      }

      case 'getTrips': {
        const filters: TripFilters = {};
        if (input.tripId) filters.tripId = String(input.tripId);
        if (input.routeId) filters.routeId = String(input.routeId);
        if (input.serviceIds) {
          const ids = String(input.serviceIds);
          filters.serviceIds = ids.includes(',') ? ids.split(',').map((s) => s.trim()) : ids;
        }
        if (input.directionId !== undefined) filters.directionId = Number(input.directionId);
        if (input.limit) filters.limit = Number(input.limit);
        // Note: date filter is handled by gtfs-sqljs internally
        result = await gtfsApi.getTrips(filters);
        break;
      }

      case 'getStopTimes': {
        const filters: StopTimeFilters = {};
        if (input.tripId) filters.tripId = String(input.tripId);
        if (input.stopId) filters.stopId = String(input.stopId);
        if (input.routeId) filters.routeId = String(input.routeId);
        if (input.serviceIds) {
          const ids = String(input.serviceIds);
          filters.serviceIds = ids.includes(',') ? ids.split(',').map((s) => s.trim()) : ids;
        }
        if (input.limit) filters.limit = Number(input.limit);
        result = await gtfsApi.getStopTimes(filters);
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
