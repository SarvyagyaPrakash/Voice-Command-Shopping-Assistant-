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
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto my-3 px-2">
      {/* Language Selector Chips */}
      <div className="flex items-center gap-1.5 mb-3.5 bg-white/80 backdrop-blur-sm p-1.5 rounded-2xl border border-palette-light shadow-xs text-xs font-semibold text-palette-deep">
        <Globe className="w-3.5 h-3.5 ml-2 text-palette-primary shrink-0" />
        <button
          type="button"
          onClick={() => onLanguageChange('en-US')}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            language === 'en-US'
              ? 'bg-palette-deep text-white shadow-sm font-bold'
              : 'text-palette-deep/70 hover:text-palette-deep hover:bg-palette-light/50'
          }`}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => onLanguageChange('hi-IN')}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            language === 'hi-IN'
              ? 'bg-palette-deep text-white shadow-sm font-bold'
              : 'text-palette-deep/70 hover:text-palette-deep hover:bg-palette-light/50'
          }`}
        >
          हिंदी
        </button>
        <button
          type="button"
          onClick={() => onLanguageChange('es-ES')}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            language === 'es-ES'
              ? 'bg-palette-deep text-white shadow-sm font-bold'
              : 'text-palette-deep/70 hover:text-palette-deep hover:bg-palette-light/50'
          }`}
        >
          Español
        </button>
      </div>

      {/* Live Interim Transcript Display */}
      <div className="min-h-[34px] flex items-center justify-center text-center mb-2 px-3">
        {isListening ? (
          <div className="flex flex-col items-center animate-fadeIn">
            <p className="text-sm font-bold text-palette-primary animate-pulse flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-palette-primary animate-ping" />
              {interimTranscript ? `"${interimTranscript}"` : 'Listening... Speak your command'}
            </p>
            <span className="text-[11px] font-medium text-palette-deep/70 mt-0.5">
              Tap mic button again when finished speaking
            </span>
          </div>
        ) : isParsing ? (
          <p className="text-sm font-bold text-palette-primary flex items-center gap-2 animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin text-palette-primary" />
            Analyzing with Thinking Fast & Slow...
          </p>
        ) : (
          <p className="text-xs text-palette-deep/60 font-medium">
            Tap mic to speak • Tap again to process • Or type below
          </p>
        )}
      </div>

      {/* Large Mic Button */}
      <div className="relative my-2">
        {isListening && (
          <div className="absolute inset-0 rounded-full bg-palette-primary opacity-60 animate-ripple pointer-events-none" />
        )}
        <button
          type="button"
          id="voice-mic-button"
          onClick={handleMicClick}
          disabled={!isSupported || isParsing}
          aria-label={isListening ? 'Stop listening' : 'Start voice recognition'}
          className={`relative z-10 w-22 h-22 rounded-full flex items-center justify-center transition-all duration-300 transform active:scale-95 ${
            !isSupported
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-2 border-slate-300'
              : isListening
              ? 'bg-palette-deep text-white shadow-glow-primary scale-105 ring-4 ring-palette-soft'
              : isParsing
              ? 'bg-palette-primary text-white animate-pulse shadow-glow-primary'
              : 'bg-gradient-to-tr from-palette-deep via-palette-primary to-palette-soft hover:from-palette-primary hover:to-palette-deep text-white shadow-glow-primary hover:shadow-xl hover:scale-102'
          }`}
        >
          {isListening ? (
            <MicOff className="w-9 h-9 drop-shadow-md" />
          ) : (
            <Mic className="w-9 h-9 drop-shadow-md" />
          )}
        </button>
      </div>

      {/* Speech Error Banner */}
      {speechError && (
        <div className="mt-3 w-full bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-rose-800 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
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
                ? "या टाइप करें (उदा. 'doodh aur andey lao')"
                : language === 'es-ES'
                ? "O escribe (ej. 'agregar 2 leches y cafe')"
                : "Or type a command (e.g. 'add 2 bottles of milk')"
            }
            disabled={isParsing}
            className="w-full text-xs font-medium bg-white/90 backdrop-blur-sm border border-palette-light rounded-2xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-palette-primary focus:border-transparent transition-all shadow-xs text-palette-deep placeholder:text-palette-deep/40"
          />
          {typedInput && (
            <button
              type="button"
              onClick={() => setTypedInput('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-palette-deep/40 hover:text-palette-deep p-1"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          id="manual-submit-button"
          disabled={!typedInput.trim() || isParsing}
          className="bg-palette-deep hover:bg-palette-navy disabled:bg-palette-light disabled:text-palette-deep/30 text-white rounded-2xl px-4 py-3 text-xs font-bold transition-all flex items-center justify-center shrink-0 shadow-sm active:scale-95"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
