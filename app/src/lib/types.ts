export type Quote = {
  symbol: string;
  name: string;
  shortName: string;
  sector: string;
  country: string;
  countryName: string;
  volume: number;
  prevClose: number | null;
  open: number | null;
  close: number;
  change: number;
  changeAbs: number | null;
};

export type IndexQuote = {
  id: string;
  name: string;
  group: 'main' | 'sector' | 'total_return';
  prevClose: number | null;
  close: number;
  change: number;
  ytd: number | null;
};

export type Mover = { symbol: string; shortName: string; close: number; change: number; volume: number };

export type Meta = { updatedAt: string; sessionDate: string; sessionTime: string | null; source: string };

export type Market = Meta & {
  transactionsValue: number | null;
  capitalisationActions: number | null;
  capitalisationBonds: number | null;
  advancing: number;
  declining: number;
  unchanged: number;
  totalVolume: number;
  gainers: Mover[];
  losers: Mover[];
  mostActive: Mover[];
};

export type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  image: string | null;
  source: string;
  category: string;
  premium: boolean;
  publishedAt: string | null;
  symbols: string[];
};

export type HistoryPoint = { d: string; o?: number | null; c: number; v?: number };

export type Feed<T> = { updatedAt: string; items: T[] } & Partial<Meta>;
