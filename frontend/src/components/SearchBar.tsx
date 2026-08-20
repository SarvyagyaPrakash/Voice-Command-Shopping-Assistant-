import React, { useState, useEffect } from 'react';
import { Search, Filter, X, Plus, Check } from 'lucide-react';
import { api, type ProductResult } from '../api/client';

interface SearchBarProps {
  onAddItem: (name: string, quantity?: number, unit?: string, category?: string) => void;
  externalSearchQuery?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onAddItem, externalSearchQuery }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [results, setResults] = useState<ProductResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  // Listen to external voice search queries triggered from the voice button
  useEffect(() => {
    if (externalSearchQuery) {
      setIsOpen(true);
      setQuery(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  useEffect(() => {
    if (!isOpen) return;

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const resp = await api.searchCatalog({
          q: query || undefined,
          brand: selectedBrand || undefined,
          max_price: selectedMaxPrice || undefined,
          category: selectedCategory || undefined,
        });
        setResults(resp.results);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [query, selectedBrand, selectedMaxPrice, selectedCategory, isOpen]);

  const handleAddProduct = (p: ProductResult) => {
    onAddItem(p.name, 1, p.unit, p.category);
    setAddedIds((prev) => new Set([...prev, p.id]));
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }, 2000);
  };

  const clearFilters = () => {
    setSelectedBrand('');
    setSelectedMaxPrice(null);
    setSelectedCategory('');
  };

  return (
    <div className="w-full px-4 my-3">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl py-2.5 px-4 flex items-center justify-between text-slate-500 shadow-sm transition-all"
        >
          <div className="flex items-center gap-2 text-xs">
            <Search className="w-4 h-4 text-slate-400" />
            <span>Search store catalog & filter by brand/price...</span>
          </div>
          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
            Catalog
          </span>
        </button>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-md space-y-3">
          {/* Header & Close */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-emerald-600" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items, brands, or categories..."
                className="w-full text-xs bg-transparent focus:outline-none text-slate-800"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" />

            {/* Price Chips */}
            <button
              type="button"
              onClick={() => setSelectedMaxPrice(selectedMaxPrice === 5 ? null : 5)}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-all ${
                selectedMaxPrice === 5
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Under $5
            </button>
            <button
              type="button"
              onClick={() => setSelectedMaxPrice(selectedMaxPrice === 10 ? null : 10)}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-all ${
                selectedMaxPrice === 10
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Under $10
            </button>

            {/* Brand Chips */}
            {['Horizon', 'Silk', 'Kerrygold', 'Bounty', 'Oatly'].map((brand) => (
              <button
                key={brand}
                type="button"
                onClick={() => setSelectedBrand(selectedBrand === brand ? '' : brand)}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-all ${
                  selectedBrand === brand
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {brand}
              </button>
            ))}

            {(selectedBrand || selectedMaxPrice !== null || selectedCategory) && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[10px] text-rose-500 hover:underline shrink-0 ml-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Search Results List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 pt-1">
            {isSearching ? (
              <p className="text-center py-4 text-xs text-slate-400 animate-pulse">
                Searching simulated store catalog...
              </p>
            ) : results.length === 0 ? (
              <p className="text-center py-4 text-xs text-slate-400">
                No matching store catalog products found.
              </p>
            ) : (
              results.map((p) => {
                const isAdded = addedIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    className="py-2 flex items-center justify-between gap-2 hover:bg-slate-50 px-1 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-slate-900">{p.name}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                          {p.brand}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700 font-mono font-medium">
                        ${p.price.toFixed(2)}{' '}
                        <span className="text-slate-400 font-normal">/ {p.unit}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddProduct(p)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-all ${
                        isAdded
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
