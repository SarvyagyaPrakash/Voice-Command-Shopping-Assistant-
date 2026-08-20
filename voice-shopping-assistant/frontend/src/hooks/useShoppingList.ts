import { useState, useEffect, useCallback } from 'react';
import { api, ShoppingItem, SuggestionItem, SuggestionsResponse, CommandParseResponse, CommandStats } from '../api/client';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

export function useShoppingList() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionsResponse>({
    running_low: [],
    seasonal: [],
    substitutes: [],
    total_count: 0,
  });
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<Set<string>>(new Set());
  const [lastCommand, setLastCommand] = useState<CommandParseResponse | null>(null);
  const [stats, setStats] = useState<CommandStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToast({ id, type, text });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 4500);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [itemsData, suggestionsData, statsData] = await Promise.all([
        api.getItems('active'),
        api.getSuggestions(),
        api.getStats().catch(() => null),
      ]);
      setItems(itemsData);
      setSuggestions(suggestionsData);
      if (statsData) setStats(statsData);
    } catch (err: any) {
      showToast(err.message || 'Failed to load shopping list', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Execute Voice or Text Command
  const executeCommand = useCallback(
    async (transcript: string, language: string = 'en') => {
      if (!transcript.trim()) return;
      setIsParsing(true);
      try {
        const result = await api.parseCommand(transcript, language);
        setLastCommand(result);

        if (result.action_summary) {
          showToast(result.action_summary, 'success');
        }

        // Refresh items and suggestions
        await loadData();
        return result;
      } catch (err: any) {
        showToast(err.message || 'Failed to process command', 'error');
        throw err;
      } finally {
        setIsParsing(false);
      }
    },
    [loadData, showToast]
  );

  // Manual Add Item
  const addItem = useCallback(
    async (name: string, quantity: number = 1, unit?: string, category?: string) => {
      try {
        await api.createItem({ name, quantity, unit, category });
        showToast(`Added ${quantity}x ${name}`, 'success');
        await loadData();
      } catch (err: any) {
        showToast(err.message || 'Failed to add item', 'error');
      }
    },
    [loadData, showToast]
  );

  // Change Quantity (+ / -)
  const changeQuantity = useCallback(
    async (id: number, delta: number) => {
      const current = items.find((i) => i.id === id);
      if (!current) return;

      const newQty = current.quantity + delta;
      if (newQty <= 0) {
        // Remove if goes to 0
        await removeItem(id);
        return;
      }

      try {
        // Optimistic UI update
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, quantity: newQty } : item))
        );
        await api.updateItem(id, { quantity: newQty });
      } catch (err: any) {
        showToast(err.message || 'Failed to update quantity', 'error');
        await loadData();
      }
    },
    [items, loadData, showToast]
  );

  // Update Category Override
  const changeCategory = useCallback(
    async (id: number, newCategory: string) => {
      try {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, category: newCategory } : item))
        );
        await api.updateItem(id, { category: newCategory });
        showToast('Category updated', 'info');
      } catch (err: any) {
        showToast(err.message || 'Failed to update category', 'error');
        await loadData();
      }
    },
    [loadData, showToast]
  );

  // Remove Item
  const removeItem = useCallback(
    async (id: number) => {
      const target = items.find((i) => i.id === id);
      try {
        setItems((prev) => prev.filter((i) => i.id !== id));
        await api.deleteItem(id);
        if (target) showToast(`Removed ${target.name}`, 'info');
      } catch (err: any) {
        showToast(err.message || 'Failed to remove item', 'error');
        await loadData();
      }
    },
    [items, loadData, showToast]
  );

  // Accept Suggestion
  const acceptSuggestion = useCallback(
    async (suggestion: SuggestionItem) => {
      try {
        await api.createItem({
          name: suggestion.item_name,
          quantity: 1,
          category: suggestion.category,
        });
        showToast(`Added ${suggestion.item_name} from suggestions`, 'success');
        setDismissedSuggestionIds((prev) => new Set([...prev, suggestion.id]));
        await loadData();
      } catch (err: any) {
        showToast(err.message || 'Failed to accept suggestion', 'error');
      }
    },
    [loadData, showToast]
  );

  // Dismiss Suggestion
  const dismissSuggestion = useCallback((id: string) => {
    setDismissedSuggestionIds((prev) => new Set([...prev, id]));
  }, []);

  // Filtered visible suggestions
  const visibleRunningLow = suggestions.running_low.filter((s) => !dismissedSuggestionIds.has(s.id));
  const visibleSeasonal = suggestions.seasonal.filter((s) => !dismissedSuggestionIds.has(s.id));
  const visibleSubstitutes = suggestions.substitutes.filter((s) => !dismissedSuggestionIds.has(s.id));

  return {
    items,
    suggestions: {
      running_low: visibleRunningLow,
      seasonal: visibleSeasonal,
      substitutes: visibleSubstitutes,
      total_count: visibleRunningLow.length + visibleSeasonal.length + visibleSubstitutes.length,
    },
    lastCommand,
    stats,
    isLoading,
    isParsing,
    toast,
    setToast,
    executeCommand,
    addItem,
    changeQuantity,
    changeCategory,
    removeItem,
    acceptSuggestion,
    dismissSuggestion,
    refreshData: loadData,
  };
}
