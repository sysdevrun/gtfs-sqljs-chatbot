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

## LLM Tools Reference

Seven tools are exposed to Claude for querying GTFS data. This section documents each tool's purpose, input parameters, and output types.

### 1. getCurrentDateTime

**Purpose**: Provides current date/time info for GTFS queries. Should be called **first** before any schedule-dependent queries.

**Input**: None (empty object `{}`)

**Output**:
```typescript
{
  date: string;           // "YYYY-MM-DD"
  time: string;           // "HH:MM:SS"
  dateYYYYMMDD: string;   // "YYYYMMDD" (for GTFS filters)
  dayOfWeek: string;      // "monday", "tuesday", etc.
  isoDateTime: string;    // ISO 8601 format
  timezone: string;       // e.g., "Europe/Paris"
}
```

---

### 2. getRoutes

**Purpose**: Search for transit routes/lines.

**Input**:
```typescript
{
  routeId?: string | string[];    // Route ID(s) to look up
  agencyId?: string | string[];   // Filter by agency ID(s)
  limit?: number;                 // Max results (default: 10)
}
```

**Output**: `Route[]`
```typescript
{
  route_id: string;
  agency_id?: string;
  route_short_name?: string;   // Main identifier (e.g., "A1", "42")
  route_long_name?: string;
  route_type: number;          // 0=tram, 1=subway, 2=rail, 3=bus...
  route_color?: string;
  route_text_color?: string;
}
```

---

### 3. getStops

**Purpose**: Search for transit stops/stations.

**Input**:
```typescript
{
  stopId?: string | string[];   // Stop ID(s) to look up
  stopCode?: string;            // Rider-facing code
  name?: string;                // Partial name match
  tripId?: string;              // Get all stops for a trip
  limit?: number;               // Max results (default: 10)
}
```

**Output**: `Stop[]`
```typescript
{
  stop_id: string;
  stop_code?: string;
  stop_name?: string;
  stop_lat?: number;
  stop_lon?: number;
  parent_station?: string;     // Parent stop ID if this is a child
  location_type?: number;      // 0=stop, 1=station
}
```

---

### 4. searchStopsByWords

**Purpose**: Fuzzy search for stops by splitting query into words. Better for incomplete or partial names.

**Input**:
```typescript
{
  query: string;    // REQUIRED - search query (split into words)
  limit?: number;   // Max results (default: 20)
}
```

**Output**: `StopWithScore[]`
```typescript
{
  // All Stop fields, plus:
  matchScore: number;      // Number of words matched
  matchedWords: string[];  // Which words matched
}
```

---

### 5. getTrips

**Purpose**: Search for trips (scheduled journeys on a route).

**Input**:
```typescript
{
  tripId?: string | string[];       // Trip ID(s) to look up
  routeId?: string | string[];      // Filter by route ID(s)
  serviceIds?: string | string[];   // Filter by service ID(s)
  directionId?: number;             // Direction (0 or 1)
  date?: string;                    // YYYYMMDD - auto-resolves active services
  limit?: number;                   // Max results (default: 10)
}
```

**Output**: `Trip[]`
```typescript
{
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign?: string;    // Main identifier for users
  direction_id?: number;
  shape_id?: string;
}
```

---

### 6. getStopTimes

**Purpose**: Get scheduled arrival/departure times at stops.

**Input**:
```typescript
{
  tripId?: string | string[];       // Filter by trip ID(s)
  stopId?: string | string[];       // Filter by stop ID(s)
  routeId?: string | string[];      // Filter by route ID(s)
  serviceIds?: string | string[];   // Filter by service ID(s)
  date?: string;                    // YYYYMMDD - auto-resolves active services
  limit?: number;                   // Max results (default: 20)
}
```

**Output**: `StopTime[]`
```typescript
{
  trip_id: string;
  stop_id: string;
  arrival_time?: string;     // "HH:MM:SS"
  departure_time?: string;   // "HH:MM:SS"
  stop_sequence: number;
  stop_headsign?: string;
  pickup_type?: number;
  drop_off_type?: number;
}
```

---

### 7. findItinerary

