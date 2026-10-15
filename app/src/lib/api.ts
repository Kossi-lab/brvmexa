import AsyncStorage from '@react-native-async-storage/async-storage';

import { DATA_BASE_URL } from './config';
import type { Feed, HistoryPoint, IndexQuote, Market, NewsItem, Quote } from './types';

import seedIndices from '@/data/seed/indices.json';
import seedMarket from '@/data/seed/market.json';
import seedNews from '@/data/seed/news.json';
import seedQuotes from '@/data/seed/quotes.json';

const CACHE_PREFIX = 'brvmexa:cache:';

/**
 * Télécharge un fichier JSON publié par le robot.
 * En cas d'échec (hors ligne…), renvoie la dernière version mise en cache, puis les données intégrées.
 */
async function getJson<T>(name: string, fallback: T): Promise<{ data: T; fromNetwork: boolean }> {
  const key = CACHE_PREFIX + name;
  try {
    // Le paramètre « t » contourne le cache des CDN (5 minutes sur raw.githubusercontent.com)
    const res = await fetch(`${DATA_BASE_URL}/${name}?t=${Math.floor(Date.now() / 60000)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as T;
    AsyncStorage.setItem(key, JSON.stringify(data)).catch(() => {});
    return { data, fromNetwork: true };
  } catch {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) return { data: JSON.parse(cached) as T, fromNetwork: false };
    } catch {}
    return { data: fallback, fromNetwork: false };
  }
}

export async function cachedOnly<T>(name: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + name);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const fetchQuotes = () => getJson<Feed<Quote>>('quotes.json', seedQuotes as Feed<Quote>);
export const fetchIndices = () => getJson<Feed<IndexQuote>>('indices.json', seedIndices as Feed<IndexQuote>);
export const fetchMarket = () => getJson<Market>('market.json', seedMarket as Market);
export const fetchNews = () => getJson<Feed<NewsItem>>('news.json', seedNews as Feed<NewsItem>);
export const fetchHistory = (id: string) => getJson<HistoryPoint[]>(`history/${id}.json`, []);

export const SEED = {
  quotes: seedQuotes as Feed<Quote>,
  indices: seedIndices as Feed<IndexQuote>,
  market: seedMarket as Market,
  news: seedNews as Feed<NewsItem>,
};
