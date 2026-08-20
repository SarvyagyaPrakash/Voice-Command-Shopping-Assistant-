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
      <div className="w-full px-2 space-y-3 my-4">
        {[1, 2, 3].map((n) => (
          <div key={n} className="bg-white/80 rounded-3xl p-4 border border-palette-light shadow-card-elevated animate-pulse space-y-3">
            <div className="h-4 bg-palette-light rounded-md w-1/3" />
            <div className="h-10 bg-palette-light/50 rounded-2xl" />
            <div className="h-10 bg-palette-light/50 rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="w-full max-w-md mx-auto my-6 px-2 text-center animate-fadeIn">
        <div className="bg-white/80 backdrop-blur-sm border border-dashed border-palette-soft rounded-3xl p-8 shadow-card-elevated flex flex-col items-center">
          <div className="w-16 h-16 rounded-3xl bg-palette-light text-palette-primary flex items-center justify-center mb-3.5 text-3xl shadow-xs">
            🛒
          </div>
          <h3 className="text-base font-extrabold text-palette-deep">Your shopping list is empty</h3>
          <p className="text-xs text-palette-deep/70 mt-1.5 max-w-xs leading-relaxed font-medium">
            Tap the mic button and say <span className="font-bold text-palette-primary">"add 2 bottles of milk"</span> or type a command above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-2 space-y-3.5 my-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold text-palette-deep uppercase tracking-wider flex items-center gap-1.5">
          <ShoppingBag className="w-3.5 h-3.5 text-palette-primary" />
          <span>Shopping List ({items.length} {items.length === 1 ? 'item' : 'items'})</span>
        </h3>
        <span className="text-[11px] font-medium text-palette-deep/50">Tracked with Pantry Decay</span>
      </div>

      {categoryKeys.map((cat) => {
        const catItems = groupedItems[cat];
        const isCollapsed = !!collapsedCategories[cat];
        const icon = CATEGORY_ICONS[cat] || '📦';

        return (
          <div
            key={cat}
            className="bg-white/95 backdrop-blur-sm rounded-3xl border border-palette-light shadow-card-elevated overflow-hidden transition-all duration-200 hover:border-palette-soft"
          >
            {/* Category Header */}
            <button
              type="button"
              onClick={() => toggleCategory(cat)}
              className="w-full px-4 py-3.5 bg-palette-light/30 hover:bg-palette-light/60 flex items-center justify-between text-left transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg drop-shadow-xs">{icon}</span>
                <span className="text-sm font-extrabold capitalize text-palette-deep">
                  {cat}
                </span>
                <span className="text-[10px] font-extrabold bg-palette-light text-palette-deep border border-palette-soft/50 px-2.5 py-0.5 rounded-full">
                  {catItems.length}
                </span>
              </div>
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-palette-deep/50" />
              ) : (
                <ChevronDown className="w-4 h-4 text-palette-deep/50" />
              )}
            </button>

            {/* Category Items */}
            {!isCollapsed && (
              <div className="divide-y divide-palette-light/40">
                {catItems.map((item) => {
                  const depletionPct = item.depletion_pct ?? 0;
                  const isNearDepletion = item.is_running_low;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-palette-light/20 transition-colors"
                    >
                      {/* Left: Item Info & Depletion Progress */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-palette-deep truncate">
                            {item.name}
                          </h4>
                          {item.unit && (
                            <span className="text-[11px] text-palette-deep/50 font-normal">
                              ({item.unit})
                            </span>
                          )}
                          {isNearDepletion && (
                            <span className="text-[10px] bg-palette-light text-palette-primary border border-palette-soft px-2 py-0.5 rounded-full font-bold">
                              Low
                            </span>
                          )}
                        </div>

                        {/* Pantry Decay Progress Bar */}
                        <div className="mt-2 flex items-center gap-2 max-w-xs">
                          <div className="flex-1 h-1.5 bg-palette-light rounded-full overflow-hidden p-0.5">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                depletionPct >= 80
                                  ? 'bg-palette-deep'
                                  : depletionPct >= 50
                                  ? 'bg-palette-primary'
                                  : 'bg-palette-soft'
                              }`}
                              style={{ width: `${Math.min(100, depletionPct)}%` }}
                              title={`Pantry Decay: ${depletionPct}% elapsed`}
                            />
                          </div>
                          <span className="text-[10px] text-palette-deep/60 shrink-0 font-mono font-medium">
                            {item.days_remaining !== undefined ? `${item.days_remaining}d left` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Right: Quantity Stepper & Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {/* Category Selector Dropdown */}
                        <select
                          value={item.category}
                          onChange={(e) => onCategoryChange(item.id, e.target.value)}
                          className="text-[11px] font-semibold bg-palette-light/40 border border-palette-light rounded-xl px-2.5 py-1.5 text-palette-deep focus:outline-none focus:ring-2 focus:ring-palette-primary"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c.charAt(0).toUpperCase() + c.slice(1)}
                            </option>
                          ))}
                        </select>

                        {/* Stepper (+ / -) */}
                        <div className="flex items-center bg-palette-light/70 rounded-2xl p-0.5 border border-palette-light">
                          <button
                            type="button"
                            onClick={() => onQuantityChange(item.id, -1)}
                            className="w-7 h-7 flex items-center justify-center rounded-xl bg-white shadow-xs hover:bg-palette-light text-palette-deep active:scale-95 transition-all font-bold"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center text-xs font-extrabold text-palette-deep">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onQuantityChange(item.id, 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-xl bg-white shadow-xs hover:bg-palette-light text-palette-deep active:scale-95 transition-all font-bold"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Remove Action */}
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.id)}
                          className="text-palette-deep/40 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition-all"
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
