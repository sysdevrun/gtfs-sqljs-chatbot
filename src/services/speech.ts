import type { Language } from '../stores/settingsStore';

// Map our language codes to Web Speech API language codes
const SPEECH_LANGUAGE_MAP: Record<Language, string> = {
  fr: 'fr-FR',
  en: 'en-US',
};

// Web Speech API types
interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

// Extend window type
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/**
 * Check if Speech Recognition is supported
 */
export function isSpeechRecognitionSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Check if Speech Synthesis is supported
 */
export function isSpeechSynthesisSupported(): boolean {
  return 'speechSynthesis' in window;
}

/**
 * Start speech recognition and return a promise with the transcript
 */
export function startSpeechRecognition(language: Language = 'fr'): Promise<string> {
  return new Promise((resolve, reject) => {
    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      reject(new Error('Speech Recognition not supported in this browser'));
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = SPEECH_LANGUAGE_MAP[language];

    let finalTranscript = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      reject(new Error(`Speech recognition error: ${event.error}`));
    };

    recognition.onend = () => {
      if (finalTranscript) {
        resolve(finalTranscript.trim());
      } else {
        reject(new Error('No speech detected'));
      }
    };

    recognition.start();
  });
}

/**
 * Speak text using Web Speech Synthesis
 */
export function speak(text: string, language: Language = 'fr'): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[TTS] speak() called with text length:', text.length);

    if (!isSpeechSynthesisSupported()) {
      console.error('[TTS] Speech Synthesis not supported');
      reject(new Error('Speech Synthesis not supported'));
      return;
    }

    // Cancel any ongoing speech
    console.log('[TTS] Cancelling any ongoing speech');
    window.speechSynthesis.cancel();

    // Remove markdown formatting that would be read aloud
    const cleanedText = text.replace(/\*\*/g, '');
    console.log('[TTS] Cleaned text:', cleanedText.substring(0, 100) + '...');

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = SPEECH_LANGUAGE_MAP[language];
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    console.log('[TTS] Created utterance with lang:', utterance.lang);

    utterance.onstart = () => {
      console.log('[TTS] Speech started');
    };

    utterance.onend = () => {
      console.log('[TTS] Speech ended normally');
      resolve();
    };

    utterance.onerror = (event) => {
      console.error('[TTS] Speech error:', event.error);
      // Ignore 'interrupted' and 'canceled' errors as they happen when we cancel
      if (event.error === 'interrupted' || event.error === 'canceled') {
        resolve();
      } else {
        reject(new Error(`Speech synthesis error: ${event.error}`));
      }
    };

    // Chrome bug workaround: small delay after cancel before speaking
    // and resume in case synthesis is paused
    setTimeout(() => {
      console.log('[TTS] After delay - calling speechSynthesis.speak()');
      console.log('[TTS] speechSynthesis.speaking:', window.speechSynthesis.speaking);
      console.log('[TTS] speechSynthesis.paused:', window.speechSynthesis.paused);
      console.log('[TTS] speechSynthesis.pending:', window.speechSynthesis.pending);

      // Resume in case it's paused (Chrome bug)
      if (window.speechSynthesis.paused) {
        console.log('[TTS] Resuming paused synthesis');
        window.speechSynthesis.resume();
      }

      window.speechSynthesis.speak(utterance);

      console.log('[TTS] After speak() - speaking:', window.speechSynthesis.speaking);
      console.log('[TTS] After speak() - paused:', window.speechSynthesis.paused);
      console.log('[TTS] After speak() - pending:', window.speechSynthesis.pending);

      // Chrome bug: sometimes speech gets stuck, use a workaround
      // by periodically calling resume()
      const resumeInterval = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          clearInterval(resumeInterval);
          return;
        }
        if (window.speechSynthesis.paused) {
          console.log('[TTS] Resuming paused synthesis (interval)');
          window.speechSynthesis.resume();
        }
      }, 100);

      // Clean up interval when done
      utterance.addEventListener('end', () => clearInterval(resumeInterval));
      utterance.addEventListener('error', () => clearInterval(resumeInterval));
    }, 50);
  });
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
