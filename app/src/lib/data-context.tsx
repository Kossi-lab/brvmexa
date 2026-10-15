import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { cachedOnly, fetchIndices, fetchMarket, fetchNews, fetchQuotes, SEED } from './api';
import { AUTO_REFRESH_MS } from './config';
import type { Feed, IndexQuote, Market, NewsItem, Quote } from './types';

type DataState = {
  quotes: Feed<Quote>;
  indices: Feed<IndexQuote>;
  market: Market;
  news: Feed<NewsItem>;
  online: boolean;
  refreshing: boolean;
  lastSync: number | null;
  refresh: () => Promise<void>;
  quoteBySymbol: (s: string) => Quote | undefined;
};

const DataContext = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState(SEED.quotes);
  const [indices, setIndices] = useState(SEED.indices);
  const [market, setMarket] = useState(SEED.market);
  const [news, setNews] = useState(SEED.news);
  const [online, setOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const [q, i, m, n] = await Promise.all([fetchQuotes(), fetchIndices(), fetchMarket(), fetchNews()]);
      setQuotes(q.data);
      setIndices(i.data);
      setMarket(m.data);
      setNews(n.data);
      const ok = q.fromNetwork || n.fromNetwork;
      setOnline(ok);
      if (ok) setLastSync(Date.now());
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, []);

  // Démarrage : affiche d'abord le cache local, puis interroge le réseau
  useEffect(() => {
    (async () => {
      const [q, i, m, n] = await Promise.all([
        cachedOnly<Feed<Quote>>('quotes.json'),
        cachedOnly<Feed<IndexQuote>>('indices.json'),
        cachedOnly<Market>('market.json'),
        cachedOnly<Feed<NewsItem>>('news.json'),
      ]);
      if (q) setQuotes(q);
      if (i) setIndices(i);
      if (m) setMarket(m);
      if (n) setNews(n);
      refresh();
    })();
  }, [refresh]);

  // Rafraîchit toutes les 5 minutes et à chaque retour au premier plan
  useEffect(() => {
    const timer = setInterval(refresh, AUTO_REFRESH_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  const bySymbol = useMemo(() => new Map(quotes.items.map((q) => [q.symbol, q])), [quotes]);

  const value = useMemo<DataState>(
    () => ({
      quotes, indices, market, news, online, refreshing, lastSync, refresh,
      quoteBySymbol: (s) => bySymbol.get(s),
    }),
    [quotes, indices, market, news, online, refreshing, lastSync, refresh, bySymbol],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>');
  return ctx;
}

// ───────────────────────────── Liste de suivi ─────────────────────────────
const WATCH_KEY = 'brvmexa:watchlist';
const DEFAULT_WATCH = ['SNTS', 'ORAC', 'SGBC', 'brvm-composite'];

type WatchState = { ids: string[]; has: (id: string) => boolean; toggle: (id: string) => void; move: (id: string, dir: -1 | 1) => void };
const WatchContext = createContext<WatchState | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(DEFAULT_WATCH);

  useEffect(() => {
    AsyncStorage.getItem(WATCH_KEY)
      .then((raw) => raw && setIds(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const save = useCallback((next: string[]) => {
    setIds(next);
    AsyncStorage.setItem(WATCH_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const value = useMemo<WatchState>(
    () => ({
      ids,
      has: (id) => ids.includes(id),
      toggle: (id) => save(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]),
      move: (id, dir) => {
        const i = ids.indexOf(id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= ids.length) return;
        const next = [...ids];
        [next[i], next[j]] = [next[j], next[i]];
        save(next);
      },
    }),
    [ids, save],
  );

  return <WatchContext.Provider value={value}>{children}</WatchContext.Provider>;
}

export function useWatchlist() {
  const ctx = useContext(WatchContext);
  if (!ctx) throw new Error('useWatchlist doit être utilisé dans <WatchlistProvider>');
  return ctx;
}
