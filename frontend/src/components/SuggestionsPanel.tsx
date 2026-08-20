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
      <div className="flex items-center justify-between px-3 mb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-palette-deep uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-palette-primary" />
          <span>Smart Suggestions ({allSuggestions.length})</span>
        </div>
        <span className="text-[11px] font-medium text-palette-deep/50">Pantry Decay & Seasonality</span>
      </div>

      {/* Horizontally Scrollable Cards Container */}
      <div className="flex gap-3 overflow-x-auto px-3 pb-2 pt-1 scrollbar-none snap-x">
        {allSuggestions.map((item) => {
          const isRunningLow = item.type === 'running_low';
          const isSeasonal = item.type === 'seasonal';
          const isSubstitute = item.type === 'substitute';

          return (
            <div
              key={item.id}
              className={`shrink-0 w-64 bg-white/95 backdrop-blur-sm rounded-3xl p-4 border shadow-card-elevated transition-all duration-300 hover:shadow-glow-soft snap-start flex flex-col justify-between ${
                isRunningLow
                  ? 'border-palette-soft bg-gradient-to-b from-palette-light/50 to-white'
                  : isSeasonal
                  ? 'border-palette-soft bg-gradient-to-b from-palette-light/30 to-white'
                  : 'border-palette-soft/80 bg-gradient-to-b from-white to-palette-light/20'
              }`}
            >
              {/* Header Badge & Dismiss */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {isRunningLow && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-palette-light text-palette-deep border border-palette-soft/50">
                      <Clock className="w-3 h-3 text-palette-primary" />
                      Running Low
                    </span>
                  )}
                  {isSeasonal && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-palette-light text-palette-deep border border-palette-soft/50">
                      <Calendar className="w-3 h-3 text-palette-primary" />
                      In Season
                    </span>
                  )}
                  {isSubstitute && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-palette-deep text-white shadow-xs">
                      <RefreshCw className="w-3 h-3 text-palette-soft" />
                      Substitute
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onDismiss(item.id)}
                  aria-label="Dismiss suggestion"
                  className="text-palette-deep/40 hover:text-palette-deep p-1 rounded-full hover:bg-palette-light/60 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Item Name & Reason */}
              <div className="my-3">
                <h4 className="text-sm font-extrabold text-palette-deep capitalize">
                  {item.item_name}
                </h4>
                <p className="text-xs text-palette-deep/70 mt-1 leading-snug font-medium">
                  {item.reason}
                </p>
              </div>

              {/* Depletion Progress Bar for Running Low */}
              {isRunningLow && item.depletion_pct !== undefined && (
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] font-semibold text-palette-deep/70 mb-1">
                    <span>Pantry Depletion</span>
                    <span className="font-bold text-palette-primary">{item.depletion_pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-palette-light rounded-full overflow-hidden p-0.5">
                    <div
                      className="bg-palette-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, item.depletion_pct)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={() => onAccept(item)}
                className="w-full py-2 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs bg-palette-deep hover:bg-palette-primary text-white active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 text-palette-soft" />
                <span>Add to List</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
