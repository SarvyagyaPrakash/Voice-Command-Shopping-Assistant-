import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import type { ShoppingItem } from '../api/client';

interface ShoppingListProps {
  items: ShoppingItem[];
  isLoading: boolean;
  onQuantityChange: (id: number, delta: number) => void;
  onCategoryChange: (id: number, newCategory: string) => void;
  onRemoveItem: (id: number) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  produce: '🥦',
  dairy: '🧀',
  bakery: '🥖',
  meat: '🥩',
  beverages: '🧃',
  snacks: '🍿',
  pantry: '🌾',
  household: '🧼',
  other: '📦',
};

const CATEGORIES = [
  'produce',
  'dairy',
  'bakery',
  'meat',
  'beverages',
  'snacks',
  'pantry',
  'household',
  'other',
];

export const ShoppingList: React.FC<ShoppingListProps> = ({
  items,
  isLoading,
  onQuantityChange,
  onCategoryChange,
  onRemoveItem,
}) => {
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  // Group items by category
  const groupedItems = items.reduce<Record<string, ShoppingItem[]>>((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryKeys = Object.keys(groupedItems).sort();

  // Loading skeleton state
  if (isLoading && items.length === 0) {
    return (
      <div className="w-full px-4 space-y-3 my-4">
        {[1, 2, 3].map((n) => (
          <div key={n} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-10 bg-slate-100 rounded-xl" />
            <div className="h-10 bg-slate-100 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="w-full max-w-md mx-auto my-8 px-4 text-center">
        <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-8 shadow-sm flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 text-2xl">
            🛒
          </div>
          <h3 className="text-base font-semibold text-slate-800">Your shopping list is empty</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            Try clicking the mic and saying <span className="font-semibold text-emerald-600">"add 2 bottles of milk"</span> or typing a command above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 space-y-4 my-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
          <span>Shopping List ({items.length} {items.length === 1 ? 'item' : 'items'})</span>
        </h3>
        <span className="text-[11px] text-slate-400">Tracked with Pantry Decay</span>
      </div>

      {categoryKeys.map((cat) => {
        const catItems = groupedItems[cat];
        const isCollapsed = !!collapsedCategories[cat];
        const icon = CATEGORY_ICONS[cat] || '📦';

        return (
          <div
            key={cat}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all"
          >
            {/* Category Header */}
            <button
              type="button"
              onClick={() => toggleCategory(cat)}
              className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-100/70 flex items-center justify-between text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{icon}</span>
                <span className="text-sm font-semibold capitalize text-slate-800">
                  {cat}
                </span>
                <span className="text-[11px] font-medium bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded-full">
                  {catItems.length}
                </span>
              </div>
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Category Items */}
            {!isCollapsed && (
              <div className="divide-y divide-slate-100">
                {catItems.map((item) => {
                  const depletionPct = item.depletion_pct ?? 0;
                  const isNearDepletion = item.is_running_low;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Left: Item Info & Depletion Progress */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-slate-900 truncate">
                            {item.name}
                          </h4>
                          {item.unit && (
                            <span className="text-[11px] text-slate-400 font-normal">
                              ({item.unit})
                            </span>
                          )}
                          {isNearDepletion && (
                            <span className="text-[10px] bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.2 rounded font-semibold">
                              Low
                            </span>
                          )}
                        </div>

                        {/* Pantry Decay Progress Bar */}
                        <div className="mt-1.5 flex items-center gap-2 max-w-xs">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                depletionPct >= 80
                                  ? 'bg-rose-500'
                                  : depletionPct >= 50
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                              }`}
                              style={{ width: `${Math.min(100, depletionPct)}%` }}
                              title={`Pantry Decay: ${depletionPct}% elapsed`}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {item.days_remaining !== undefined ? `${item.days_remaining}d left` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Right: Quantity Stepper & Actions */}
                      <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                        {/* Category Selector Dropdown */}
                        <select
                          value={item.category}
                          onChange={(e) => onCategoryChange(item.id, e.target.value)}
                          className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c.charAt(0).toUpperCase() + c.slice(1)}
                            </option>
                          ))}
                        </select>

                        {/* Stepper (+ / -) */}
                        <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                          <button
                            type="button"
                            onClick={() => onQuantityChange(item.id, -1)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white shadow-xs hover:bg-slate-50 text-slate-600 active:scale-95 transition-all"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center text-xs font-semibold text-slate-800">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onQuantityChange(item.id, 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white shadow-xs hover:bg-slate-50 text-slate-600 active:scale-95 transition-all"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Remove Action */}
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all"
                          aria-label={`Remove ${item.name}`}
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
