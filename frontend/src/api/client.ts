const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8008';

export interface ShoppingItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string | null;
  added_at: string;
  estimated_depletion: string | null;
  status: 'active' | 'purchased' | 'removed';
  depletion_pct?: number;
  days_remaining?: number;
  is_running_low?: boolean;
}

export interface CommandParseResponse {
  success: boolean;
  transcript: string;
  intent: 'ADD' | 'REMOVE' | 'SEARCH' | 'UNKNOWN';
  reasoning_path: 'instant' | 'deliberated';
  confidence: number;
  transcription_source?: 'web_speech' | 'whisper' | string;
  audio_transcription_used?: boolean;
  items: Array<{ name: string; quantity: number; unit: string | null }>;
  brand: string | null;
  price_filter: { max_price: number | null; min_price: number | null } | null;
  language_detected: string;
  action_summary: string;
  mutated_items: ShoppingItem[];
}

export interface SuggestionItem {
  id: string;
  type: 'running_low' | 'seasonal' | 'substitute';
  item_name: string;
  category: string;
  reason: string;
  days_ago?: number;
  depletion_pct?: number;
  for_item?: string;
}

export interface SuggestionsResponse {
  running_low: SuggestionItem[];
  seasonal: SuggestionItem[];
  substitutes: SuggestionItem[];
  total_count: number;
}

export interface ProductResult {
  id: number;
  name: string;
  brand: string;
  category: string;
  price: number;
  unit: string;
}

export interface SearchResponse {
  query?: string;
  filters: { brand?: string; min_price?: number; max_price?: number; category?: string };
  count: number;
  results: ProductResult[];
}

export interface CommandStats {
  total_commands: number;
  instant_count: number;
  deliberated_count: number;
  instant_pct: number;
  deliberated_pct: number;
  recent_logs: Array<{
    id: number;
    transcript: string;
    resolved_intent: string;
    reasoning_path: string;
    confidence: number;
    timestamp: string;
  }>;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      let errorMessage = `Request failed (${res.status})`;
      try {
        const errorJson = await res.json();
        errorMessage = errorJson.error || errorMessage;
      } catch {
        // Fallback
      }
      throw new Error(errorMessage);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error("Couldn't reach the server — check your connection or start the backend");
    }
    throw err;
  }
}

export const api = {
  parseCommand: (transcript: string, language: string = 'en', transcriptionSource: string = 'web_speech') =>
    request<CommandParseResponse>('/api/commands/parse', {
      method: 'POST',
      body: JSON.stringify({ transcript, language, transcription_source: transcriptionSource }),
    }),

  transcribeAudio: async (audioBlob: Blob, language: string = 'en'): Promise<CommandParseResponse> => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('language', language);

    try {
      const res = await fetch(`${API_BASE}/api/commands/transcribe-audio`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let errorMessage = `Transcription failed (${res.status})`;
        try {
          const errorJson = await res.json();
          errorMessage = errorJson.error || errorMessage;
        } catch {
          // fallback
        }
        throw new Error(errorMessage);
      }

      return (await res.json()) as CommandParseResponse;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error("Couldn't reach the server — check your connection or start the backend");
      }
      throw err;
    }
  },

  getItems: (statusFilter: string = 'active') =>
    request<ShoppingItem[]>(`/api/items?status_filter=${statusFilter}`),

  createItem: (data: { name: string; quantity?: number; unit?: string; category?: string }) =>
    request<ShoppingItem>('/api/items', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateItem: (id: number, updates: Partial<ShoppingItem>) =>
    request<ShoppingItem>(`/api/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteItem: (id: number) =>
    request<{ success: boolean; message: string }>(`/api/items/${id}`, {
      method: 'DELETE',
    }),

  getSuggestions: () => request<SuggestionsResponse>('/api/suggestions'),

  searchCatalog: (params: { q?: string; brand?: string; min_price?: number; max_price?: number; category?: string }) => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.append('q', params.q);
    if (params.brand) searchParams.append('brand', params.brand);
    if (params.min_price !== undefined) searchParams.append('min_price', params.min_price.toString());
    if (params.max_price !== undefined) searchParams.append('max_price', params.max_price.toString());
    if (params.category) searchParams.append('category', params.category);
    return request<SearchResponse>(`/api/items/search?${searchParams.toString()}`);
  },

  getStats: () => request<CommandStats>('/api/commands/stats'),
};
