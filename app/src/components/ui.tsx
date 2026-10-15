import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Radius, Space } from '@/constants/theme';
import { fmtAgo, fmtIndex, fmtPct, fmtPrice } from '@/lib/format';
import type { NewsItem } from '@/lib/types';
import { toneColor, toneSoft, useTheme } from '@/lib/use-theme';

export const num: TextStyle = { fontVariant: ['tabular-nums'] };

export function T({ style, muted, dim, children, numberOfLines }: {
  style?: StyleProp<TextStyle>; muted?: boolean; dim?: boolean; children: ReactNode; numberOfLines?: number;
}) {
  const c = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: dim ? c.textMuted : muted ? c.textSecondary : c.text, fontSize: 15 }, style]}>
      {children}
    </Text>
  );
}

/** Logo BRVMexa : barres ascendantes dans un carré arrondi */
export function Logo({ size = 28 }: { size?: number }) {
  const c = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x="0" y="0" width="32" height="32" rx="8" fill={c.accent} />
      <Rect x="7" y="17" width="4" height="8" rx="1.5" fill="#0A0F1A" />
      <Rect x="14" y="12" width="4" height="13" rx="1.5" fill="#0A0F1A" />
      <Rect x="21" y="7" width="4" height="18" rx="1.5" fill="#0A0F1A" />
      <Path d="M6 14 L13 9 L18 11 L26 5" stroke="#0A0F1A" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChangeBadge({ value, solid, small }: { value: number | null | undefined; solid?: boolean; small?: boolean }) {
  const c = useTheme();
  const color = toneColor(c, value);
  return (
    <View style={[styles.badge, small && { paddingHorizontal: 6, paddingVertical: 2 }, { backgroundColor: solid ? color : toneSoft(c, value) }]}>
      <Text style={[num, { color: solid ? '#fff' : color, fontWeight: '700', fontSize: small ? 12 : 13 }]}>{fmtPct(value)}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const c = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <T style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.3 }}>{title}</T>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={{ color: c.accent, fontWeight: '600', fontSize: 14 }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Segmented<K extends string>({ options, value, onChange, scroll }: {
  options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; scroll?: boolean;
}) {
  const c = useTheme();
  const body = options.map((o) => {
    const on = o.key === value;
    return (
      <Pressable
        key={o.key}
        onPress={() => onChange(o.key)}
        style={[styles.seg, { backgroundColor: on ? c.accent : c.surfaceAlt }, !scroll && { flex: 1 }]}>
        <Text style={{ color: on ? '#0A0F1A' : c.textSecondary, fontWeight: on ? '700' : '600', fontSize: 13, textAlign: 'center' }}>{o.label}</Text>
      </Pressable>
    );
  });
  return scroll ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: Space.lg }}>
      {body}
    </ScrollView>
  ) : (
    <View style={{ flexDirection: 'row', gap: 6 }}>{body}</View>
  );
}

/** Ligne de cotation : symbole, nom, cours, variation */
export function QuoteRow({ id, title, subtitle, price, change, isIndex, right }: {
  id: string; title: string; subtitle?: string; price: number | null; change: number | null; isIndex?: boolean; right?: ReactNode;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/instrument/[id]', params: { id } })}
      style={({ pressed }) => [styles.row, { borderBottomColor: c.border }, pressed && { backgroundColor: c.surfaceAlt }]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <T style={{ fontWeight: '700', fontSize: 15 }}>{title}</T>
        {subtitle ? <T muted numberOfLines={1} style={{ fontSize: 13, marginTop: 2 }}>{subtitle}</T> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <T style={[num, { fontWeight: '600' }]}>{isIndex ? fmtIndex(price) : fmtPrice(price)}</T>
        <ChangeBadge value={change} small />
      </View>
      {right}
    </Pressable>
  );
}

export function openArticle(url: string) {
  WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET }).catch(() => {});
}

export function NewsRow({ item, compact }: { item: NewsItem; compact?: boolean }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={() => openArticle(item.url)}
      style={({ pressed }) => [styles.news, { borderBottomColor: c.border }, pressed && { backgroundColor: c.surfaceAlt }]}>
      <View style={{ flex: 1, gap: 6 }}>
        <T numberOfLines={3} style={{ fontWeight: '700', fontSize: 15, lineHeight: 20 }}>{item.title}</T>
        {!compact && item.summary ? <T muted numberOfLines={2} style={{ fontSize: 13, lineHeight: 18 }}>{item.summary}</T> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ color: c.accent, fontSize: 12, fontWeight: '700' }}>{item.source}</Text>
          <T dim style={{ fontSize: 12 }}>· {fmtAgo(item.publishedAt)}</T>
          {item.premium ? <Ionicons name="lock-closed" size={11} color={c.gold} /> : null}
          {item.symbols.slice(0, 3).map((s) => (
            <View key={s} style={[styles.tag, { backgroundColor: c.surfaceAlt }]}>
              <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: '700' }}>{s}</Text>
            </View>
          ))}
        </View>
      </View>
      {item.image && !compact ? <Image source={item.image} style={styles.thumb} contentFit="cover" transition={150} /> : null}
    </Pressable>
  );
}

export function EmptyState({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text?: string }) {
  const c = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 40, gap: 10 }}>
      <Ionicons name={icon} size={40} color={c.textMuted} />
      <T style={{ fontWeight: '700', fontSize: 16, textAlign: 'center' }}>{title}</T>
      {text ? <T muted style={{ textAlign: 'center', lineHeight: 20 }}>{text}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3, minWidth: 64, alignItems: 'center' },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space.lg, marginTop: Space.xl, marginBottom: Space.sm },
  seg: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  news: { flexDirection: 'row', gap: 12, paddingHorizontal: Space.lg, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 84, height: 64, borderRadius: Radius.sm },
  tag: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
});
