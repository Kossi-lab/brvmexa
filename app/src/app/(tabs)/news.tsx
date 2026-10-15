import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, NewsRow, Segmented, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useData, useWatchlist } from '@/lib/data-context';
import { fmtAgo } from '@/lib/format';
import { useTheme } from '@/lib/use-theme';

export default function NewsScreen() {
  const c = useTheme();
  const { news, refreshing, refresh } = useData();
  const { ids } = useWatchlist();
  const [cat, setCat] = useState('all');

  const categories = useMemo(() => [...new Set(news.items.map((n) => n.category))], [news]);
  const items = useMemo(() => {
    if (cat === 'all') return news.items;
    if (cat === 'mine') return news.items.filter((n) => n.symbols.some((s) => ids.includes(s)));
    return news.items.filter((n) => n.category === cat);
  }, [news, cat, ids]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingHorizontal: Space.lg, paddingTop: Space.md, paddingBottom: Space.md }}>
        <T style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Actualités</T>
        <T muted style={{ fontSize: 13, marginTop: 2 }}>Mise à jour automatique · {fmtAgo(news.updatedAt)}</T>
      </View>
      <View style={{ marginBottom: 4 }}>
        <Segmented
          scroll
          value={cat}
          onChange={setCat}
          options={[
            { key: 'all', label: 'Tout' },
            { key: 'mine', label: 'Ma liste' },
            ...categories.map((k) => ({ key: k, label: k })),
          ]}
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NewsRow item={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
        ListEmptyComponent={
          <EmptyState
            icon="newspaper-outline"
            title="Pas d’actualité ici pour l’instant"
            text={cat === 'mine' ? 'Les articles qui citent les valeurs de votre liste apparaîtront ici.' : undefined}
          />
        }
        ListFooterComponent={
          items.length ? (
            <T dim style={{ fontSize: 12, textAlign: 'center', padding: 20, lineHeight: 18 }}>
              Titres collectés automatiquement. Chaque article s’ouvre sur le site de son éditeur.
            </T>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
