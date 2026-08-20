import React, { useState } from 'react';
import { Mic, MicOff, Send, Globe, AlertCircle, Sparkles } from 'lucide-react';
import type { SupportedLanguage } from '../hooks/useSpeechRecognition';

interface VoiceButtonProps {
  isListening: boolean;
  interimTranscript: string;
  isSupported: boolean;
  speechError: string | null;
  language: SupportedLanguage;
  isParsing: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onSubmitTextCommand: (text: string, lang: SupportedLanguage) => void;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  isListening,
  interimTranscript,
  isSupported,
  speechError,
  language,
  isParsing,
  onStartListening,
  onStopListening,
  onLanguageChange,
  onSubmitTextCommand,
}) => {
  const [typedInput, setTypedInput] = useState('');

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedInput.trim() || isParsing) return;
    onSubmitTextCommand(typedInput.trim(), language);
    setTypedInput('');
  };

  const handleMicClick = () => {
    if (!isSupported) return;
    if (isListening) {
      onStopListening();
    } else {
      onStartListening();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto my-4 px-4">
      {/* Language Selector Chips */}
      <div className="flex items-center gap-2 mb-3 bg-slate-100 p-1 rounded-full border border-slate-200 text-xs font-medium text-slate-600">
        <Globe className="w-3.5 h-3.5 ml-2 text-slate-400" />
        <button
          type="button"
          onClick={() => onLanguageChange('en-US')}
          className={`px-3 py-1 rounded-full transition-all ${
            language === 'en-US'
              ? 'bg-white text-emerald-700 shadow-sm font-semibold'
              : 'hover:text-slate-900'
          }`}
        >
          English (⚡ Fast)
        </button>
        <button
          type="button"
          onClick={() => onLanguageChange('hi-IN')}
          className={`px-3 py-1 rounded-full transition-all ${
            language === 'hi-IN'
              ? 'bg-white text-blue-700 shadow-sm font-semibold'
              : 'hover:text-slate-900'
          }`}
        >
          हिंदी (🧠 Conscious)
        </button>
        <button
          type="button"
          onClick={() => onLanguageChange('es-ES')}
          className={`px-3 py-1 rounded-full transition-all ${
            language === 'es-ES'
              ? 'bg-white text-blue-700 shadow-sm font-semibold'
              : 'hover:text-slate-900'
          }`}
        >
          Español (🧠 Conscious)
        </button>
      </div>

      {/* Live Interim Transcript Display */}
      <div className="min-h-[32px] flex items-center justify-center text-center mb-2 px-3">
        {isListening ? (
          <div className="flex flex-col items-center">
            <p className="text-sm font-semibold text-emerald-600 animate-pulse flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              {interimTranscript ? `"${interimTranscript}"` : 'Listening... speak now'}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Tap mic button again when finished speaking
            </span>
          </div>
        ) : isParsing ? (
          <p className="text-sm font-medium text-blue-600 flex items-center gap-1.5 animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin text-blue-500" />
            Processing command...
          </p>
        ) : (
          <p className="text-xs text-slate-400">
            Tap mic to speak • Tap again to process • Or type below
          </p>
        )}
      </div>

      {/* Large Mic Button */}
      <div className="relative my-2">
        {isListening && (
          <div className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 animate-ping pointer-events-none" />
        )}
        <button
          type="button"
          id="voice-mic-button"
          onClick={handleMicClick}
          disabled={!isSupported || isParsing}
          aria-label={isListening ? 'Stop listening' : 'Start voice recognition'}
          className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 transform active:scale-95 ${
            !isSupported
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-2 border-slate-300'
              : isListening
              ? 'bg-emerald-500 text-white shadow-emerald-200 scale-105 ring-4 ring-emerald-200'
              : isParsing
              ? 'bg-blue-500 text-white animate-pulse'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100 hover:shadow-xl'
          }`}
        >
          {isListening ? (
            <MicOff className="w-8 h-8" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </button>
      </div>

      {/* Speech Error Banner */}
      {speechError && (
        <div className="mt-3 w-full bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>{speechError}</p>
        </div>
      )}

      {/* Fallback Text Input */}
      <form onSubmit={handleManualSubmit} className="mt-4 w-full flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            id="manual-command-input"
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            placeholder={
              language === 'hi-IN'
                ? "या टाइप करें (उदा. 'doodh aur andey add karo')"
                : language === 'es-ES'
                ? "O escribe (ej. 'agregar 2 leches y cafe')"
                : "Or type a command (e.g. 'buy 3 apples')"
            }
            disabled={isParsing}
            className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm"
          />
          {typedInput && (
            <button
              type="button"
              onClick={() => setTypedInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          id="manual-submit-button"
          disabled={!typedInput.trim() || isParsing}
          className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl px-4 py-2.5 text-sm font-medium transition-all flex items-center justify-center shrink-0 shadow-sm"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
