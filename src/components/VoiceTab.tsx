import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore, MODEL_PRICING } from '../stores/settingsStore';
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

function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

function formatPrice(priceUsd: number): string {
  if (priceUsd < 0.01) {
    return `$${(priceUsd * 100).toFixed(2)}c`;
  }
  return `$${priceUsd.toFixed(2)}`;
}

// Rolling text animation component
function RollingText({ text, className }: { text: string; className?: string }) {
  const [displayText, setDisplayText] = useState(text);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (text !== displayText) {
      setKey(prev => prev + 1);
      setDisplayText(text);
    }
  }, [text, displayText]);

  return (
    <div className={`overflow-hidden ${className || ''}`}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={key}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {displayText}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function VoiceTab({
  gtfsApi,
  gtfsLoadingState,
  gtfsProgress,
  gtfsError,
}: VoiceTabProps) {
  const { lastResponse } = useChatStore();
  const model = useSettingsStore((s) => s.model);
  const {
    state,
    errorMessage,
    toolStatus,
    tokenStats,
    startVoiceChat,
    processTextInput,
    speakLastResponse,
    stopChat,
    resetConversation
  } = useVoiceChat(gtfsApi);

  const [textInput, setTextInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isGtfsReady = gtfsLoadingState === 'ready';
  const isSpeechSupported = isSpeechRecognitionSupported();
  const isProcessing = state === 'processing' || state === 'listening';

  const handleMainButton = () => {
    if (state === 'speaking') {
      stopChat();
    } else if (state === 'idle' || state === 'error') {
      startVoiceChat();
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && isGtfsReady && state === 'idle') {
      processTextInput(textInput);
      setTextInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit(e);
    }
  };

  const isButtonDisabled =
    !isGtfsReady ||
    !isSpeechSupported ||
    state === 'listening' ||
    state === 'processing';

  const isTextInputDisabled = !isGtfsReady || state !== 'idle';

  // Build current status text
  const getStatusText = (): string => {
    if (toolStatus.lastToolUsed && toolStatus.waitingFor === 'tool') {
      return `${toolStatus.lastToolUsed}...`;
    }
    if (toolStatus.waitingFor !== 'idle') {
      return getWaitingForLabel(toolStatus.waitingFor);
    }
    return '';
  };

  const statusText = getStatusText();

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
            Chrome or Edge for voice input, or use the text input below.
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

      {/* Main Speak Button with Pulse Animation */}
      <div className="relative">
        {/* Pulsing circle behind (only when processing) */}
        {isProcessing && (
          <motion.div
            className="absolute inset-0 rounded-full bg-blue-400"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 0, 0.5]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        )}

        {/* Main button */}
        <button
          onClick={handleMainButton}
          disabled={isButtonDisabled}
          aria-label={getButtonAriaLabel(state, isButtonDisabled)}
          aria-pressed={state === 'listening'}
          className={`
            relative z-10 w-32 h-32 rounded-full text-white font-medium text-lg
            transition-all duration-200 transform
            ${isButtonDisabled ? 'bg-gray-400 cursor-not-allowed' : ''}
            ${state === 'idle' ? 'bg-blue-600 hover:bg-blue-700 hover:scale-105' : ''}
            ${state === 'listening' ? 'bg-red-500' : ''}
            ${state === 'processing' ? 'bg-yellow-500' : ''}
            ${state === 'speaking' ? 'bg-green-600 hover:bg-green-700' : ''}
            ${state === 'error' ? 'bg-red-600 hover:bg-red-700' : ''}
            focus:outline-none focus:ring-4 focus:ring-blue-300
          `}
        >
          {getButtonLabel(state)}
        </button>
      </div>

      {/* Status Text with Rolling Animation */}
      <div className="h-6 flex items-center justify-center">
        {statusText && (
          <RollingText
            text={statusText}
            className="text-gray-600 text-sm font-medium"
          />
        )}
      </div>

      {/* Intermediate text from Claude */}
      <AnimatePresence>
        {toolStatus.intermediateText && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm text-gray-600 italic text-center max-w-md"
          >
            {toolStatus.intermediateText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tool Status Badge */}
      <AnimatePresence>
        {toolStatus.lastToolUsed && toolStatus.waitingFor !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-xs text-gray-500"
          >
            <span className="font-mono bg-gray-100 px-2 py-1 rounded">
              {toolStatus.lastToolUsed}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Text Input Form */}
      <form onSubmit={handleTextSubmit} className="w-full max-w-md">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTextInputDisabled}
            placeholder={isGtfsReady ? "Tapez votre question..." : "Chargement des donnees..."}
            className={`
              flex-1 px-4 py-2 border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              ${isTextInputDisabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            `}
            aria-label="Text input for questions"
          />
          <button
            type="submit"
            disabled={isTextInputDisabled || !textInput.trim()}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${isTextInputDisabled || !textInput.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
            aria-label="Send message"
          >
            Envoyer
          </button>
        </div>
      </form>

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
          <div className="flex justify-between items-start mb-2">
            <h3 className="sr-only">Latest response from assistant:</h3>
            <button
              onClick={speakLastResponse}
              disabled={state !== 'idle'}
              className={`
                text-xs px-2 py-1 rounded transition-colors
                ${state !== 'idle'
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-blue-600 hover:bg-blue-50'
                }
              `}
              aria-label="Read response again"
            >
              🔊 Relire
            </button>
          </div>
          <p className="text-gray-800 whitespace-pre-wrap">{lastResponse}</p>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="flex items-center gap-4">
        {/* Reset Button */}
        <button
          onClick={resetConversation}
          className="text-sm text-gray-500 hover:text-gray-700 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          aria-label="Reset conversation and clear all messages"
        >
          Reset Conversation
        </button>

        {/* Token Usage (discreet) */}
        {(tokenStats.totalInputTokens > 0 || tokenStats.totalOutputTokens > 0) && (() => {
          const pricing = MODEL_PRICING[model];
          const inputCost = (tokenStats.totalInputTokens / 1_000_000) * pricing.input;
          const outputCost = (tokenStats.totalOutputTokens / 1_000_000) * pricing.output;
          const totalCost = inputCost + outputCost;
          return (
            <div
              className="text-xs text-gray-400"
              title={`Input: ${tokenStats.totalInputTokens} tokens ($${inputCost.toFixed(4)}), Output: ${tokenStats.totalOutputTokens} tokens ($${outputCost.toFixed(4)})`}
            >
              <span className="opacity-60">
                ↑{formatTokenCount(tokenStats.totalInputTokens)} ↓{formatTokenCount(tokenStats.totalOutputTokens)} {formatPrice(totalCost)}
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
