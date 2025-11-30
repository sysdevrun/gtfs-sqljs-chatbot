# GTFS Voice Chatbot - Architecture Document

## Overview

A browser-based voice chatbot that allows users to query GTFS transit data using natural language. The application uses Web Speech API for voice input/output, Claude API for natural language understanding, and executes GTFS queries locally in a web worker.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS v3
- **State Management**: Zustand
- **Worker Communication**: Comlink
- **GTFS Data**: gtfs-sqljs (loaded in web worker)
- **AI**: Claude API (direct browser access)
- **Speech**: Web Speech API (SpeechRecognition + SpeechSynthesis)
- **Deployment**: GitHub Pages

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Browser (Main Thread)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         React Application                          │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │ │
│  │  │  Voice Tab   │  │ Settings Tab │  │       Debug Tab          │ │ │
│  │  │              │  │              │  │                          │ │ │
│  │  │ [🎤 Speak]   │  │ • API Key    │  │ • Conversation history   │ │ │
│  │  │ [🔄 Restart] │  │ • GTFS URL   │  │ • Tool calls & params    │ │ │
│  │  │              │  │              │  │ • Tool responses         │ │ │
│  │  │ Loading bar  │  │ [Save]       │  │ • Timestamps             │ │ │
│  │  │ Response     │  │              │  │                          │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │ │
│  │                                                                    │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                         Zustand Stores                             │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐    │ │
│  │  │ settingsStore│ │ chatStore   │  │ debugStore              │    │ │
│  │  │ • apiKey    │  │ • messages  │  │ • logs[]                │    │ │
│  │  │ • gtfsUrl   │  │ • isLoading │  │ • addLog()              │    │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘    │ │
│  │                                                                    │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                           Hooks                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │  │ useVoiceChat                                                 │  │ │
│  │  │ • Orchestrates STT → Claude → Tool Execution → TTS flow     │  │ │
│  │  │ • Manages conversation state                                 │  │ │
│  │  │ • Handles multi-turn tool calls                              │  │ │
│  │  └─────────────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │  │ useGtfsWorker                                                │  │ │
│  │  │ • Initializes worker with Comlink                            │  │ │
│  │  │ • Exposes GTFS methods to main thread                        │  │ │
│  │  │ • Handles loading progress                                   │  │ │
│  │  └─────────────────────────────────────────────────────────────┘  │ │
│  │                                                                    │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                          Services                                  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │ │
│  │  │ speech.ts    │  │ claude.ts    │  │ toolExecutor.ts      │     │ │
│  │  │              │  │              │  │                      │     │ │
│  │  │ • startSTT() │  │ • chat()     │  │ • executeTool()      │     │ │
│  │  │ • speak()    │  │ • tools def  │  │ • routes to worker   │     │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘     │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│                              ▼ Comlink                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                           Web Worker Thread                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ gtfs.worker.ts                                                      │ │
│  │                                                                     │ │
│  │  ┌─────────────────────────────────────────────────────────────┐   │ │
│  │  │ GtfsApi (Comlink.expose)                                     │   │ │
│  │  │                                                              │   │ │
│  │  │ • initialize(url, onProgress)  → loads GTFS from ZIP         │   │ │
│  │  │ • getStops(filters)            → Stop[]                      │   │ │
│  │  │ • getRoutes(filters)           → Route[]                     │   │ │
│  │  │ • getTrips(filters)            → Trip[]                      │   │ │
│  │  │ • getStopTimes(filters)        → StopTime[]                  │   │ │
│  │  │ • isReady()                    → boolean                     │   │ │
│  │  └─────────────────────────────────────────────────────────────┘   │ │
│  │                                                                     │ │
│  │  ┌─────────────────────────────────────────────────────────────┐   │ │
│  │  │ gtfs-sqljs instance (GtfsSqlJs)                              │   │ │
│  │  │ • Loaded from ZIP URL                                        │   │ │
│  │  │ • SQLite database in memory                                  │   │ │
│  │  └─────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘

                              ▼ HTTPS

