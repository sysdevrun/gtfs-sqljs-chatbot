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
 * Get available voices, waiting for them to load if necessary
 */
export function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // Voices not loaded yet, wait for them
    const handleVoicesChanged = () => {
      const loadedVoices = window.speechSynthesis.getVoices();
      resolve(loadedVoices);
    };

    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged, { once: true });

    // Fallback timeout in case voiceschanged never fires
    setTimeout(() => {
      const fallbackVoices = window.speechSynthesis.getVoices();
      resolve(fallbackVoices);
    }, 100);
  });
}

/**
 * Get voices filtered by language, sorted with Google voices first
 * For French, prioritizes fr-FR over other French variants
 */
export function getVoicesForLanguage(voices: SpeechSynthesisVoice[], language: Language): SpeechSynthesisVoice[] {
  const targetLang = SPEECH_LANGUAGE_MAP[language];
  const langPrefix = targetLang.split('-')[0];

  // Filter voices that match the language
  const matchingVoices = voices.filter(v => v.lang.startsWith(langPrefix));

  // Sort: Google voices first, then exact lang match (e.g., fr-FR), then others
  return matchingVoices.sort((a, b) => {
    const aIsGoogle = a.name.toLowerCase().includes('google') ? 0 : 1;
    const bIsGoogle = b.name.toLowerCase().includes('google') ? 0 : 1;
    if (aIsGoogle !== bIsGoogle) return aIsGoogle - bIsGoogle;

    // For exact language match priority
    const aExact = a.lang === targetLang ? 0 : 1;
    const bExact = b.lang === targetLang ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;

    // Sort by name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Find a voice by name from the available voices
 */
export function findVoiceByName(voices: SpeechSynthesisVoice[], name: string): SpeechSynthesisVoice | null {
  return voices.find(v => v.name === name) || null;
}

/**
 * Find the best voice for a language (used as fallback)
 * Prefers Google voices as they are more reliable in Chrome
 */
function findVoiceForLanguage(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const langPrefix = lang.split('-')[0];

  // First priority: Google voice with exact language match
  let voice = voices.find(v => v.name.toLowerCase().includes('google') && v.lang === lang);
  if (voice) return voice;

  // Second priority: Google voice with language prefix match
  voice = voices.find(v => v.name.toLowerCase().includes('google') && v.lang.startsWith(langPrefix));
  if (voice) return voice;

  // Third priority: Any voice with exact language match
  voice = voices.find(v => v.lang === lang);
  if (voice) return voice;

  // Fourth priority: Any voice with language prefix match
  voice = voices.find(v => v.lang.startsWith(langPrefix));
  if (voice) return voice;

  // Fall back to any available voice
  return voices[0] || null;
}

/**
 * Speak text using Web Speech Synthesis
 * @param text - Text to speak
 * @param language - Language code
 * @param voiceName - Optional specific voice name to use
 */
export async function speak(text: string, language: Language = 'fr', voiceName?: string | null): Promise<void> {
  if (!isSpeechSynthesisSupported()) {
    throw new Error('Speech Synthesis not supported');
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Get available voices
  const voices = await getVoices();

  // Find voice: use specified voice name or fall back to auto-selection
  let voice: SpeechSynthesisVoice | null = null;
  if (voiceName) {
    voice = findVoiceByName(voices, voiceName);
  }
  if (!voice) {
    const targetLang = SPEECH_LANGUAGE_MAP[language];
    voice = findVoiceForLanguage(voices, targetLang);
  }

  if (!voice) {
    throw new Error(`No voice available for language: ${language}`);
  }

  // Remove markdown formatting that would be read aloud
  const cleanedText = text.replace(/\*\*/g, '');

  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => resolve();

    utterance.onerror = (event) => {
      // Ignore 'interrupted' and 'canceled' errors as they happen when we cancel
      if (event.error === 'interrupted' || event.error === 'canceled') {
        resolve();
      } else {
        reject(new Error(`Speech synthesis error: ${event.error}`));
      }
    };

    // Chrome bug workaround: small delay after cancel before speaking
    setTimeout(() => {
      // Resume in case it's paused (Chrome bug)
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      window.speechSynthesis.speak(utterance);

      // Chrome bug: sometimes speech gets stuck, use a workaround
      // by periodically calling resume()
      const resumeInterval = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          clearInterval(resumeInterval);
          return;
        }
        if (window.speechSynthesis.paused) {
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
