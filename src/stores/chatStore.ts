import { create } from 'zustand';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';

interface ChatState {
  messages: MessageParam[];
  isProcessing: boolean;
  lastResponse: string;
  addMessage: (message: MessageParam) => void;
  setMessages: (messages: MessageParam[]) => void;
  setProcessing: (processing: boolean) => void;
  setLastResponse: (response: string) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isProcessing: false,
  lastResponse: '',
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setLastResponse: (lastResponse) => set({ lastResponse }),
  reset: () => set({ messages: [], isProcessing: false, lastResponse: '' }),
}));
