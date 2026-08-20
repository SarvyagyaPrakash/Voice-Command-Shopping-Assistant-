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
    <div className="w-full px-2 my-3">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full bg-white/90 hover:bg-white border border-palette-light hover:border-palette-soft rounded-3xl py-3 px-4 flex items-center justify-between text-palette-deep/70 shadow-card-elevated transition-all group"
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <Search className="w-4 h-4 text-palette-primary group-hover:scale-110 transition-transform" />
            <span>Search store catalog & filter by brand/price...</span>
          </div>
          <span className="text-[10px] font-extrabold bg-palette-light text-palette-deep border border-palette-soft/50 px-2.5 py-0.5 rounded-full">
            Catalog
          </span>
        </button>
      ) : (
        <div className="bg-white/95 backdrop-blur-sm border border-palette-soft rounded-3xl p-4 shadow-card-elevated space-y-3.5 animate-fadeIn">
          {/* Header & Close */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 flex-1">
              <Search className="w-4 h-4 text-palette-primary shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items, brands, or categories..."
                className="w-full text-xs font-semibold bg-transparent focus:outline-none text-palette-deep placeholder:text-palette-deep/40"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-palette-deep/40 hover:text-palette-deep p-1.5 rounded-full hover:bg-palette-light/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <Filter className="w-3.5 h-3.5 text-palette-primary shrink-0 mr-1" />

            {/* Price Chips */}
            <button
              type="button"
              onClick={() => setSelectedMaxPrice(selectedMaxPrice === 5 ? null : 5)}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-bold transition-all ${
                selectedMaxPrice === 5
                  ? 'bg-palette-deep text-white shadow-xs'
                  : 'bg-palette-light text-palette-deep border border-palette-soft/40 hover:bg-palette-soft/40'
              }`}
            >
              Under $5
            </button>
            <button
              type="button"
              onClick={() => setSelectedMaxPrice(selectedMaxPrice === 10 ? null : 10)}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-bold transition-all ${
                selectedMaxPrice === 10
                  ? 'bg-palette-deep text-white shadow-xs'
                  : 'bg-palette-light text-palette-deep border border-palette-soft/40 hover:bg-palette-soft/40'
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
                className={`px-3 py-1 rounded-full whitespace-nowrap font-bold transition-all ${
                  selectedBrand === brand
                    ? 'bg-palette-primary text-white shadow-xs'
                    : 'bg-palette-light text-palette-deep border border-palette-soft/40 hover:bg-palette-soft/40'
                }`}
              >
                {brand}
              </button>
            ))}

            {(selectedBrand || selectedMaxPrice !== null || selectedCategory) && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[10px] font-bold text-rose-600 hover:underline shrink-0 ml-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Search Results List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-palette-light/50 pt-1">
            {isSearching ? (
              <p className="text-center py-4 text-xs font-semibold text-palette-primary animate-pulse">
                Searching store catalog...
              </p>
            ) : results.length === 0 ? (
              <p className="text-center py-4 text-xs font-medium text-palette-deep/50">
                No matching store catalog products found.
              </p>
            ) : (
              results.map((p) => {
                const isAdded = addedIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    className="py-2.5 flex items-center justify-between gap-2 hover:bg-palette-light/30 px-2 rounded-2xl transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-palette-deep">{p.name}</span>
                        <span className="text-[10px] font-bold bg-palette-light text-palette-deep px-2 py-0.5 rounded-full border border-palette-soft/40">
                          {p.brand}
                        </span>
                      </div>
                      <p className="text-[11px] text-palette-primary font-mono font-bold mt-0.5">
                        ${p.price.toFixed(2)}{' '}
                        <span className="text-palette-deep/50 font-normal">/ {p.unit}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddProduct(p)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all active:scale-95 ${
                        isAdded
                          ? 'bg-palette-light text-palette-deep border border-palette-soft'
                          : 'bg-palette-deep hover:bg-palette-primary text-white shadow-xs'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-palette-primary" />
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
