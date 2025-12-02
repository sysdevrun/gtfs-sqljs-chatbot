import { useState, useEffect, useId } from 'react';
import { useSettingsStore, LANGUAGE_LABELS, MODEL_LABELS, DEFAULT_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT_EN } from '../stores/settingsStore';
import type { Language, Model } from '../stores/settingsStore';

interface SettingsTabProps {
  onGtfsUrlChange: () => void;
}

// Build URL with API key in hash
function buildUrlWithApiKey(apiKey: string): string {
  const url = new URL(window.location.href);
  // Clear existing hash and add claude-key
  const params = new URLSearchParams();
  params.set('claude-key', apiKey);
  url.hash = params.toString();
  return url.toString();
}

export function SettingsTab({ onGtfsUrlChange }: SettingsTabProps) {
  const { apiKey, gtfsUrl, language, model, systemPrompt, setApiKey, setGtfsUrl, setLanguage, setModel, setSystemPrompt } = useSettingsStore();
  const apiKeyDescId = useId();
  const gtfsUrlDescId = useId();
  const languageDescId = useId();
  const modelDescId = useId();
  const systemPromptDescId = useId();

  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localGtfsUrl, setLocalGtfsUrl] = useState(gtfsUrl);
  const [localLanguage, setLocalLanguage] = useState<Language>(language);
  const [localModel, setLocalModel] = useState<Model>(model);
  const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLocalApiKey(apiKey);
    setLocalGtfsUrl(gtfsUrl);
    setLocalLanguage(language);
    setLocalModel(model);
    setLocalSystemPrompt(systemPrompt);
  }, [apiKey, gtfsUrl, language, model, systemPrompt]);

  const handleSave = () => {
    const urlChanged = localGtfsUrl !== gtfsUrl;

    setApiKey(localApiKey);
    setGtfsUrl(localGtfsUrl);
    setLanguage(localLanguage);
    setModel(localModel);
    setSystemPrompt(localSystemPrompt);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    if (urlChanged) {
      onGtfsUrlChange();
    }
  };

  const handleReset = () => {
    const defaultUrl = 'https://pysae.com/api/v2/groups/car-jaune/gtfs/pub';
    setLocalGtfsUrl(defaultUrl);
  };

  const handleResetSystemPrompt = () => {
    setLocalSystemPrompt(localLanguage === 'fr' ? DEFAULT_SYSTEM_PROMPT : DEFAULT_SYSTEM_PROMPT_EN);
  };

  const handleLanguageChange = (newLanguage: Language) => {
    setLocalLanguage(newLanguage);
    // Offer to update system prompt if it's the default for the old language
    const oldDefault = localLanguage === 'fr' ? DEFAULT_SYSTEM_PROMPT : DEFAULT_SYSTEM_PROMPT_EN;
    if (localSystemPrompt === oldDefault) {
      setLocalSystemPrompt(newLanguage === 'fr' ? DEFAULT_SYSTEM_PROMPT : DEFAULT_SYSTEM_PROMPT_EN);
    }
  };

  const handleCopyUrlWithKey = async () => {
    if (!localApiKey) return;

    const urlWithKey = buildUrlWithApiKey(localApiKey);
    try {
      await navigator.clipboard.writeText(urlWithKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = urlWithKey;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="max-w-lg mx-auto p-6 space-y-6"
      role="region"
      aria-label="Application settings"
    >
      <h2 className="text-xl font-semibold text-gray-800">Settings</h2>

      {/* Language */}
      <div className="space-y-2">
        <label
          htmlFor="language"
          className="block text-sm font-medium text-gray-700"
        >
          Langue / Language
        </label>
        <select
          id="language"
          value={localLanguage}
          onChange={(e) => handleLanguageChange(e.target.value as Language)}
          aria-describedby={languageDescId}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
            <option key={lang} value={lang}>
              {LANGUAGE_LABELS[lang]}
            </option>
          ))}
        </select>
        <p id={languageDescId} className="text-xs text-gray-500">
          Langue pour la reconnaissance vocale et la synthese vocale. / Language for voice recognition and synthesis.
        </p>
      </div>

      {/* Model */}
      <div className="space-y-2">
        <label
          htmlFor="model"
          className="block text-sm font-medium text-gray-700"
        >
          Claude Model
        </label>
        <select
          id="model"
          value={localModel}
          onChange={(e) => setLocalModel(e.target.value as Model)}
          aria-describedby={modelDescId}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          {(Object.keys(MODEL_LABELS) as Model[]).map((m) => (
            <option key={m} value={m}>
              {MODEL_LABELS[m]}
            </option>
          ))}
        </select>
        <p id={modelDescId} className="text-xs text-gray-500">
          Claude model to use for responses. Haiku is faster and cheaper, Sonnet is more capable, Opus is most capable.
        </p>
      </div>

      {/* API Key */}
      <div className="space-y-2">
        <label
          htmlFor="apiKey"
          className="block text-sm font-medium text-gray-700"
        >
          Claude API Key
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            id="apiKey"
            value={localApiKey}
            onChange={(e) => setLocalApiKey(e.target.value)}
            placeholder="sk-ant-..."
            aria-describedby={apiKeyDescId}
            aria-required="true"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={handleCopyUrlWithKey}
            disabled={!localApiKey}
            className={`
              px-3 py-2 text-sm rounded-lg border transition-colors
              ${localApiKey
                ? 'border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                : 'border-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
            title="Copy URL with API key to clipboard"
            aria-label="Copy URL with API key to clipboard"
          >
            {copied ? '✓' : '📋'}
          </button>
        </div>
        <p id={apiKeyDescId} className="text-xs text-gray-500">
          Your API key is stored locally in your browser and never sent to any
          server except Anthropic's API.
          {localApiKey && (
            <span className="block mt-1">
              Click 📋 to copy a shareable URL with your API key.
            </span>
          )}
        </p>
      </div>

      {/* GTFS URL */}
      <div className="space-y-2">
        <label
          htmlFor="gtfsUrl"
          className="block text-sm font-medium text-gray-700"
        >
          GTFS Feed URL
        </label>
        <input
          type="url"
          id="gtfsUrl"
          value={localGtfsUrl}
          onChange={(e) => setLocalGtfsUrl(e.target.value)}
          placeholder="https://example.com/gtfs.zip"
          aria-describedby={gtfsUrlDescId}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="flex items-center justify-between" id={gtfsUrlDescId}>
          <p className="text-xs text-gray-500">
            URL to a GTFS ZIP file. Default is Car Jaune (La Réunion).
          </p>
          <button
            onClick={handleReset}
            type="button"
            className="text-xs text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label="Reset GTFS URL to default Car Jaune feed"
          >
            Reset to default
          </button>
        </div>
      </div>

      {/* System Prompt */}
      <div className="space-y-2">
        <label
          htmlFor="systemPrompt"
          className="block text-sm font-medium text-gray-700"
        >
          System Prompt (Instructions for AI)
        </label>
        <textarea
          id="systemPrompt"
          value={localSystemPrompt}
          onChange={(e) => setLocalSystemPrompt(e.target.value)}
          rows={10}
          aria-describedby={systemPromptDescId}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
        />
        <div className="flex items-center justify-between" id={systemPromptDescId}>
          <p className="text-xs text-gray-500">
            Instructions given to Claude for how to respond to queries.
          </p>
          <button
            onClick={handleResetSystemPrompt}
            type="button"
            className="text-xs text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label="Reset system prompt to default"
          >
            Reset to default
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center space-x-4">
        <button
          onClick={handleSave}
          type="button"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Save all settings"
        >
          Save Settings
        </button>
        {saved && (
          <span
            className="text-green-600 text-sm"
            role="status"
            aria-live="polite"
          >
            Settings saved!
          </span>
        )}
      </div>

      {/* Info Box */}
      <div
        className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6"
        role="note"
        aria-label="About this application"
      >
        <h3 className="font-medium text-blue-800 mb-2">About</h3>
        <p className="text-sm text-blue-700">
          This app uses the Web Speech API for voice input/output and Claude AI
          to understand your transit queries. The GTFS data is processed
          entirely in your browser. Voice input works best in Chrome or Edge browsers.
        </p>
      </div>

      {/* Keyboard shortcuts info for screen readers */}
      <div className="sr-only" role="note">
        <h3>Keyboard navigation tips:</h3>
        <p>Use Tab to move between form fields. Press Enter to activate buttons.</p>
      </div>
    </div>
  );
}
