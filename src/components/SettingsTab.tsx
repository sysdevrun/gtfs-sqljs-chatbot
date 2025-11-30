import { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

interface SettingsTabProps {
  onGtfsUrlChange: () => void;
}

export function SettingsTab({ onGtfsUrlChange }: SettingsTabProps) {
  const { apiKey, gtfsUrl, setApiKey, setGtfsUrl } = useSettingsStore();

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
    <div className="max-w-lg mx-auto p-6 space-y-6">
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-gray-500">
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            URL to a GTFS ZIP file. Default is Car Jaune (La Réunion).
          </p>
          <button
            onClick={handleReset}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Reset to default
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center space-x-4">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Save Settings
        </button>
        {saved && (
          <span className="text-green-600 text-sm animate-fade-in">
            Settings saved!
          </span>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
        <h3 className="font-medium text-blue-800 mb-2">About</h3>
        <p className="text-sm text-blue-700">
          This app uses the Web Speech API for voice input/output and Claude AI
          to understand your transit queries. The GTFS data is processed
          entirely in your browser.
        </p>
      </div>
    </div>
  );
}
