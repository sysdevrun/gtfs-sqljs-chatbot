# GTFS Voice Chatbot

A browser-based voice chatbot that lets you query transit schedules using natural language. Ask questions about bus routes, stops, and schedules - the app listens to your voice, processes your query with Claude AI, and speaks the answer back to you.

**[Try it live](https://sysdevrun.github.io/gtfs-sqljs-chatbot)**

## Features

- **Voice Input**: Speak your transit questions naturally using Web Speech API
- **Voice Output**: Responses are spoken aloud for hands-free use
- **AI-Powered**: Uses Claude AI to understand natural language queries
- **Local Processing**: GTFS data is loaded and queried entirely in your browser
- **Accessible**: Full screen reader support with ARIA labels, live regions, and keyboard navigation
- **Configurable**: Change the GTFS feed URL to use any transit agency's data
- **Debug Panel**: View conversation history, tool calls, and API responses

## Quick Start

1. Visit the [live demo](https://sysdevrun.github.io/gtfs-sqljs-chatbot)
2. Go to **Settings** and enter your [Claude API key](https://console.anthropic.com/)
3. Wait for the transit data to load (progress bar shows status)
4. Click the **Speak** button and ask a question like:
   - "What bus routes are available?"
   - "Find stops near the airport"
   - "When does route 1 arrive at the main station?"

## Browser Compatibility

| Browser | Voice Input | Voice Output |
|---------|-------------|--------------|
| Chrome  | Yes | Yes |
| Edge    | Yes | Yes |
| Firefox | No  | Yes |
| Safari  | Limited | Yes |

For the best experience, use **Chrome** or **Edge**.

## Accessibility

This app is designed to be fully accessible to blind and visually impaired users:

- **Screen Reader Support**: All interactive elements have descriptive ARIA labels
- **Live Announcements**: Status changes and responses are announced via `aria-live` regions
- **Keyboard Navigation**: Full keyboard support with visible focus indicators
- **Skip Links**: Skip to main content link for quick navigation
- **Semantic HTML**: Proper heading hierarchy and landmark roles

### Keyboard Shortcuts

- **Tab**: Navigate between controls
- **Enter/Space**: Activate buttons
- **Arrow Keys**: Navigate within tab lists

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/sysdevrun/gtfs-sqljs-chatbot.git
cd gtfs-sqljs-chatbot

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build

```bash
npm run build
```

### Deploy to GitHub Pages

```bash
npm run deploy
```

## Configuration

### Claude API Key

Your API key is stored in your browser's localStorage and is only sent to Anthropic's API. Get your API key at [console.anthropic.com](https://console.anthropic.com/).

### GTFS Feed URL

The default feed is [Car Jaune](https://transport.data.gouv.fr/datasets/horaires-theoriques-au-format-gtfs-et-horaires-temps-reel-au-format-gtfs-rt-du-reseau-car-jaune-a-la-reunion/) (La Réunion, France). You can change this in Settings to any GTFS feed URL that:

- Returns a valid GTFS ZIP file
- Has CORS enabled (allows browser requests)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Main Thread)                    │
├─────────────────────────────────────────────────────────────┤
│  React App                                                   │
│  ├── VoiceTab (speak button, responses)                     │
│  ├── SettingsTab (API key, GTFS URL)                        │
│  └── DebugTab (conversation logs)                           │
├─────────────────────────────────────────────────────────────┤
│  Services                                                    │
│  ├── Web Speech API (STT/TTS)                               │
│  ├── Claude API (with GTFS tools)                           │
│  └── Tool Executor (routes to worker)                       │
├─────────────────────────────────────────────────────────────┤
│                     Web Worker (Comlink)                     │
│  └── gtfs-sqljs (SQLite in-memory database)                 │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: TailwindCSS v3
- **State**: Zustand
- **GTFS**: [gtfs-sqljs](https://github.com/sysdevrun/gtfs-sqljs) (in Web Worker via Comlink)
- **AI**: Claude API (claude-sonnet-4-20250514)
- **Speech**: Web Speech API
- **Deployment**: GitHub Pages

## Available GTFS Tools

The AI has access to four tools for querying transit data:

| Tool | Description |
|------|-------------|
| `getStops` | Search for stops by ID, code, name, or trip |
| `getRoutes` | Search for routes by ID or agency |
| `getTrips` | Search for trips by route, service, or date |
| `getStopTimes` | Get arrival/departure times at stops |

## License

MIT

## Links

- [Live Demo](https://sysdevrun.github.io/gtfs-sqljs-chatbot)
- [gtfs-sqljs](https://github.com/sysdevrun/gtfs-sqljs) - GTFS SQLite library
- [Claude API](https://www.anthropic.com/api) - AI provider
- [Car Jaune GTFS](https://transport.data.gouv.fr/datasets/horaires-theoriques-au-format-gtfs-et-horaires-temps-reel-au-format-gtfs-rt-du-reseau-car-jaune-a-la-reunion/) - Default transit data
