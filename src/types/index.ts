import type { MessageParam, ContentBlock } from '@anthropic-ai/sdk/resources/messages';

// Re-export Anthropic types
export type { MessageParam, ContentBlock };

// Re-export GTFS types from gtfs-sqljs
export type {
  Stop,
  Route,
  Trip,
  StopTime,
  StopFilters,
  RouteFilters,
  TripFilters,
  StopTimeFilters,
} from 'gtfs-sqljs';

// Progress Info type (defined locally as gtfs-sqljs doesn't export it)
export interface ProgressInfo {
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

// Debug Log Types
export type DebugLogType =
  | 'user_input'
  | 'assistant_response'
  | 'tool_call'
  | 'tool_result'
  | 'error'
  | 'system';

export interface DebugLog {
  id: string;
  timestamp: Date;
  type: DebugLogType;
  data: unknown;
}

// Tool Call Types
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

// App State Types
export type AppTab = 'voice' | 'settings' | 'debug';

export type GtfsLoadingState = 'idle' | 'loading' | 'ready' | 'error';

// Speech Recognition types (Web Speech API)
export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}
