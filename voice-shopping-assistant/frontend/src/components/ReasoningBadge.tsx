import React, { useState } from 'react';
import { Zap, Brain, Info, Activity } from 'lucide-react';
import { CommandParseResponse, CommandStats } from '../api/client';

interface ReasoningBadgeProps {
  lastCommand: CommandParseResponse | null;
  stats: CommandStats | null;
}

export const ReasoningBadge: React.FC<ReasoningBadgeProps> = ({ lastCommand, stats }) => {
  const [showExplanation, setShowExplanation] = useState(false);

  if (!lastCommand && !stats) return null;

  const isInstant = lastCommand?.reasoning_path === 'instant';
  const confidencePct = Math.round((lastCommand?.confidence || 1.0) * 100);

  return (
    <div className="w-full max-w-md mx-auto px-4 mb-4">
      {lastCommand && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <div
              id="reasoning-badge-pill"
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm transition-all border ${
                isInstant
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100/50'
                  : 'bg-blue-50 text-blue-700 border-blue-200 shadow-blue-100/50'
              }`}
            >
              {isInstant ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" />
                  <span>⚡ Instant (System 1: Fast Reflex)</span>
                </>
              ) : (
                <>
                  <Brain className="w-3.5 h-3.5 text-blue-500" />
                  <span>🧠 Deliberated (System 2: Conscious LLM)</span>
                </>
              )}
            </div>

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
            {isInstant
              ? `Local pattern match resolved in <50ms (Confidence: ${confidencePct}%)`
              : `Deep language understanding used for ambiguous/multilingual input`}
          </p>

          {showExplanation && (
            <div className="w-full bg-slate-900 text-slate-200 text-xs p-3 rounded-xl mt-2 space-y-1.5 shadow-md animate-fadeIn">
              <div className="font-semibold text-emerald-400 flex items-center gap-1">
                <span>Thinking Fast & Slow Architecture:</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                <strong>System 1 (Local Regex):</strong> Handles familiar phrasing ("add milk", "remove eggs") with sub-50ms latency & $0 API cost.
              </p>
              <p className="text-slate-300 leading-relaxed">
                <strong>System 2 (LLM / NLU):</strong> Awakens only for complex phrasing ("we're out of coffee"), multiple items, or foreign languages.
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

          {/* Progress bar split */}
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
