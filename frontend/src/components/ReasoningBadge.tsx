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
    <div className="w-full max-w-md mx-auto px-2 mb-4">
      {lastCommand && (
        <div className="flex flex-col items-center gap-2">
          {/* Stackable Tags Container */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Tag 1: Whisper Careful Listening */}
            {usedWhisper && (
              <div
                id="badge-whisper"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xs bg-palette-light text-palette-deep border border-palette-soft transition-all"
              >
                <Headphones className="w-3.5 h-3.5 text-palette-primary" />
                <span>🎧 Careful Listening (Whisper V3)</span>
              </div>
            )}

            {/* Tag 2: Instant Reflex (System 1) */}
            {isInstant && !usedWhisper && (
              <div
                id="badge-instant"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xs bg-palette-light text-palette-deep border border-palette-soft transition-all"
              >
                <Zap className="w-3.5 h-3.5 text-palette-primary fill-palette-primary" />
                <span>⚡ Instant Reflex (System 1: &lt;50ms)</span>
              </div>
            )}

            {/* Tag 3: Conscious Thought (System 2 Groq LLM) */}
            {isDeliberated && (
              <div
                id="badge-groq"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xs bg-palette-deep text-white border border-palette-navy shadow-glow-soft transition-all"
              >
                <Brain className="w-3.5 h-3.5 text-palette-soft" />
                <span>🧠 Thought it through (Groq LLM)</span>
              </div>
            )}

            {/* Info Button */}
            <button
              type="button"
              onClick={() => setShowExplanation(!showExplanation)}
              className="text-palette-deep/60 hover:text-palette-primary p-1 rounded-full hover:bg-palette-light/70 transition-all"
              title="Click to view explanation of the dual-engine architecture"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-palette-deep/70 font-medium text-center">
            {usedWhisper && isDeliberated
              ? `Whisper V3 precision audio + Groq LLaMA-3 natural language understanding`
              : isInstant
              ? `Local pattern matched instantly in <50ms ($0 cost • Confidence: ${confidencePct}%)`
              : `Groq LLaMA-3 conscious reasoning used for multi-item / foreign speech`}
          </p>

          {showExplanation && (
            <div className="w-full bg-palette-deep text-white text-xs p-3.5 rounded-2xl mt-1.5 space-y-2 shadow-card-elevated border border-palette-soft/30 animate-fadeIn text-left">
              <div className="font-bold text-palette-soft flex items-center gap-1.5">
                <span>⚡ Thinking Fast & Slow Architecture:</span>
              </div>
              <p className="text-palette-light/90 leading-relaxed">
                <strong>System 1 (Local Regex):</strong> Handles 80% of familiar phrasing instantly with zero network lag and $0 cost.
              </p>
              <p className="text-palette-light/90 leading-relaxed">
                <strong>System 2 (Groq LLM):</strong> Awakens for ambiguity, multiple items in one utterance, or foreign language translation.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Running Stats Bar */}
      {stats && stats.total_commands > 0 && (
        <div className="mt-3 bg-white/90 backdrop-blur-sm border border-palette-light rounded-2xl p-3 shadow-card-elevated">
          <div className="flex items-center justify-between text-[11px] font-bold text-palette-deep mb-2">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-palette-primary" /> Architecture Telemetry
            </span>
            <span className="bg-palette-light text-palette-deep px-2 py-0.5 rounded-full text-[10px]">
              {stats.total_commands} commands
            </span>
          </div>

          <div className="w-full h-2.5 bg-palette-light rounded-full overflow-hidden flex p-0.5">
            <div
              className="bg-palette-primary h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.instant_pct}%` }}
              title={`System 1: ${stats.instant_pct}%`}
            />
            <div
              className="bg-palette-deep h-full rounded-full transition-all duration-500 ml-0.5"
              style={{ width: `${stats.deliberated_pct}%` }}
              title={`System 2: ${stats.deliberated_pct}%`}
            />
          </div>

          <div className="flex justify-between text-[11px] text-palette-deep/80 mt-1.5 font-mono font-medium">
            <span className="text-palette-primary font-bold">⚡ Fast: {stats.instant_pct}% ({stats.instant_count})</span>
            <span className="text-palette-deep font-bold">🧠 Slow: {stats.deliberated_pct}% ({stats.deliberated_count})</span>
          </div>
        </div>
      )}
    </div>
  );
};
