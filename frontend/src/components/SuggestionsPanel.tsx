import React from 'react';
import { Sparkles, Clock, Calendar, RefreshCw, Plus, X } from 'lucide-react';
import type { SuggestionItem, SuggestionsResponse } from '../api/client';

interface SuggestionsPanelProps {
  suggestions: SuggestionsResponse;
  onAccept: (suggestion: SuggestionItem) => void;
  onDismiss: (id: string) => void;
}

export const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({
  suggestions,
  onAccept,
  onDismiss,
}) => {
  const allSuggestions = [
    ...suggestions.running_low,
    ...suggestions.seasonal,
    ...suggestions.substitutes,
  ];

  if (allSuggestions.length === 0) return null;

  return (
    <div className="w-full my-4">
      <div className="flex items-center justify-between px-4 mb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Smart Human-Logic Suggestions ({allSuggestions.length})</span>
        </div>
        <span className="text-[11px] text-slate-400">Pantry decay & seasonal cues</span>
      </div>

      {/* Horizontally Scrollable Cards Container */}
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 pt-1 scrollbar-none snap-x">
        {allSuggestions.map((item) => {
          const isRunningLow = item.type === 'running_low';
          const isSeasonal = item.type === 'seasonal';
          const isSubstitute = item.type === 'substitute';

          return (
            <div
              key={item.id}
              className={`shrink-0 w-64 bg-white rounded-2xl p-3.5 border shadow-sm transition-all duration-200 hover:shadow-md snap-start flex flex-col justify-between ${
                isRunningLow
                  ? 'border-amber-200 bg-gradient-to-b from-amber-50/40 to-white'
                  : isSeasonal
                  ? 'border-emerald-200 bg-gradient-to-b from-emerald-50/40 to-white'
                  : 'border-purple-200 bg-gradient-to-b from-purple-50/40 to-white'
              }`}
            >
              {/* Header Badge & Dismiss */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {isRunningLow && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      <Clock className="w-3 h-3 text-amber-600" />
                      Running Low
                    </span>
                  )}
                  {isSeasonal && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      <Calendar className="w-3 h-3 text-emerald-600" />
                      In Season
                    </span>
                  )}
                  {isSubstitute && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                      <RefreshCw className="w-3 h-3 text-purple-600" />
                      Substitute
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onDismiss(item.id)}
                  aria-label="Dismiss suggestion"
                  className="text-slate-400 hover:text-slate-600 p-1 -mr-1 -mt-1 rounded-full hover:bg-slate-100 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Item Name & Reason */}
              <div className="my-2.5">
                <h4 className="text-sm font-semibold text-slate-900 capitalize">
                  {item.item_name}
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-snug">
                  {item.reason}
                </p>
              </div>

              {/* Depletion Progress Bar for Running Low */}
              {isRunningLow && item.depletion_pct !== undefined && (
                <div className="mb-2.5">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>Pantry Depletion</span>
                    <span className="font-semibold text-amber-600">{item.depletion_pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-amber-100 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, item.depletion_pct)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={() => onAccept(item)}
                className={`w-full py-1.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                  isRunningLow
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200'
                    : isSeasonal
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to List</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