┌─────────────────────────────────────────────────────────────────────────┐
│                         External Services                                │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │ Claude API               │  │ GTFS Feed Server                     │ │
│  │ api.anthropic.com        │  │ (default: pysae.com Car Jaune)       │ │
│  │                          │  │                                      │ │
│  │ • Direct browser access  │  │ • Returns ZIP file                   │ │
│  │ • Tool use enabled       │  │ • CORS enabled                       │ │
│  └──────────────────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── components/
│   ├── App.tsx                 # Main app with tab navigation
│   ├── VoiceTab.tsx            # Mic button, progress bar, response display
│   ├── SettingsTab.tsx         # API key and GTFS URL configuration
│   └── DebugTab.tsx            # Conversation and tool call logs
├── services/
│   ├── speech.ts               # Web Speech API wrappers (STT/TTS)
│   ├── claude.ts               # Claude API client with tool definitions
│   └── toolExecutor.ts         # Routes tool calls to worker
├── workers/
│   └── gtfs.worker.ts          # Web worker with gtfs-sqljs + Comlink
├── hooks/
│   ├── useVoiceChat.ts         # Main orchestration hook
│   └── useGtfsWorker.ts        # Worker initialization and communication
├── stores/
│   ├── settingsStore.ts        # API key, GTFS URL (persisted to localStorage)
│   ├── chatStore.ts            # Conversation messages, loading state
│   └── debugStore.ts           # Debug logs
├── types/
│   └── index.ts                # TypeScript interfaces
├── main.tsx                    # Entry point
└── index.css                   # Tailwind imports
```

## Data Flow

### Voice Chat Flow

```
1. User clicks [Speak] button
          │
          ▼
2. Web Speech API (SpeechRecognition) starts
          │
          ▼
3. User speaks, transcript captured
          │
          ▼
4. Transcript added to conversation messages
          │
          ▼
5. Send all messages to Claude API with tool definitions
          │
          ▼
6. Claude responds with either:
   ├─► text response → go to step 9
   └─► tool_use block(s) → go to step 7
          │
          ▼
7. Execute tool(s) via worker (Comlink)
   • Log tool call to debugStore
   • Call gtfsApi method
   • Log tool response to debugStore
          │
          ▼
8. Send tool_result back to Claude → go to step 6
          │
          ▼
9. Final text response received
   • Add to conversation
   • Log to debugStore
          │
          ▼
10. Speak response via Web Speech API (SpeechSynthesis)
```

### GTFS Worker Initialization Flow

```
1. App mounts / GTFS URL changes
          │
          ▼
2. useGtfsWorker hook creates worker
          │
          ▼
3. Call gtfsApi.initialize(url, progressCallback)
          │
          ▼
4. Worker: GtfsSqlJs.fromZip(url, { onProgress })
   • Progress updates sent via Comlink proxy
   • UI shows progress bar
          │
          ▼
5. Worker stores GtfsSqlJs instance
          │
          ▼
