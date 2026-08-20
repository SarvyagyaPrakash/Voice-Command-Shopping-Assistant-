import React, { useState, useCallback } from 'react';
import { HelpCircle, CheckCircle2, AlertTriangle, Info, RefreshCw, Cpu } from 'lucide-react';
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

  // Handle final speech result (transcript + audio blob) after user clicks STOP
  const handleFinalSpeechResult = useCallback(
    async (text: string, audioBlob: Blob | null, lang: SupportedLanguage) => {
      const languageCode = lang.split('-')[0]; // "en", "hi", "es"
      
      const cleanText = (text || '').trim();
      const hasAudio = audioBlob && audioBlob.size > 1000;

      // If user stopped without saying anything, don't execute any command
      if (!cleanText && !hasAudio) {
        setToast({
          id: Date.now().toString(),
          type: 'info',
          text: 'No speech detected. Tap the mic, say your item, and tap again to stop.',
        });
        return;
      }

      try {
        let result = null;

        // If non-English or if live transcript is empty -> use Whisper
        if (lang !== 'en-US' && hasAudio) {
          result = await executeAudioCommand(audioBlob, languageCode);
        } else if (cleanText) {
          // English live speech recognition
          result = await executeCommand(cleanText, languageCode, 'web_speech');
        } else if (hasAudio) {
          result = await executeAudioCommand(audioBlob, languageCode);
        }

        if (result && result.intent === 'SEARCH') {
          setExternalSearchQuery(result.brand || result.items[0]?.name || cleanText);
        }
      } catch {
        // Handled in useShoppingList toast
      }
    },
    [executeCommand, executeAudioCommand, setToast]
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
    <div className="min-h-screen pb-20">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] px-4 py-3.5 rounded-2xl shadow-xl border backdrop-blur-md flex items-center gap-3 transition-all animate-fadeIn ${
            toast.type === 'success'
              ? 'bg-palette-deep/95 text-white border-palette-soft/40 shadow-glow-soft'
              : toast.type === 'error'
              ? 'bg-rose-900/95 text-white border-rose-700/50'
              : 'bg-palette-deep/90 text-white border-palette-soft/30'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-palette-soft shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-palette-soft shrink-0" />}
          <p className="text-xs font-medium leading-snug flex-1">{toast.text}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-palette-soft/70 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded-md hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Responsive Container */}
      <main className="max-w-lg mx-auto pt-6 px-3">
        {/* Header */}
        <header className="px-3 flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-palette-deep border border-palette-soft/40 p-1 flex items-center justify-center shadow-glow-primary overflow-hidden group">
              <img
                src="/logo.png"
                alt="Voice Shopping Assistant Logo"
                className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform"
              />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-palette-deep tracking-tight leading-tight">
                Voice Shopping Assistant
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-palette-primary animate-pulse" />
                <p className="text-[11px] text-palette-primary font-semibold tracking-wide uppercase">
                  Fast & Slow Human Logic
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-white/70 backdrop-blur-sm p-1 rounded-2xl border border-palette-light shadow-xs">
            <button
              type="button"
              onClick={refreshData}
              title="Refresh list"
              className="text-palette-deep/70 hover:text-palette-primary p-2 rounded-xl hover:bg-palette-light/60 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowArchExplainer(!showArchExplainer)}
              title="About Thinking Fast & Slow architecture"
              className={`p-2 rounded-xl transition-all ${
                showArchExplainer 
                  ? 'bg-palette-primary text-white shadow-sm' 
                  : 'text-palette-deep/70 hover:text-palette-primary hover:bg-palette-light/60'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Architecture Info Banner Modal */}
        {showArchExplainer && (
          <div className="mx-2 mb-4 bg-gradient-to-br from-palette-deep via-palette-navy to-palette-deep text-white rounded-3xl p-4 shadow-card-elevated border border-palette-soft/30 text-xs space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="font-bold text-palette-soft flex items-center gap-1.5 text-xs tracking-wide">
                <Cpu className="w-4 h-4 text-palette-primary" /> The Thinking Fast & Slow Architecture
              </span>
              <button
                type="button"
                onClick={() => setShowArchExplainer(false)}
                className="text-palette-soft hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5 text-palette-light/90 leading-relaxed font-normal">
              <p>
                <strong className="text-white">⚡ System 1 (Instant Reflex):</strong> Sub-50ms regex parser handles 80% of familiar phrasing with $0 API cost and zero lag.
              </p>
              <p>
                <strong className="text-white">🧠 System 2 (Conscious LLM):</strong> Groq LLaMA-3 awakens for multi-item sentences, ambiguous phrasing, or language switches.
              </p>
              <p>
                <strong className="text-white">🎧 Careful Audio:</strong> Hugging Face Whisper Large V3 provides high-precision transcription for non-English audio.
              </p>
            </div>
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
