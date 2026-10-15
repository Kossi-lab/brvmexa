import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, QuoteRow, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useData, useWatchlist } from '@/lib/data-context';
import { useTheme } from '@/lib/use-theme';

export default function WatchlistScreen() {
  const c = useTheme();
  const { quoteBySymbol, indices, refreshing, refresh } = useData();
  const { ids, toggle, move } = useWatchlist();
  const [editing, setEditing] = useState(false);

  const rows = ids
    .map((id) => {
      const q = quoteBySymbol(id);
      if (q) return { id, title: q.symbol, subtitle: q.shortName, price: q.close, change: q.change, isIndex: false };
      const ix = indices.items.find((i) => i.id === id);
      if (ix) return { id, title: ix.name, subtitle: 'Indice', price: ix.close, change: ix.change, isIndex: true };
      return null;
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.lg, paddingTop: Space.md, paddingBottom: Space.md }}>
        <View>
          <T style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Ma liste</T>
          <T muted style={{ fontSize: 13, marginTop: 2 }}>{rows.length} valeur{rows.length > 1 ? 's' : ''} suivie{rows.length > 1 ? 's' : ''}</T>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {rows.length ? (
            <Pressable onPress={() => setEditing(!editing)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: c.surfaceAlt }}>
              <Text style={{ color: c.text, fontWeight: '600' }}>{editing ? 'Terminé' : 'Modifier'}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.push('/search')} style={{ width: 38, height: 38, borderRadius: Radius.pill, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={22} color="#0A0F1A" />
          </Pressable>
        </View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}>
        {rows.length === 0 ? (
          <EmptyState icon="star-outline" title="Votre liste est vide" text="Touchez + pour suivre une action ou un indice. Vous pouvez aussi toucher l’étoile sur la fiche d’une valeur." />
        ) : (
          rows.map((r, i) => (
            <QuoteRow
              key={r.id}
              {...r}
              right={
                editing ? (
                  <View style={{ flexDirection: 'row', gap: 4, marginLeft: 10 }}>
                    <Pressable disabled={i === 0} onPress={() => move(r.id, -1)} hitSlop={6}>
                      <Ionicons name="chevron-up" size={22} color={i === 0 ? c.border : c.textSecondary} />
                    </Pressable>
                    <Pressable disabled={i === rows.length - 1} onPress={() => move(r.id, 1)} hitSlop={6}>
                      <Ionicons name="chevron-down" size={22} color={i === rows.length - 1 ? c.border : c.textSecondary} />
                    </Pressable>
                    <Pressable onPress={() => toggle(r.id)} hitSlop={6}>
                      <Ionicons name="remove-circle" size={22} color={c.down} />
                    </Pressable>
                  </View>
                ) : undefined
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
