import { useState, useEffect } from 'react';
import { VoiceTab } from './VoiceTab';
import { SettingsTab } from './SettingsTab';
import { DebugTab } from './DebugTab';
import { useGtfsWorker } from '../hooks/useGtfsWorker';
import { useSettingsStore } from '../stores/settingsStore';
import type { AppTab } from '../types';

const tabs: { id: AppTab; label: string; ariaLabel: string }[] = [
  { id: 'voice', label: 'Voice', ariaLabel: 'Voice chat interface' },
  { id: 'settings', label: 'Settings', ariaLabel: 'Application settings' },
  { id: 'debug', label: 'Debug', ariaLabel: 'Debug information' },
];

// Extract API key from URL hash if present
function extractApiKeyFromHash(): string | null {
  const hash = window.location.hash;
  if (!hash) return null;

  // Parse hash parameters (format: #param1=value1&param2=value2)
  const params = new URLSearchParams(hash.slice(1));
  return params.get('claude-key');
}

// Remove claude-key from URL hash
function removeApiKeyFromHash(): void {
  const hash = window.location.hash;
  if (!hash) return;

  const params = new URLSearchParams(hash.slice(1));
  if (params.has('claude-key')) {
    params.delete('claude-key');
    const newHash = params.toString();
    // Update URL without triggering navigation
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search + (newHash ? '#' + newHash : '')
    );
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('voice');
  const { api, loadingState, progress, error, reload } = useGtfsWorker();
  const setApiKey = useSettingsStore((s) => s.setApiKey);

  // Check for API key in URL hash on mount
  useEffect(() => {
    const keyFromHash = extractApiKeyFromHash();
    if (keyFromHash) {
      setApiKey(keyFromHash);
      removeApiKeyFromHash();
    }
  }, [setApiKey]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header
        className="bg-white border-b border-gray-200"
        role="banner"
      >
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">
            GTFS Voice Chatbot
          </h1>
          <p className="text-sm text-gray-500">
            Ask questions about transit schedules using your voice
          </p>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav
        className="bg-white border-b border-gray-200"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-4xl mx-auto px-4">
          <div
            className="flex space-x-8"
            role="tablist"
            aria-label="Application sections"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className={`
                  py-3 px-1 border-b-2 font-medium text-sm transition-colors
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
                  ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
                aria-label={tab.ariaLabel}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Tab Content */}
      <main
        className="max-w-4xl mx-auto pb-16"
        id="main-content"
        role="main"
      >
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === 'voice' && (
            <VoiceTab
              gtfsApi={api}
              gtfsLoadingState={loadingState}
              gtfsProgress={progress}
              gtfsError={error}
            />
          )}
          {activeTab === 'settings' && <SettingsTab onGtfsUrlChange={reload} />}
          {activeTab === 'debug' && <DebugTab />}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2"
        role="contentinfo"
      >
        <div className="max-w-4xl mx-auto px-4 text-center text-xs text-gray-500">
          Powered by Claude AI and gtfs-sqljs.
          <span className="sr-only">
            This application is accessible with screen readers. Use Tab to navigate and Enter to activate controls.
          </span>
        </div>
      </footer>
    </div>
  );
}
