import { useState } from 'react';
import { VoiceTab } from './VoiceTab';
import { SettingsTab } from './SettingsTab';
import { DebugTab } from './DebugTab';
import { useGtfsWorker } from '../hooks/useGtfsWorker';
import type { AppTab } from '../types';

const tabs: { id: AppTab; label: string }[] = [
  { id: 'voice', label: 'Voice' },
  { id: 'settings', label: 'Settings' },
  { id: 'debug', label: 'Debug' },
];

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('voice');
  const { api, loadingState, progress, error, reload } = useGtfsWorker();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
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
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-3 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Tab Content */}
      <main className="max-w-4xl mx-auto">
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
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2">
        <div className="max-w-4xl mx-auto px-4 text-center text-xs text-gray-500">
          Powered by Claude AI and gtfs-sqljs
        </div>
      </footer>
    </div>
  );
}
