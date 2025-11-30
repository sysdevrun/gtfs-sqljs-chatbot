import { useChatStore } from '../stores/chatStore';
import { useVoiceChat, type VoiceChatState } from '../hooks/useVoiceChat';
import { isSpeechRecognitionSupported } from '../services/speech';
import type { GtfsLoadingState, ProgressInfo } from '../types';
import type { GtfsWorkerApi } from '../workers/gtfs.worker';
import type { Remote } from 'comlink';

interface VoiceTabProps {
  gtfsApi: Remote<GtfsWorkerApi> | null;
  gtfsLoadingState: GtfsLoadingState;
  gtfsProgress: ProgressInfo | null;
  gtfsError: string | null;
}

function getStateLabel(state: VoiceChatState): string {
  switch (state) {
    case 'idle':
      return 'Ready';
    case 'listening':
      return 'Listening...';
    case 'processing':
      return 'Processing...';
    case 'speaking':
      return 'Speaking...';
    case 'error':
      return 'Error';
  }
}

function getButtonLabel(state: VoiceChatState): string {
  switch (state) {
    case 'idle':
      return 'Speak';
    case 'listening':
      return 'Listening...';
    case 'processing':
      return 'Processing...';
    case 'speaking':
      return 'Stop';
    case 'error':
      return 'Try Again';
  }
}

export function VoiceTab({
  gtfsApi,
  gtfsLoadingState,
  gtfsProgress,
  gtfsError,
}: VoiceTabProps) {
  const { lastResponse, isProcessing } = useChatStore();
  const { state, errorMessage, startVoiceChat, stopChat, resetConversation } =
    useVoiceChat(gtfsApi);

  const isGtfsReady = gtfsLoadingState === 'ready';
  const isSpeechSupported = isSpeechRecognitionSupported();

  const handleMainButton = () => {
    if (state === 'speaking') {
      stopChat();
    } else if (state === 'idle' || state === 'error') {
      startVoiceChat();
    }
  };

  const isButtonDisabled =
    !isGtfsReady ||
    !isSpeechSupported ||
    state === 'listening' ||
    state === 'processing';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 space-y-6">
      {/* GTFS Loading State */}
      {gtfsLoadingState === 'loading' && gtfsProgress && (
        <div className="w-full max-w-md">
          <div className="text-sm text-gray-600 mb-2 text-center">
            {gtfsProgress.message}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${gtfsProgress.percentComplete}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1 text-center">
            {Math.round(gtfsProgress.percentComplete)}%
          </div>
        </div>
      )}

      {gtfsLoadingState === 'error' && (
        <div className="text-red-600 text-center max-w-md">
          <p className="font-medium">Failed to load GTFS data</p>
          <p className="text-sm mt-1">{gtfsError}</p>
        </div>
      )}

      {!isSpeechSupported && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md">
          <p className="text-yellow-800 text-sm">
            Speech recognition is not supported in this browser. Please use
            Chrome or Edge.
          </p>
        </div>
      )}

      {/* Main Speak Button */}
      <button
        onClick={handleMainButton}
        disabled={isButtonDisabled}
        className={`
          w-32 h-32 rounded-full text-white font-medium text-lg
          transition-all duration-200 transform
          ${isButtonDisabled ? 'bg-gray-400 cursor-not-allowed' : ''}
          ${state === 'idle' ? 'bg-blue-600 hover:bg-blue-700 hover:scale-105' : ''}
          ${state === 'listening' ? 'bg-red-500 animate-pulse' : ''}
          ${state === 'processing' ? 'bg-yellow-500' : ''}
          ${state === 'speaking' ? 'bg-green-600 hover:bg-green-700' : ''}
          ${state === 'error' ? 'bg-red-600 hover:bg-red-700' : ''}
          focus:outline-none focus:ring-4 focus:ring-blue-300
        `}
      >
        {getButtonLabel(state)}
      </button>

      {/* State Indicator */}
      <div className="text-gray-600 text-sm">{getStateLabel(state)}</div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-w-md">
          <p className="text-red-700 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Last Response */}
      {lastResponse && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-lg w-full">
          <p className="text-gray-800 whitespace-pre-wrap">{lastResponse}</p>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="flex items-center space-x-2 text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-600 border-t-transparent" />
          <span className="text-sm">Processing...</span>
        </div>
      )}

      {/* Reset Button */}
      <button
        onClick={resetConversation}
        className="text-sm text-gray-500 hover:text-gray-700 underline"
      >
        Reset Conversation
      </button>
    </div>
  );
}
