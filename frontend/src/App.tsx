import React, { useState, useCallback } from 'react';
import { ShoppingCart, Sparkles, HelpCircle, CheckCircle2, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { useSpeechRecognition, type SupportedLanguage } from './hooks/useSpeechRecognition';
import { useShoppingList } from './hooks/useShoppingList';
import { VoiceButton } from './components/VoiceButton';
import { ReasoningBadge } from './components/ReasoningBadge';
import { SuggestionsPanel } from './components/SuggestionsPanel';
import { ShoppingList } from './components/ShoppingList';
import { SearchBar } from './components/SearchBar';

export const App: React.FC = () => {
  const {
    items,
    suggestions,
    lastCommand,
    stats,
    isLoading,
    isParsing,
    toast,
    setToast,
    executeCommand,
    executeAudioCommand,
    addItem,
    changeQuantity,
    changeCategory,
    removeItem,
    acceptSuggestion,
    dismissSuggestion,
    refreshData,
  } = useShoppingList();

  const [externalSearchQuery, setExternalSearchQuery] = useState<string>('');
  const [showArchExplainer, setShowArchExplainer] = useState<boolean>(false);

  // Handle final speech result (transcript + audio blob)
  const handleFinalSpeechResult = useCallback(
    async (text: string, audioBlob: Blob | null, lang: SupportedLanguage) => {
      const languageCode = lang.split('-')[0]; // "en", "hi", "es"
      try {
        let result = null;

        // If non-English and audio blob is recorded -> use Whisper Careful Listening
        if (lang !== 'en-US' && audioBlob && audioBlob.size > 500) {
          result = await executeAudioCommand(audioBlob, languageCode);
        } else if (text && text.trim()) {
          // English live speech recognition
          result = await executeCommand(text.trim(), languageCode, 'web_speech');
        } else if (audioBlob && audioBlob.size > 2000) {
          // English fallback to Whisper only if substantial audio was recorded
          result = await executeAudioCommand(audioBlob, languageCode);
        }

        if (result && result.intent === 'SEARCH') {
          setExternalSearchQuery(result.brand || result.items[0]?.name || text);
        }
      } catch {
        // Handled in useShoppingList toast
      }
    },
    [executeCommand, executeAudioCommand]
  );

  const {
    isListening,
    interimTranscript,
    isSupported,
    error: speechError,
    language,
    setLanguage,
    startListening,
    stopListening,
  } = useSpeechRecognition(handleFinalSpeechResult);

  const handleManualCommand = async (text: string, lang: SupportedLanguage) => {
    const languageCode = lang.split('-')[0];
    const result = await executeCommand(text, languageCode);
    if (result && result.intent === 'SEARCH') {
      setExternalSearchQuery(result.brand || result.items[0]?.name || text);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 transition-all animate-bounce-short ${
            toast.type === 'success'
              ? 'bg-slate-900 text-white border-slate-800'
              : toast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-800'
              : 'bg-slate-800 text-white border-slate-700'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400 shrink-0" />}
          <p className="text-xs font-medium leading-snug flex-1">{toast.text}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white text-xs font-bold px-1.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Responsive Container */}
      <main className="max-w-md mx-auto pt-6 px-2">
        {/* Header */}
        <header className="px-4 flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                Voice Shopping Assistant
              </h1>
              <p className="text-[11px] text-emerald-700 font-medium">
                Dual-Engine NLU • Fast & Slow Thinking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={refreshData}
              title="Refresh list"
              className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowArchExplainer(!showArchExplainer)}
              title="About Thinking Fast & Slow architecture"
              className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Architecture Info Banner Modal / Card */}
        {showArchExplainer && (
          <div className="mx-4 mb-4 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 rounded-2xl p-4 shadow-xl border border-slate-700 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> The Human-Logic Difference
              </span>
              <button
                type="button"
                onClick={() => setShowArchExplainer(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>1. Thinking Fast & Slow:</strong> System 1 handles 80% of routine commands locally in &lt;50ms ($0 cost). System 2 LLM awakens only for ambiguity or foreign speech.
            </p>
            <p className="text-slate-300 leading-relaxed">
              <strong>2. Pantry Decay Model:</strong> Tracks grocery depletion intervals (milk ≈ 5d, bread ≈ 6d). Proactively surfaces "running low" alerts before you run out without black-box ML.
            </p>
          </div>
        )}

        {/* Voice Control & Input Section */}
        <VoiceButton
          isListening={isListening}
          interimTranscript={interimTranscript}
          isSupported={isSupported}
          speechError={speechError}
          language={language}
          isParsing={isParsing}
          onStartListening={startListening}
          onStopListening={stopListening}
          onLanguageChange={setLanguage}
          onSubmitTextCommand={handleManualCommand}
        />

        {/* System 1 / System 2 Reasoning Badge & Telemetry */}
        <ReasoningBadge lastCommand={lastCommand} stats={stats} />

        {/* Store Catalog Search & Filter Chips */}
        <SearchBar onAddItem={addItem} externalSearchQuery={externalSearchQuery} />

        {/* Smart Suggestions (Pantry Decay, Seasonal, Substitutes) */}
        <SuggestionsPanel
          suggestions={suggestions}
          onAccept={acceptSuggestion}
          onDismiss={dismissSuggestion}
        />

        {/* Categorized Shopping List with Depletion Bars */}
        <ShoppingList
          items={items}
          isLoading={isLoading}
          onQuantityChange={changeQuantity}
          onCategoryChange={changeCategory}
          onRemoveItem={removeItem}
        />
      </main>
    </div>
  );
};

export default App;
