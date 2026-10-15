import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, QuoteRow, Segmented, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useData } from '@/lib/data-context';
import { fmtSessionDate } from '@/lib/format';
import type { Quote } from '@/lib/types';
import { useTheme } from '@/lib/use-theme';

type Sort = 'symbol' | 'change' | 'volume' | 'value';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'symbol', label: 'A → Z' },
  { key: 'change', label: 'Variation' },
  { key: 'value', label: 'Valeur échangée' },
  { key: 'volume', label: 'Volume' },
];

export default function StocksScreen() {
  const c = useTheme();
  const { quotes, refreshing, refresh } = useData();
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('all');
  const [country, setCountry] = useState('all');
  const [sort, setSort] = useState<Sort>('symbol');
  const [desc, setDesc] = useState(true);

  const sectors = useMemo(() => [...new Set(quotes.items.map((q) => q.sector))].sort(), [quotes]);
  const countries = useMemo(
    () => [...new Map(quotes.items.map((q) => [q.country, q.countryName])).entries()].sort((a, b) => a[1].localeCompare(b[1])),
    [quotes],
  );

  const rows = useMemo(() => {
    const qn = query.trim().toLowerCase();
    const list = quotes.items.filter(
      (q) =>
        (sector === 'all' || q.sector === sector) &&
        (country === 'all' || q.country === country) &&
        (!qn || q.symbol.toLowerCase().includes(qn) || q.name.toLowerCase().includes(qn) || q.shortName.toLowerCase().includes(qn)),
    );
    const key: Record<Sort, (q: Quote) => number | string> = {
      symbol: (q) => q.symbol,
      change: (q) => q.change,
      volume: (q) => q.volume,
      value: (q) => q.volume * q.close,
    };
    const k = key[sort];
    return list.sort((a, b) => {
      const va = k(a), vb = k(b);
      const r = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sort === 'symbol' ? r : desc ? -r : r;
    });
  }, [quotes, query, sector, country, sort, desc]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingHorizontal: Space.lg, paddingTop: Space.md }}>
        <T style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Actions BRVM</T>
        <T muted style={{ fontSize: 13, marginTop: 2 }}>
          {quotes.items.length} valeurs · séance du {fmtSessionDate(quotes.sessionDate)}
        </T>
        <View style={[styles.search, { backgroundColor: c.surfaceAlt }]}>
          <Ionicons name="search" size={16} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Symbole ou nom de société"
            placeholderTextColor={c.textMuted}
            autoCapitalize="characters"
            style={{ flex: 1, color: c.text, fontSize: 15, paddingVertical: 10 }}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={c.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={{ gap: 8, marginBottom: 6 }}>
        <Segmented scroll value={sector} onChange={setSector} options={[{ key: 'all', label: 'Tous secteurs' }, ...sectors.map((s) => ({ key: s, label: s }))]} />
        <Segmented scroll value={country} onChange={setCountry} options={[{ key: 'all', label: 'Tous pays' }, ...countries.map(([k, v]) => ({ key: k, label: v }))]} />
      </View>

      <View style={[styles.sortBar, { borderBottomColor: c.border }]}>
        <T dim style={{ fontSize: 12 }}>Trier :</T>
        {SORTS.map((s) => {
          const on = s.key === sort;
          return (
            <Pressable
              key={s.key}
              onPress={() => (on && s.key !== 'symbol' ? setDesc(!desc) : (setSort(s.key), setDesc(true)))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ color: on ? c.accent : c.textSecondary, fontSize: 12, fontWeight: on ? '700' : '500' }}>{s.label}</Text>
              {on && s.key !== 'symbol' ? <Ionicons name={desc ? 'arrow-down' : 'arrow-up'} size={11} color={c.accent} /> : null}
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(q) => q.symbol}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
        renderItem={({ item: q }) => (
          <QuoteRow id={q.symbol} title={q.symbol} subtitle={`${q.shortName} · ${q.countryName}`} price={q.close} change={q.change} />
        )}
        ListEmptyComponent={<EmptyState icon="search" title="Aucune valeur trouvée" text="Essayez un autre nom ou retirez un filtre." />}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, paddingHorizontal: 12, marginTop: Space.md, marginBottom: Space.md },
  sortBar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Space.lg, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, flexWrap: 'wrap' },
});