**Purpose**: Find transit itineraries between two stops with transfers.

**Input**:
```typescript
{
  startStopId: string;      // REQUIRED - origin stop ID
  endStopId: string;        // REQUIRED - destination stop ID
  date: string;             // REQUIRED - YYYYMMDD
  departureTime: string;    // REQUIRED - "HH:MM:SS"
  maxTransfers?: number;    // Max transfers allowed (default: 3)
  journeysCount?: number;   // Number of options to return (default: 3)
}
```

**Output**:
```typescript
{
  journeys: ScheduledJourney[];  // Array of journey options
  paths: PathSegment[][];        // Underlying graph paths used
}

// Where ScheduledJourney contains:
{
  legs: JourneyLeg[];        // Each leg of the journey
  departureTime: number;     // Seconds since midnight
  arrivalTime: number;
  totalDuration: number;
  transfers: number;
}

// And JourneyLeg contains:
{
  fromStopId: string;
  toStopId: string;
  routeId?: string;
  tripId?: string;
  departureTime: number;
  arrivalTime: number;
  isTransfer: boolean;
}
```

---

## Tool Call Architecture

### Itinerary Planning Flow

When a user asks for an itinerary between two stop names, the LLM must orchestrate **multiple tool calls** in sequence:

```
User: "How do I get from Gare Centrale to Place Liberté?"

┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Get current date/time                                   │
│                                                                 │
│   Call: getCurrentDateTime({})                                  │
│   Returns: { dateYYYYMMDD: "20251203", time: "14:30:00", ... }  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Find origin stop ID (parallel with Step 3)              │
│                                                                 │
│   Call: searchStopsByWords({ query: "Gare Centrale" })          │
│   Returns: [{ stop_id: "STOP_001", stop_name: "Gare Centrale",  │
│               matchScore: 2 }, ...]                             │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Find destination stop ID (parallel with Step 2)         │
│                                                                 │
│   Call: searchStopsByWords({ query: "Place Liberté" })          │
│   Returns: [{ stop_id: "STOP_042", stop_name: "Place Liberté",  │
│               matchScore: 2 }, ...]                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Find itinerary using stop IDs                           │
│                                                                 │
│   Call: findItinerary({                                         │
│     startStopId: "STOP_001",                                    │
│     endStopId: "STOP_042",                                      │
│     date: "20251203",                                           │
│     departureTime: "14:30:00",                                  │
│     journeysCount: 3                                            │
│   })                                                            │
│   Returns: { journeys: [...], paths: [...] }                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 5 (optional): Get route details for user-friendly names    │
│                                                                 │
│   Call: getRoutes({ routeId: ["ROUTE_A", "ROUTE_B"] })          │
│   Returns: [{ route_short_name: "A1", ... }, ...]               │
└─────────────────────────────────────────────────────────────────┘
```

### Call Order Summary

| Step | Tool | Purpose | Dependencies |
|------|------|---------|--------------|
| 1 | `getCurrentDateTime` | Get date/time for filters | None (always first) |
| 2 | `searchStopsByWords` | Resolve origin name → ID | None |
| 3 | `searchStopsByWords` | Resolve destination name → ID | None (parallel with 2) |
| 4 | `findItinerary` | Compute journey options | Steps 1, 2, 3 |
| 5 | `getRoutes` | Get human-readable route names | Step 4 (optional) |

### Other Common Query Patterns

**Finding next departures at a stop:**
1. `getCurrentDateTime()` → get current date/time
2. `searchStopsByWords({ query: "stop name" })` → find stop ID
3. `getStopTimes({ stopId: "...", date: "YYYYMMDD" })` → get schedules

**Finding routes serving a stop:**
1. `searchStopsByWords({ query: "stop name" })` → find stop ID
2. `getStopTimes({ stopId: "...", limit: 50 })` → get stop times with route IDs
3. `getRoutes({ routeId: [...unique route IDs] })` → get route details

**Getting full trip schedule:**
1. `getTrips({ routeId: "...", date: "YYYYMMDD" })` → find trip IDs
2. `getStopTimes({ tripId: "..." })` → get all stops for that trip

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