6. Worker ready, tools available for execution
```

## Tool Definitions

Four tools are exposed to Claude:

### getStops
```typescript
{
  name: "getStops",
  description: "Search for transit stops/stations. Use to find stop IDs, names, and locations.",
  input_schema: {
    type: "object",
    properties: {
      stopId: { type: "string", description: "Exact stop ID" },
      stopCode: { type: "string", description: "Stop code (rider-facing)" },
      name: { type: "string", description: "Stop name (partial match)" },
      tripId: { type: "string", description: "Get stops for a specific trip" },
      limit: { type: "number", description: "Max results (default 10)" }
    }
  }
}
```

### getRoutes
```typescript
{
  name: "getRoutes",
  description: "Search for transit routes/lines. Use to find route IDs, names, and details.",
  input_schema: {
    type: "object",
    properties: {
      routeId: { type: "string", description: "Exact route ID" },
      agencyId: { type: "string", description: "Filter by agency" },
      limit: { type: "number", description: "Max results (default 10)" }
    }
  }
}
```

### getTrips
```typescript
{
  name: "getTrips",
  description: "Search for trips (scheduled journeys on a route). Use to find trip IDs and schedules.",
  input_schema: {
    type: "object",
    properties: {
      tripId: { type: "string", description: "Exact trip ID" },
      routeId: { type: "string", description: "Filter by route ID" },
      serviceIds: {
        oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
        description: "Filter by service ID(s)"
      },
      directionId: { type: "number", description: "Direction (0 or 1)" },
      date: { type: "string", description: "Filter by date (YYYY-MM-DD)" },
      limit: { type: "number", description: "Max results (default 10)" }
    }
  }
}
```

### getStopTimes
```typescript
{
  name: "getStopTimes",
  description: "Get scheduled arrival/departure times at stops. Use to find when buses/trains arrive.",
  input_schema: {
    type: "object",
    properties: {
      tripId: { type: "string", description: "Filter by trip ID" },
      stopId: { type: "string", description: "Filter by stop ID" },
      routeId: { type: "string", description: "Filter by route ID" },
      serviceIds: {
        oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
        description: "Filter by service ID(s)"
      },
      date: { type: "string", description: "Filter by date (YYYY-MM-DD)" },
      limit: { type: "number", description: "Max results (default 20)" }
    }
  }
}
```

## State Management (Zustand)

### settingsStore
```typescript
interface SettingsState {
  apiKey: string;
  gtfsUrl: string;
  setApiKey: (key: string) => void;
  setGtfsUrl: (url: string) => void;
}
// Persisted to localStorage
```

### chatStore
```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatState {
  messages: Message[];
  isProcessing: boolean;
  lastResponse: string;
  addMessage: (message: Message) => void;
  setProcessing: (processing: boolean) => void;
  setLastResponse: (response: string) => void;
  reset: () => void;
}
```

### debugStore
```typescript
interface DebugLog {
  id: string;
  timestamp: Date;
  type: 'user_input' | 'assistant_response' | 'tool_call' | 'tool_result' | 'error';
  data: unknown;
}

interface DebugState {
  logs: DebugLog[];
  addLog: (type: DebugLog['type'], data: unknown) => void;
  clearLogs: () => void;
}
```

## Configuration

### Default Settings
```typescript
const DEFAULT_GTFS_URL = 'https://pysae.com/api/v2/groups/car-jaune/gtfs/pub';
```

### Claude API Configuration
```typescript
{
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: `You are a helpful transit assistant. You help users find information about
           bus routes, stops, and schedules. Use the available tools to query the
           GTFS database. Be concise in your responses as they will be spoken aloud.`,
  headers: {
    'anthropic-dangerous-direct-browser-access': 'true'
  }
}
```

## Browser Compatibility

- **Chrome/Edge**: Full support (STT + TTS)
- **Firefox**: TTS only (no SpeechRecognition)
- **Safari**: TTS only (limited SpeechRecognition)

The app will show a warning if SpeechRecognition is not available.

## Deployment

GitHub Pages deployment via `gh-pages` package:

```json
{
  "scripts": {
    "build": "vite build",
    "deploy": "gh-pages -d dist"
  },
  "homepage": "https://sysdevrun.github.io/gtfs-sqljs-chatbot"
}
```

Vite config for GitHub Pages:
```typescript
export default defineConfig({
  base: '/gtfs-sqljs-chatbot/',
  // ...
})
```

## Security Considerations

1. **API Key Storage**: Claude API key stored in localStorage (user's responsibility)
2. **Direct Browser Access**: Using `anthropic-dangerous-direct-browser-access` header
3. **No Backend**: All processing happens client-side
4. **CORS**: Relies on GTFS feed servers having CORS enabled

## Future Enhancements (Not in Scope)

- GTFS-RT real-time data support
- Multiple GTFS feeds
- Map visualization
- Offline caching of GTFS data
- Alternative TTS providers
