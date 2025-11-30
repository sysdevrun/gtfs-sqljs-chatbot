import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';

const SYSTEM_PROMPT = `You are a helpful transit assistant. You help users find information about bus routes, stops, and schedules using GTFS (General Transit Feed Specification) data.

Use the available tools to query the GTFS database:
- getStops: Search for transit stops by ID, code, name, or trip
- getRoutes: Search for transit routes/lines
- getTrips: Search for scheduled trips on routes
- getStopTimes: Get arrival/departure times at stops

Be concise in your responses as they will be spoken aloud. When presenting results:
- Summarize key information clearly
- Mention stop names and route names rather than just IDs when possible
- Format times in a human-readable way

If a query returns no results, suggest alternative search terms or approaches.`;

export const GTFS_TOOLS: Tool[] = [
  {
    name: 'getStops',
    description:
      'Search for transit stops/stations. Use to find stop IDs, names, and locations. You can search by stop ID, stop code, name (partial match), or get stops for a specific trip.',
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
    name: 'getRoutes',
    description:
      'Search for transit routes/lines. Use to find route IDs, names, and details. Returns route short name, long name, type, and colors.',
    input_schema: {
      type: 'object' as const,
      properties: {
        routeId: {
          type: 'string',
          description: 'Exact route ID to look up',
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
    name: 'getTrips',
    description:
      'Search for trips (scheduled journeys on a route). Use to find trip IDs, headsigns, and schedule information.',
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
          description: 'Filter by date in YYYYMMDD format (returns trips active on that date)',
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
      'Get scheduled arrival/departure times at stops. Use to find when buses/trains arrive at specific stops.',
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
          description: 'Filter by date in YYYYMMDD format',
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
  messages: MessageParam[]
): Promise<ClaudeResponse> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
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
