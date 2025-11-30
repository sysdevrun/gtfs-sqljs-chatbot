import { useState, useEffect, useId } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

interface SettingsTabProps {
  onGtfsUrlChange: () => void;
}

export function SettingsTab({ onGtfsUrlChange }: SettingsTabProps) {
  const { apiKey, gtfsUrl, setApiKey, setGtfsUrl } = useSettingsStore();
  const apiKeyDescId = useId();
  const gtfsUrlDescId = useId();

  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localGtfsUrl, setLocalGtfsUrl] = useState(gtfsUrl);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalApiKey(apiKey);
    setLocalGtfsUrl(gtfsUrl);
  }, [apiKey, gtfsUrl]);

  const handleSave = () => {
    const urlChanged = localGtfsUrl !== gtfsUrl;

    setApiKey(localApiKey);
    setGtfsUrl(localGtfsUrl);

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

  return (
    <div
      className="max-w-lg mx-auto p-6 space-y-6"
      role="region"
      aria-label="Application settings"
    >
      <h2 className="text-xl font-semibold text-gray-800">Settings</h2>

      {/* API Key */}
      <div className="space-y-2">
        <label
          htmlFor="apiKey"
          className="block text-sm font-medium text-gray-700"
        >
          Claude API Key
        </label>
        <input
          type="password"
          id="apiKey"
          value={localApiKey}
          onChange={(e) => setLocalApiKey(e.target.value)}
          placeholder="sk-ant-..."
          aria-describedby={apiKeyDescId}
          aria-required="true"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p id={apiKeyDescId} className="text-xs text-gray-500">
          Your API key is stored locally in your browser and never sent to any
          server except Anthropic's API.
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
