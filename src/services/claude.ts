import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';

// Helper for defining parameters that accept string or array of strings
const stringOrArraySchema = (description: string) => ({
  oneOf: [
    { type: 'string' as const },
    { type: 'array' as const, items: { type: 'string' as const } },
  ],
  description,
});

export const GTFS_TOOLS: Tool[] = [
  {
    name: 'getCurrentDateTime',
    description:
      'Get the current date and time. ALWAYS call this tool first before any other GTFS queries to know the current date for filtering trips and schedules.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'getRoutes',
    description:
      'Search for transit routes/lines. Returns route short name (the main identifier to use when referring to routes), long name, type, and colors. NEVER refer to routes by their internal ID - always use route_short_name. Can query multiple routes at once by passing an array of IDs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        routeId: stringOrArraySchema('Route ID(s) to look up - single string or array of strings'),
        agencyId: stringOrArraySchema('Filter routes by agency ID(s) - single string or array of strings'),
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
    },
  },
  {
    name: 'getStops',
    description:
      'Search for transit stops/stations. You can search by stop ID (single or multiple), stop code, name (partial match), or get stops for a specific trip. Note: stops often have parent stops that have no stop times - always check child stops too. Use arrays to query multiple stops at once.',
    input_schema: {
      type: 'object' as const,
      properties: {
        stopId: stringOrArraySchema('Stop ID(s) to look up - single string or array of strings for batch lookup'),
        stopCode: {
          type: 'string',
          description: 'Stop code (rider-facing identifier)',
        },
        name: {
          type: 'string',
          description: 'Stop name to search for (partial match supported)',
        },
        tripId: {
          type: 'string',
          description: 'Get all stops for a specific trip ID',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
    },
  },
  {
    name: 'searchStopsByWords',
    description:
      'Search for stops by splitting a query into individual words and finding stops matching any word. Use this when the stop name may be incomplete or when the user mentions only part of the stop name. Returns all matching stops with a match score.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (will be split into words, each word searched separately)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 20)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'getTrips',
    description:
      'Search for trips (scheduled journeys on a route). Returns trip_headsign (the main identifier to use when referring to trips) and schedule information. ALWAYS pass the date parameter to filter active trips. Use trip_headsign to describe trips to users, never the trip ID. Can query multiple trips/routes at once using arrays.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tripId: stringOrArraySchema('Trip ID(s) to look up - single string or array of strings'),
        routeId: stringOrArraySchema('Filter trips by route ID(s) - single string or array of strings to query multiple routes'),
        serviceIds: stringOrArraySchema('Filter by service ID(s) - single string or array of strings'),
        directionId: {
          type: 'number',
          description: 'Direction of travel (0 or 1)',
        },
        date: {
          type: 'string',
          description: 'REQUIRED: Filter by date in YYYYMMDD format (returns trips active on that date). Get this from getCurrentDateTime first.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
    },
  },
  {
    name: 'getStopTimes',
    description:
      'Get scheduled arrival/departure times at stops. ALWAYS pass the date parameter to filter schedules. Can query multiple stops or trips at once using arrays. If no results for a stop, try searching for child stops with the same name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tripId: stringOrArraySchema('Filter by trip ID(s) - single string or array of strings to get schedules for multiple trips'),
        stopId: stringOrArraySchema('Filter by stop ID(s) - single string or array of strings to get arrivals at multiple stops'),
        routeId: stringOrArraySchema('Filter by route ID(s) - single string or array of strings'),
        serviceIds: stringOrArraySchema('Filter by service ID(s) - single string or array of strings'),
        date: {
          type: 'string',
          description: 'REQUIRED: Filter by date in YYYYMMDD format. Get this from getCurrentDateTime first.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 20)',
        },
      },
    },
  },
  {
    name: 'findItinerary',
    description:
      'Low-level tool to find transit itineraries between two stops using stop IDs. Returns raw data that requires additional calls to resolve names. PREFER using findItineraryByName instead, which handles name resolution automatically.',
    input_schema: {
      type: 'object' as const,
      properties: {
        startStopId: {
          type: 'string',
          description: 'The starting stop ID. Use searchStopsByWords or getStops first to find the stop ID.',
        },
        endStopId: {
          type: 'string',
          description: 'The destination stop ID. Use searchStopsByWords or getStops first to find the stop ID.',
        },
        date: {
          type: 'string',
          description: 'REQUIRED: Date in YYYYMMDD format. Get this from getCurrentDateTime first.',
        },
        departureTime: {
          type: 'string',
          description: 'Departure time in HH:MM:SS format (e.g., "08:30:00"). Get current time from getCurrentDateTime if user wants to leave now.',
        },
        maxTransfers: {
          type: 'number',
          description: 'Maximum number of transfers allowed (default: 3)',
        },
        journeysCount: {
          type: 'number',
          description: 'Number of journey options to return (default: 3)',
        },
      },
      required: ['startStopId', 'endStopId', 'date', 'departureTime'],
    },
  },
  {
    name: 'findItineraryByName',
    description:
      'PREFERRED tool for finding transit itineraries. Accepts stop names (fuzzy matching supported) instead of IDs. Returns fully resolved data with stop names, route names, and trip headsigns ready for presentation. Use this tool when a user wants to travel from one location to another. Call getCurrentDateTime first to get the date and time.',
    input_schema: {
      type: 'object' as const,
      properties: {
        startName: {
          type: 'string',
          description: 'The starting stop name (fuzzy matching supported). Example: "Gare Centrale", "Centre Ville"',
        },
        endName: {
          type: 'string',
          description: 'The destination stop name (fuzzy matching supported). Example: "Place Liberté", "Aéroport"',
        },
        date: {
          type: 'string',
          description: 'REQUIRED: Date in YYYYMMDD format. Get this from getCurrentDateTime first.',
        },
        departureTime: {
          type: 'string',
          description: 'Departure time in HH:MM:SS format (e.g., "14:30:00"). Get current time from getCurrentDateTime if user wants to leave now.',
        },
        maxTransfers: {
          type: 'number',
          description: 'Maximum number of transfers allowed (default: 3)',
        },
        journeysCount: {
          type: 'number',
          description: 'Number of journey options to return (default: 3)',
        },
      },
      required: ['startName', 'endName', 'date', 'departureTime'],
    },
  },
];

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ClaudeResponse {
  content: Anthropic.ContentBlock[];
  stopReason: string | null;
  usage: TokenUsage;
}

export async function sendMessage(
  apiKey: string,
  messages: MessageParam[],
  systemPrompt: string,
  model: string = 'claude-sonnet-4-5-20250929'
): Promise<ClaudeResponse> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    tools: GTFS_TOOLS,
    messages,
  });

  return {
    content: response.content,
    stopReason: response.stop_reason,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

export function extractTextFromContent(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

export function extractToolUseFromContent(
  content: Anthropic.ContentBlock[]
): Anthropic.ToolUseBlock[] {
  return content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );
}
