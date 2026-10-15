import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, ChangeBadge, Logo, NewsRow, QuoteRow, SectionTitle, Segmented, T, num } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useData } from '@/lib/data-context';
import { fmtBig, fmtIndex, fmtSessionDate, fmtSigned } from '@/lib/format';
import { toneColor, useTheme } from '@/lib/use-theme';

type MoverTab = 'gainers' | 'losers' | 'mostActive';

export default function MarketsScreen() {
  const c = useTheme();
  const { indices, market, news, refreshing, refresh, online } = useData();
  const [tab, setTab] = useState<MoverTab>('gainers');

  const main = indices.items.filter((i) => i.group === 'main');
  const sectors = indices.items.filter((i) => i.group === 'sector');
  const total = market.advancing + market.declining + market.unchanged || 1;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Logo />
          <Text style={{ color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>
            BRVM<Text style={{ color: c.accent }}>exa</Text>
          </Text>
        </View>
        <Pressable onPress={() => router.push('/search')} hitSlop={10} style={[styles.searchBtn, { backgroundColor: c.surfaceAlt }]}>
          <Ionicons name="search" size={18} color={c.text} />
        </Pressable>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
        contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Space.lg, marginBottom: Space.md }}>
          <View style={[styles.dot, { backgroundColor: online ? c.accent : c.gold }]} />
          <T muted style={{ fontSize: 13 }}>
            Séance du {fmtSessionDate(market.sessionDate)}
            {online ? '' : ' · hors ligne'}
          </T>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: Space.lg }}>
          {main.map((ix) => (
            <Pressable key={ix.id} onPress={() => router.push({ pathname: '/instrument/[id]', params: { id: ix.id } })}>
              <Card style={styles.indexCard}>
                <T muted style={{ fontSize: 13, fontWeight: '600' }}>{ix.name}</T>
                <T style={[num, { fontSize: 22, fontWeight: '800', marginTop: 6 }]}>{fmtIndex(ix.close)}</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <Text style={[num, { color: toneColor(c, ix.change), fontWeight: '700', fontSize: 13 }]}>
                    {fmtSigned(ix.prevClose != null ? ix.close - ix.prevClose : null, 2)}
                  </Text>
                  <ChangeBadge value={ix.change} small />
                </View>
                {ix.ytd != null ? (
                  <T dim style={{ fontSize: 12, marginTop: 6 }}>
                    Depuis le 1er janv. <Text style={{ color: toneColor(c, ix.ytd), fontWeight: '700' }}>{ix.ytd > 0 ? '+' : ''}{ix.ytd.toFixed(2).replace('.', ',')} %</Text>
                  </T>
                ) : null}
              </Card>
            </Pressable>
          ))}
        </ScrollView>

        <SectionTitle title="Le marché aujourd’hui" />
        <Card style={{ marginHorizontal: Space.lg, padding: Space.lg, gap: 14 }}>
          <View style={styles.breadth}>
            <View style={{ flex: market.advancing / total, backgroundColor: c.up, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }} />
            <View style={{ flex: market.unchanged / total, backgroundColor: c.textMuted }} />
            <View style={{ flex: market.declining / total, backgroundColor: c.down, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Stat label="Hausses" value={String(market.advancing)} color={c.up} />
            <Stat label="Inchangées" value={String(market.unchanged)} />
            <Stat label="Baisses" value={String(market.declining)} color={c.down} align="flex-end" />
          </View>
          <View style={[styles.sep, { backgroundColor: c.border }]} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Stat label="Valeur échangée" value={`${fmtBig(market.transactionsValue)} F`} />
            <Stat label="Capitalisation actions" value={`${fmtBig(market.capitalisationActions)} F`} align="flex-end" />
          </View>
        </Card>

        <SectionTitle title="Palmarès" action="Toutes les actions" onAction={() => router.push('/actions')} />
        <View style={{ paddingHorizontal: Space.lg, marginBottom: 4 }}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { key: 'gainers', label: 'Hausses' },
              { key: 'losers', label: 'Baisses' },
              { key: 'mostActive', label: 'Plus actives' },
            ]}
          />
        </View>
        {market[tab].map((m) => (
          <QuoteRow key={m.symbol} id={m.symbol} title={m.symbol} subtitle={m.shortName} price={m.close} change={m.change} />
        ))}

        <SectionTitle title="Dernières actualités" action="Tout voir" onAction={() => router.push('/news')} />
        {news.items.slice(0, 4).map((n) => (
          <NewsRow key={n.id} item={n} compact />
        ))}

        <SectionTitle title="Indices sectoriels" />
        {sectors.map((ix) => (
          <QuoteRow key={ix.id} id={ix.id} title={ix.name.replace('BRVM ', '')} price={ix.close} change={ix.change} isIndex />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color, align = 'flex-start' }: { label: string; value: string; color?: string; align?: 'flex-start' | 'flex-end' }) {
  return (
    <View style={{ alignItems: align }}>
      <T dim style={{ fontSize: 12 }}>{label}</T>
      <T style={[num, { fontWeight: '800', fontSize: 16, marginTop: 2 }, color ? { color } : null]}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.lg, paddingVertical: Space.md },
  searchBtn: { width: 38, height: 38, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  indexCard: { width: 178, padding: Space.lg },
  breadth: { flexDirection: 'row', height: 8, gap: 2 },
  sep: { height: StyleSheet.hairlineWidth },
});
