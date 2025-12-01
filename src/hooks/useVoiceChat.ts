import { useState, useCallback } from 'react';
import * as Comlink from 'comlink';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import type { GtfsWorkerApi } from '../workers/gtfs.worker';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useDebugStore } from '../stores/debugStore';
import {
  startSpeechRecognition,
  speak,
  stopSpeaking,
  isSpeechRecognitionSupported,
} from '../services/speech';
import {
  sendMessage,
  extractTextFromContent,
  extractToolUseFromContent,
} from '../services/claude';
import { executeTool } from '../services/toolExecutor';

export type VoiceChatState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export type WaitingFor = 'idle' | 'listening' | 'claude' | 'tool' | 'speaking';

export interface ToolStatus {
  lastToolUsed: string | null;
  lastToolInput: Record<string, unknown> | null;
  waitingFor: WaitingFor;
  intermediateText: string | null;
}

export interface TokenStats {
  totalInputTokens: number;
  totalOutputTokens: number;
}

export function useVoiceChat(gtfsApi: Comlink.Remote<GtfsWorkerApi> | null) {
  const [state, setState] = useState<VoiceChatState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toolStatus, setToolStatus] = useState<ToolStatus>({
    lastToolUsed: null,
    lastToolInput: null,
    waitingFor: 'idle',
    intermediateText: null,
  });
  const [tokenStats, setTokenStats] = useState<TokenStats>({
    totalInputTokens: 0,
    totalOutputTokens: 0,
  });

  const apiKey = useSettingsStore((s) => s.apiKey);
  const language = useSettingsStore((s) => s.language);
  const systemPrompt = useSettingsStore((s) => s.systemPrompt);
  const { messages, addMessage, setProcessing, setLastResponse, reset } =
    useChatStore();
  const addLog = useDebugStore((s) => s.addLog);
  const clearLogs = useDebugStore((s) => s.clearLogs);

  const processWithClaude = useCallback(
    async (conversationMessages: MessageParam[]): Promise<string> => {
      let currentMessages = [...conversationMessages];
      let finalResponse = '';
      let iterations = 0;
      const maxIterations = 10; // Prevent infinite loops

      while (iterations < maxIterations) {
        iterations++;

        setToolStatus(prev => ({ ...prev, waitingFor: 'claude' }));

        addLog('system', {
          message: `Sending to Claude (iteration ${iterations})`,
          messageCount: currentMessages.length,
        });

        const response = await sendMessage(apiKey, currentMessages, systemPrompt);

        // Accumulate token usage
        setTokenStats(prev => ({
          totalInputTokens: prev.totalInputTokens + response.usage.inputTokens,
          totalOutputTokens: prev.totalOutputTokens + response.usage.outputTokens,
        }));

        addLog('assistant_response', {
          content: response.content,
          stopReason: response.stopReason,
          usage: response.usage,
        });

        // Check for tool use
        const toolUses = extractToolUseFromContent(response.content);

        if (toolUses.length === 0) {
          // No tool use, extract final text response
          finalResponse = extractTextFromContent(response.content);

          // Add assistant message to conversation
          addMessage({
            role: 'assistant',
            content: response.content,
          });

          break;
        }

        // Extract any intermediate text explanation from Claude
        const intermediateText = extractTextFromContent(response.content);

        // Add assistant message with tool use to conversation
        addMessage({
          role: 'assistant',
          content: response.content,
        });
        currentMessages.push({
          role: 'assistant',
          content: response.content,
        });

        // Execute each tool and collect results
        const toolResults: MessageParam = {
          role: 'user',
          content: [],
        };

        for (const toolUse of toolUses) {
          setToolStatus({
            lastToolUsed: toolUse.name,
            lastToolInput: toolUse.input as Record<string, unknown>,
            waitingFor: 'tool',
            intermediateText: intermediateText || null,
          });

          addLog('tool_call', {
            id: toolUse.id,
            name: toolUse.name,
            input: toolUse.input,
          });

          const result = await executeTool(
            gtfsApi as unknown as GtfsWorkerApi | null,
            toolUse.name,
            toolUse.input as Record<string, unknown>
          );

          addLog('tool_result', {
            id: toolUse.id,
            name: toolUse.name,
            result: JSON.parse(result),
          });

          (toolResults.content as Array<{ type: 'tool_result'; tool_use_id: string; content: string }>).push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result,
          });
        }

        // Add tool results to conversation
        addMessage(toolResults);
        currentMessages.push(toolResults);
      }

      if (iterations >= maxIterations) {
        throw new Error('Too many tool call iterations');
      }

      return finalResponse;
    },
    [apiKey, systemPrompt, gtfsApi, addLog, addMessage]
  );

  const startVoiceChat = useCallback(async () => {
    if (!isSpeechRecognitionSupported()) {
      setErrorMessage('Speech recognition not supported in this browser');
      setState('error');
      return;
    }

    if (!apiKey) {
      setErrorMessage('Please set your Claude API key in Settings');
      setState('error');
      return;
    }

    if (!gtfsApi) {
      setErrorMessage('GTFS data is not loaded yet');
      setState('error');
      return;
    }

    setErrorMessage(null);
    setState('listening');
    setToolStatus({ lastToolUsed: null, lastToolInput: null, waitingFor: 'listening', intermediateText: null });
    stopSpeaking();

    try {
      // 1. Listen for speech
      const transcript = await startSpeechRecognition(language);
      addLog('user_input', { transcript });

      // 2. Add user message to conversation
      const userMessage: MessageParam = {
        role: 'user',
        content: transcript,
      };
      addMessage(userMessage);

      // 3. Process with Claude
      setState('processing');
      setProcessing(true);
      setToolStatus(prev => ({ ...prev, waitingFor: 'claude' }));

      const allMessages = [...messages, userMessage];
      const response = await processWithClaude(allMessages);

      setLastResponse(response);
      setProcessing(false);

      // 4. Speak the response
      if (response) {
        setState('speaking');
        setToolStatus(prev => ({ ...prev, waitingFor: 'speaking' }));
        await speak(response, language);
      }

      setState('idle');
      setToolStatus(prev => ({ ...prev, waitingFor: 'idle' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setState('error');
      setProcessing(false);
      setToolStatus(prev => ({ ...prev, waitingFor: 'idle' }));
      addLog('error', { message });

      // Auto-recover to idle after showing error
      setTimeout(() => {
        if (state === 'error') {
          setState('idle');
        }
      }, 3000);
    }
  }, [
    apiKey,
    language,
    gtfsApi,
    messages,
    addMessage,
    addLog,
    setProcessing,
    setLastResponse,
    processWithClaude,
    state,
  ]);

  const processTextInput = useCallback(async (text: string) => {
    if (!apiKey) {
      setErrorMessage('Please set your Claude API key in Settings');
      setState('error');
      return;
    }

    if (!gtfsApi) {
      setErrorMessage('GTFS data is not loaded yet');
      setState('error');
      return;
    }

    if (!text.trim()) {
      return;
    }

    setErrorMessage(null);
    setState('processing');
    setToolStatus({ lastToolUsed: null, lastToolInput: null, waitingFor: 'claude', intermediateText: null });
    stopSpeaking();

    try {
      addLog('user_input', { transcript: text, source: 'text' });

      const userMessage: MessageParam = {
        role: 'user',
        content: text,
      };
      addMessage(userMessage);

      setProcessing(true);

      const allMessages = [...messages, userMessage];
      const response = await processWithClaude(allMessages);

      setLastResponse(response);
      setProcessing(false);

      if (response) {
        setState('speaking');
        setToolStatus(prev => ({ ...prev, waitingFor: 'speaking' }));
        await speak(response, language);
      }

      setState('idle');
      setToolStatus(prev => ({ ...prev, waitingFor: 'idle' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setState('error');
      setProcessing(false);
      setToolStatus(prev => ({ ...prev, waitingFor: 'idle' }));
      addLog('error', { message });

      setTimeout(() => {
        if (state === 'error') {
          setState('idle');
        }
      }, 3000);
    }
  }, [
    apiKey,
    language,
    gtfsApi,
    messages,
    addMessage,
    addLog,
    setProcessing,
    setLastResponse,
    processWithClaude,
    state,
  ]);

  const speakLastResponse = useCallback(async () => {
    const { lastResponse } = useChatStore.getState();
    if (!lastResponse) return;

    stopSpeaking();
    setState('speaking');
    setToolStatus(prev => ({ ...prev, waitingFor: 'speaking' }));

    try {
      await speak(lastResponse, language);
    } finally {
      setState('idle');
      setToolStatus(prev => ({ ...prev, waitingFor: 'idle' }));
    }
  }, [language]);

  const stopChat = useCallback(() => {
    stopSpeaking();
    setState('idle');
    setProcessing(false);
    setToolStatus(prev => ({ ...prev, waitingFor: 'idle' }));
  }, [setProcessing]);

  const resetConversation = useCallback(() => {
    reset();
    clearLogs();
    setLastResponse('');
    setState('idle');
    setErrorMessage(null);
    setToolStatus({ lastToolUsed: null, lastToolInput: null, waitingFor: 'idle', intermediateText: null });
    setTokenStats({ totalInputTokens: 0, totalOutputTokens: 0 });
    addLog('system', { message: 'Conversation reset' });
  }, [reset, clearLogs, setLastResponse, addLog]);

  return {
    state,
    errorMessage,
    toolStatus,
    tokenStats,
    startVoiceChat,
    processTextInput,
    speakLastResponse,
    stopChat,
    resetConversation,
  };
}
