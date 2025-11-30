import { useDebugStore } from '../stores/debugStore';
import { useChatStore } from '../stores/chatStore';
import type { DebugLog } from '../types';

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getLogTypeColor(type: DebugLog['type']): string {
  switch (type) {
    case 'user_input':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'assistant_response':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'tool_call':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'tool_result':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'error':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'system':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getLogTypeLabel(type: DebugLog['type']): string {
  switch (type) {
    case 'user_input':
      return 'User Input';
    case 'assistant_response':
      return 'Assistant';
    case 'tool_call':
      return 'Tool Call';
    case 'tool_result':
      return 'Tool Result';
    case 'error':
      return 'Error';
    case 'system':
      return 'System';
    default:
      return type;
  }
}

function LogEntry({ log }: { log: DebugLog }) {
  const colorClass = getLogTypeColor(log.type);

  return (
    <div className={`border rounded-lg p-3 ${colorClass}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase">
          {getLogTypeLabel(log.type)}
        </span>
        <span className="text-xs opacity-70">
          {formatTimestamp(log.timestamp)}
        </span>
      </div>
      <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono">
        {JSON.stringify(log.data, null, 2)}
      </pre>
    </div>
  );
}

export function DebugTab() {
  const { logs, clearLogs } = useDebugStore();
  const { messages } = useChatStore();

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Debug Log</h2>
        <button
          onClick={clearLogs}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
        >
          Clear Logs
        </button>
      </div>

      {/* Conversation Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Conversation State
        </h3>
        <p className="text-xs text-gray-600">
          Messages in context: {messages.length}
        </p>
      </div>

      {/* Logs */}
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            No logs yet. Start a conversation to see debug information.
          </p>
        ) : (
          logs.map((log) => <LogEntry key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
}
