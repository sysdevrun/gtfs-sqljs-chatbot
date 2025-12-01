import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';

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
      'Search for transit routes/lines. Returns route short name (the main identifier to use when referring to routes), long name, type, and colors. NEVER refer to routes by their internal ID - always use route_short_name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        routeId: {
          type: 'string',
          description: 'Exact route ID to look up (internal use only)',
        },
        agencyId: {
          type: 'string',
          description: 'Filter routes by agency ID',
        },
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
      'Search for transit stops/stations. You can search by stop ID, stop code, name (partial match), or get stops for a specific trip. Note: stops often have parent stops that have no stop times - always check child stops too.',
    input_schema: {
      type: 'object' as const,
      properties: {
        stopId: {
          type: 'string',
          description: 'Exact stop ID to look up',
        },
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
      'Search for trips (scheduled journeys on a route). Returns trip_headsign (the main identifier to use when referring to trips) and schedule information. ALWAYS pass the date parameter to filter active trips. Use trip_headsign to describe trips to users, never the trip ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tripId: {
          type: 'string',
          description: 'Exact trip ID to look up',
        },
        routeId: {
          type: 'string',
          description: 'Filter trips by route ID',
        },
        serviceIds: {
          type: 'string',
          description: 'Filter by service ID (or comma-separated list)',
        },
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
      'Get scheduled arrival/departure times at stops. ALWAYS pass the date parameter to filter schedules. If no results for a stop, try searching for child stops with the same name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tripId: {
          type: 'string',
          description: 'Filter by trip ID to get all stops for a trip',
        },
        stopId: {
          type: 'string',
          description: 'Filter by stop ID to get all arrivals at a stop',
        },
        routeId: {
          type: 'string',
          description: 'Filter by route ID',
        },
        serviceIds: {
          type: 'string',
          description: 'Filter by service ID (or comma-separated list)',
        },
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
];

export interface ClaudeResponse {
  content: Anthropic.ContentBlock[];
  stopReason: string | null;
}

export async function sendMessage(
  apiKey: string,
  messages: MessageParam[],
  systemPrompt: string
): Promise<ClaudeResponse> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    tools: GTFS_TOOLS,
    messages,
  });

  return {
    content: response.content,
    stopReason: response.stop_reason,
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
