import React, { useState } from 'react';
import { Zap, Brain, Headphones, Info, Activity } from 'lucide-react';
import type { CommandParseResponse, CommandStats } from '../api/client';

interface ReasoningBadgeProps {
  lastCommand: CommandParseResponse | null;
  stats: CommandStats | null;
}

export const ReasoningBadge: React.FC<ReasoningBadgeProps> = ({ lastCommand, stats }) => {
  const [showExplanation, setShowExplanation] = useState(false);

  if (!lastCommand && !stats) return null;

  const isInstant = lastCommand?.reasoning_path === 'instant';
  const isDeliberated = lastCommand?.reasoning_path === 'deliberated';
  const usedWhisper = lastCommand?.transcription_source === 'whisper' || lastCommand?.audio_transcription_used;
  const confidencePct = Math.round((lastCommand?.confidence || 1.0) * 100);

  return (
    <div className="w-full max-w-md mx-auto px-4 mb-4">
      {lastCommand && (
        <div className="flex flex-col items-center gap-2">
          {/* Stackable Tags Container */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Tag 1: Whisper Careful Listening (if audio upload transcription was used) */}
            {usedWhisper && (
              <div
                id="badge-whisper"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm bg-purple-50 text-purple-700 border border-purple-200 shadow-purple-100/50 transition-all"
              >
                <Headphones className="w-3.5 h-3.5 text-purple-600" />
                <span>🎧 Careful Listening (Whisper Large V3)</span>
              </div>
            )}

            {/* Tag 2: Instant Reflex (System 1) OR Groq Deliberated (System 2) */}
            {isInstant && !usedWhisper && (
              <div
                id="badge-instant"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-emerald-100/50 transition-all"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" />
                <span>⚡ Instant (System 1: Fast Reflex)</span>
              </div>
            )}

            {isDeliberated && (
              <div
                id="badge-groq"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm bg-blue-50 text-blue-700 border border-blue-200 shadow-blue-100/50 transition-all"
              >
                <Brain className="w-3.5 h-3.5 text-blue-500" />
                <span>🧠 Thought it through (Groq LLaMA-3)</span>
              </div>
            )}

            {/* Info Trigger Button */}
            <button
              type="button"
              onClick={() => setShowExplanation(!showExplanation)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-all"
              title="Click to view explanation of the dual-engine architecture"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            {usedWhisper && isDeliberated
              ? `Whisper V3 precision transcription + Groq LLaMA-3 natural language understanding`
              : isInstant
              ? `Local pattern match resolved in <50ms (Confidence: ${confidencePct}%)`
              : `Groq LLaMA-3 conscious reasoning used for ambiguous/multilingual input`}
          </p>

          {showExplanation && (
            <div className="w-full bg-slate-900 text-slate-200 text-xs p-3.5 rounded-2xl mt-2 space-y-2 shadow-md animate-fadeIn text-left">
              <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <span>⚡ Thinking Fast & Slow Architectural Split:</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                <strong>1. Audio Input:</strong> Browser Web Speech API handles quick familiar voice commands instantly (Fast path). Non-English or complex audio cascades to Hugging Face Whisper Large V3 for precision (Careful path).
              </p>
              <p className="text-slate-300 leading-relaxed">
                <strong>2. Language Understanding:</strong> System 1 regex handles 80% of routine actions in sub-50ms ($0 cost). System 2 Groq LLaMA-3 awakens only when deliberation is needed.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Running Stats Bar */}
      {stats && stats.total_commands > 0 && (
        <div className="mt-3 bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-1.5">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-slate-400" /> Architecture Telemetry
            </span>
            <span>{stats.total_commands} total commands</span>
          </div>

          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${stats.instant_pct}%` }}
              title={`System 1: ${stats.instant_pct}%`}
            />
            <div
              className="bg-blue-500 h-full transition-all duration-500"
              style={{ width: `${stats.deliberated_pct}%` }}
              title={`System 2: ${stats.deliberated_pct}%`}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
            <span className="text-emerald-600 font-medium">⚡ Fast: {stats.instant_pct}% ({stats.instant_count})</span>
            <span className="text-blue-600 font-medium">🧠 Slow: {stats.deliberated_pct}% ({stats.deliberated_count})</span>
          </div>
        </div>
      )}
    </div>
  );
};
