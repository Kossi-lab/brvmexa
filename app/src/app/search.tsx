import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, QuoteRow } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useData, useWatchlist } from '@/lib/data-context';
import { useTheme } from '@/lib/use-theme';

/** Recherche globale : actions et indices, avec ajout rapide à la liste de suivi */
export default function SearchScreen() {
  const c = useTheme();
  const { quotes, indices } = useData();
  const { has, toggle } = useWatchlist();
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    const stocks = quotes.items.map((s) => ({ id: s.symbol, title: s.symbol, subtitle: s.shortName, price: s.close, change: s.change, isIndex: false, hay: `${s.symbol} ${s.name} ${s.shortName}`.toLowerCase() }));
    const idx = indices.items.map((i) => ({ id: i.id, title: i.name, subtitle: 'Indice', price: i.close, change: i.change, isIndex: true, hay: i.name.toLowerCase() }));
    const all = [...idx.filter((i) => !n), ...stocks, ...idx.filter(() => !!n)];
    return n ? all.filter((r) => r.hay.includes(n)) : all;
  }, [q, quotes, indices]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={styles.top}>
        <View style={[styles.input, { backgroundColor: c.surfaceAlt }]}>
          <Ionicons name="search" size={16} color={c.textMuted} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder="Rechercher une action ou un indice"
            placeholderTextColor={c.textMuted}
            style={{ flex: 1, color: c.text, fontSize: 16, paddingVertical: 10 }}
          />
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={c.text} />
        </Pressable>
      </View>
      <FlatList
        data={results}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: { hay, ...r } }) => (
          <QuoteRow
            {...r}
            right={
              <Pressable onPress={() => toggle(r.id)} hitSlop={10} style={{ marginLeft: 14 }}>
                <Ionicons name={has(r.id) ? 'star' : 'star-outline'} size={22} color={has(r.id) ? c.gold : c.textMuted} />
              </Pressable>
            }
          />
        )}
        ListEmptyComponent={<EmptyState icon="search" title="Aucun résultat" />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Space.lg },
  input: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, paddingHorizontal: 12 },
});
