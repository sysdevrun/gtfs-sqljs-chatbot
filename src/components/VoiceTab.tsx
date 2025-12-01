import { useChatStore } from '../stores/chatStore';
import { useVoiceChat, type VoiceChatState, type WaitingFor } from '../hooks/useVoiceChat';
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
      return 'Ready to listen. Press the speak button to start.';
    case 'listening':
      return 'Listening for your voice. Speak now.';
    case 'processing':
      return 'Processing your request. Please wait.';
    case 'speaking':
      return 'Speaking response. Press button to stop.';
    case 'error':
      return 'An error occurred. Press button to try again.';
  }
}

function getWaitingForLabel(waitingFor: WaitingFor): string {
  switch (waitingFor) {
    case 'idle':
      return '';
    case 'listening':
      return 'En attente de votre voix...';
    case 'claude':
      return 'En attente de Claude...';
    case 'tool':
      return 'Execution outil...';
    case 'speaking':
      return 'Lecture de la reponse...';
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

function getButtonAriaLabel(state: VoiceChatState, isDisabled: boolean): string {
  if (isDisabled) {
    return 'Speak button disabled. Waiting for transit data to load.';
  }
  switch (state) {
    case 'idle':
      return 'Press to start voice input. Ask a question about transit schedules.';
    case 'listening':
      return 'Currently listening for your voice.';
    case 'processing':
      return 'Processing your request.';
    case 'speaking':
      return 'Press to stop the spoken response.';
    case 'error':
      return 'Press to try again after error.';
  }
}

export function VoiceTab({
  gtfsApi,
  gtfsLoadingState,
  gtfsProgress,
  gtfsError,
}: VoiceTabProps) {
  const { lastResponse, isProcessing } = useChatStore();
  const { state, errorMessage, toolStatus, startVoiceChat, stopChat, resetConversation } =
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
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] p-4 space-y-6"
      role="region"
      aria-label="Voice chat interface"
    >
      {/* GTFS Loading State */}
      {gtfsLoadingState === 'loading' && gtfsProgress && (
        <div
          className="w-full max-w-md"
          role="status"
          aria-live="polite"
          aria-label={`Loading transit data: ${Math.round(gtfsProgress.percentComplete)} percent complete. ${gtfsProgress.message}`}
        >
          <div className="text-sm text-gray-600 mb-2 text-center">
            {gtfsProgress.message}
          </div>
          <div
            className="w-full bg-gray-200 rounded-full h-2.5"
            role="progressbar"
            aria-valuenow={Math.round(gtfsProgress.percentComplete)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Transit data loading progress"
          >
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${gtfsProgress.percentComplete}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1 text-center" aria-hidden="true">
            {Math.round(gtfsProgress.percentComplete)}%
          </div>
        </div>
      )}

      {gtfsLoadingState === 'error' && (
        <div
          className="text-red-600 text-center max-w-md"
          role="alert"
          aria-live="assertive"
        >
          <p className="font-medium">Failed to load GTFS data</p>
          <p className="text-sm mt-1">{gtfsError}</p>
        </div>
      )}

      {!isSpeechSupported && (
        <div
          className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md"
          role="alert"
          aria-live="polite"
        >
          <p className="text-yellow-800 text-sm">
            Speech recognition is not supported in this browser. Please use
            Chrome or Edge for voice input.
          </p>
        </div>
      )}

      {/* Screen reader status announcement */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {getStateLabel(state)}
      </div>

      {/* Main Speak Button */}
      <button
        onClick={handleMainButton}
        disabled={isButtonDisabled}
        aria-label={getButtonAriaLabel(state, isButtonDisabled)}
        aria-pressed={state === 'listening'}
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

      {/* Visual State Indicator (hidden from screen readers, redundant) */}
      <div className="text-gray-600 text-sm" aria-hidden="true">
        {state === 'idle' ? 'Ready' :
         state === 'listening' ? 'Listening...' :
         state === 'processing' ? 'Processing...' :
         state === 'speaking' ? 'Speaking...' : 'Error'}
      </div>

      {/* Tool Status Indicator */}
      {(toolStatus.waitingFor !== 'idle' || toolStatus.lastToolUsed || toolStatus.intermediateText) && (
        <div
          className="bg-gray-100 border border-gray-200 rounded-lg p-3 max-w-md w-full"
          role="status"
          aria-live="polite"
        >
          {/* Intermediate text from Claude */}
          {toolStatus.intermediateText && (
            <div className="text-sm text-gray-700 mb-2 italic">
              {toolStatus.intermediateText}
            </div>
          )}
          {toolStatus.waitingFor !== 'idle' && (
            <div className="flex items-center justify-center space-x-2 text-gray-700">
              <div
                className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"
                aria-hidden="true"
              />
              <span className="text-sm font-medium">
                {getWaitingForLabel(toolStatus.waitingFor)}
              </span>
            </div>
          )}
          {toolStatus.lastToolUsed && (
            <div className="mt-2 text-xs text-gray-500 text-center">
              <span className="font-medium">Dernier outil:</span>{' '}
              <span className="font-mono bg-gray-200 px-1 rounded">
                {toolStatus.lastToolUsed}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-3 max-w-md"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-red-700 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Last Response */}
      {lastResponse && (
        <div
          className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-lg w-full"
          role="region"
          aria-label="Assistant response"
          aria-live="polite"
        >
          <h3 className="sr-only">Latest response from assistant:</h3>
          <p className="text-gray-800 whitespace-pre-wrap">{lastResponse}</p>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div
          className="flex items-center space-x-2 text-gray-600"
          role="status"
          aria-live="polite"
        >
          <div
            className="animate-spin rounded-full h-4 w-4 border-2 border-gray-600 border-t-transparent"
            aria-hidden="true"
          />
          <span className="text-sm">Processing your request...</span>
        </div>
      )}

      {/* Reset Button */}
      <button
        onClick={resetConversation}
        className="text-sm text-gray-500 hover:text-gray-700 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
        aria-label="Reset conversation and clear all messages"
      >
        Reset Conversation
      </button>
    </div>
  );
}
