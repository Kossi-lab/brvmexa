import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/line-chart';
import { Card, ChangeBadge, EmptyState, NewsRow, SectionTitle, Segmented, T, num } from '@/components/ui';
import { Space } from '@/constants/theme';
import { fetchHistory } from '@/lib/api';
import { useData, useWatchlist } from '@/lib/data-context';
import { fmtBig, fmtIndex, fmtPct, fmtPrice, fmtSessionDate, fmtShortDate, fmtSigned } from '@/lib/format';
import type { HistoryPoint } from '@/lib/types';
import { toneColor, useTheme } from '@/lib/use-theme';

type Range = '1S' | '1M' | '3M' | '6M' | '1A' | 'MAX';
const RANGE_DAYS: Record<Range, number> = { '1S': 7, '1M': 31, '3M': 92, '6M': 183, '1A': 366, MAX: 1e6 };

export default function InstrumentScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { quoteBySymbol, indices, quotes, news } = useData();
  const { has, toggle } = useWatchlist();
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [range, setRange] = useState<Range>('3M');
  const [scrub, setScrub] = useState<HistoryPoint | null>(null);

  const stock = quoteBySymbol(id);
  const index = indices.items.find((i) => i.id === id);
  const isIndex = !stock && !!index;

  useEffect(() => {
    let alive = true;
    fetchHistory(id).then(({ data }) => alive && setHistory(data));
    return () => { alive = false; };
  }, [id]);

  // Historique + point de la séance la plus récente (si le fichier d'historique n'est pas encore à jour)
  const series = useMemo(() => {
    const pts = [...(history ?? [])];
    const last = stock ?? index;
    const date = quotes.sessionDate;
    if (last && date && !pts.some((p) => p.d === date)) pts.push({ d: date, c: last.close });
    const cutoff = new Date(Date.now() - RANGE_DAYS[range] * 864e5).toISOString().slice(0, 10);
    return pts.filter((p) => p.d >= cutoff);
  }, [history, stock, index, range, quotes.sessionDate]);

  const related = useMemo(() => (stock ? news.items.filter((n) => n.symbols.includes(stock.symbol)).slice(0, 8) : []), [news, stock]);

  if (!stock && !index) {
    return <EmptyState icon="alert-circle-outline" title="Valeur introuvable" text="Elle n’est peut-être plus cotée." />;
  }

  const price = stock?.close ?? index!.close;
  const change = stock?.change ?? index!.change;
  const prev = stock?.prevClose ?? index!.prevClose;
  const fmt = (v: number | null | undefined) => (isIndex ? fmtIndex(v) : fmtPrice(v));
  const first = series[0];
  const rangeChange = first && series.length > 1 ? ((series[series.length - 1].c - first.c) / first.c) * 100 : null;
  const watched = has(id);

  return (
    <>
      <Stack.Screen
        options={{
          title: stock?.symbol ?? index!.name,
          headerRight: () => (
            <Pressable onPress={() => toggle(id)} hitSlop={10}>
              <Ionicons name={watched ? 'star' : 'star-outline'} size={22} color={watched ? c.gold : c.text} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: Space.lg, paddingTop: 4 }}>
          <T muted style={{ fontSize: 14 }}>{stock ? stock.name : 'Indice BRVM'}</T>
          {stock ? (
            <T dim style={{ fontSize: 12, marginTop: 2 }}>{stock.sector} · {stock.countryName}</T>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12 }}>
            <T style={[num, { fontSize: 34, fontWeight: '800', letterSpacing: -1 }]}>{fmt(scrub?.c ?? price)}</T>
            {!isIndex ? <T muted style={{ fontSize: 15, marginBottom: 6 }}>FCFA</T> : null}
          </View>
          {scrub ? (
            <T muted style={{ fontSize: 14, marginTop: 4 }}>{fmtSessionDate(scrub.d)}</T>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Text style={[num, { color: toneColor(c, change), fontWeight: '700', fontSize: 15 }]}>
                {fmtSigned(prev != null ? price - prev : null, isIndex ? 2 : 0)}
              </Text>
              <ChangeBadge value={change} />
              <T dim style={{ fontSize: 13 }}>{quotes.sessionDate ? `séance du ${fmtShortDate(quotes.sessionDate)}` : null}</T>
            </View>
          )}
        </View>

        <View style={{ marginTop: Space.lg }}>
          {history == null ? <View style={{ height: 220 }} /> : <LineChart points={series} isIndex={isIndex} onScrub={setScrub} />}
        </View>

        <View style={{ paddingHorizontal: Space.lg, marginTop: Space.md, gap: 8 }}>
          <Segmented value={range} onChange={setRange} options={(Object.keys(RANGE_DAYS) as Range[]).map((k) => ({ key: k, label: k }))} />
          {rangeChange != null ? (
            <T dim style={{ fontSize: 12, textAlign: 'center' }}>
              Sur la période : <Text style={{ color: toneColor(c, rangeChange), fontWeight: '700' }}>{fmtPct(rangeChange)}</Text>
            </T>
          ) : null}
        </View>

        <SectionTitle title="Données de la séance" />
        <Card style={{ marginHorizontal: Space.lg }}>
          {stock ? (
            <>
              <Grid items={[
                ['Ouverture', fmtPrice(stock.open)],
                ['Clôture veille', fmtPrice(stock.prevClose)],
              ]} />
              <Grid items={[
                ['Volume (titres)', fmtPrice(stock.volume)],
                ['Valeur échangée', `${fmtBig(stock.volume * stock.close)} F`],
              ]} />
              <Grid last items={[
                ['Plus haut (période)', fmtPrice(series.length ? Math.max(...series.map((p) => p.c)) : null)],
                ['Plus bas (période)', fmtPrice(series.length ? Math.min(...series.map((p) => p.c)) : null)],
              ]} />
            </>
          ) : (
            <>
              <Grid items={[
                ['Clôture veille', fmtIndex(index!.prevClose)],
                ['Clôture', fmtIndex(index!.close)],
              ]} />
              <Grid last items={[
                ['Variation du jour', fmtPct(index!.change)],
                ['Depuis le 1er janvier', fmtPct(index!.ytd)],
              ]} />
            </>
          )}
        </Card>

        {stock ? (
          <>
            <SectionTitle title={`Actualités ${stock.symbol}`} />
            {related.length ? (
              related.map((n) => <NewsRow key={n.id} item={n} compact />)
            ) : (
              <T muted style={{ paddingHorizontal: Space.lg, fontSize: 14 }}>Aucun article récent ne cite cette société.</T>
            )}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

function Grid({ items, last }: { items: [string, string][]; last?: boolean }) {
  const c = useTheme();
  return (
    <View style={[styles.grid, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      {items.map(([k, v]) => (
        <View key={k} style={{ flex: 1 }}>
          <T dim style={{ fontSize: 12 }}>{k}</T>
          <T style={[num, { fontWeight: '700', marginTop: 3 }]}>{v}</T>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', paddingHorizontal: Space.lg, paddingVertical: 14, gap: 12 },
});
