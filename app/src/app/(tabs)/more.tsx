import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Logo, T, openArticle } from '@/components/ui';
import { Space } from '@/constants/theme';
import { DATA_BASE_URL } from '@/lib/config';
import { useData } from '@/lib/data-context';
import { fmtAgo, fmtSessionDate } from '@/lib/format';
import { useTheme } from '@/lib/use-theme';

export default function MoreScreen() {
  const c = useTheme();
  const { quotes, news, lastSync, online, refresh, refreshing } = useData();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Logo size={44} />
          <View>
            <Text style={{ color: c.text, fontSize: 24, fontWeight: '800' }}>
              BRVM<Text style={{ color: c.accent }}>exa</Text>
            </Text>
            <T muted style={{ fontSize: 13 }}>La Bourse régionale dans votre poche</T>
          </View>
        </View>

        <Card>
          <Row icon="pulse" label="Séance affichée" value={fmtSessionDate(quotes.sessionDate)} />
          <Row icon="cloud-download-outline" label="Cours publiés" value={fmtAgo(quotes.updatedAt)} />
          <Row icon="newspaper-outline" label="Actualités publiées" value={fmtAgo(news.updatedAt)} />
          <Row icon={online ? 'wifi' : 'cloud-offline-outline'} label="Synchronisation" value={online ? (lastSync ? fmtAgo(new Date(lastSync).toISOString()) : '…') : 'Hors ligne'} last />
        </Card>

        <Pressable onPress={refresh} disabled={refreshing} style={[styles.btn, { backgroundColor: c.accent, opacity: refreshing ? 0.6 : 1 }]}>
          <Ionicons name="refresh" size={18} color="#0A0F1A" />
          <Text style={{ color: '#0A0F1A', fontWeight: '800', fontSize: 15 }}>{refreshing ? 'Actualisation…' : 'Actualiser maintenant'}</Text>
        </Pressable>

        <Card>
          <Row icon="time-outline" label="Mise à jour automatique" value="Toutes les heures en séance" />
          <Row icon="business-outline" label="Cours et indices" value="brvm.org" onPress={() => openArticle('https://www.brvm.org/fr/cours-actions/0')} />
          <Row icon="megaphone-outline" label="Actualités" value="Sika Finance, presse" onPress={() => openArticle('https://www.sikafinance.com/marches/actualites_bourse_brvm')} last />
        </Card>

        <T dim style={{ fontSize: 12, lineHeight: 18 }}>
          Les cours sont ceux publiés par la BRVM après chaque séance (différés pendant la séance). BRVMexa est une application
          d’information indépendante : elle ne constitue pas un conseil en investissement. Pour acheter ou vendre des titres,
          adressez-vous à une SGI agréée.
        </T>
        <T dim style={{ fontSize: 11 }}>Source des données : {DATA_BASE_URL.replace('https://', '')}</T>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, value, last, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean; onPress?: () => void;
}): ReactNode {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      <Ionicons name={icon} size={18} color={c.accent} />
      <T style={{ flex: 1, fontSize: 14 }}>{label}</T>
      <T muted style={{ fontSize: 13 }}>{value}</T>
      {onPress ? <Ionicons name="open-outline" size={14} color={c.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Space.lg, paddingVertical: 14 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
});
