import { useMemo, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { T, num } from './ui';

import { fmtIndex, fmtPrice, fmtShortDate } from '@/lib/format';
import type { HistoryPoint } from '@/lib/types';
import { useTheme } from '@/lib/use-theme';

/**
 * Graphique de cours en ligne avec dégradé.
 * Glisser le doigt affiche la valeur et la date du point le plus proche.
 */
export function LineChart({ points, height = 220, isIndex, onScrub }: {
  points: HistoryPoint[]; height?: number; isIndex?: boolean; onScrub?: (p: HistoryPoint | null) => void;
}) {
  const c = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const pad = { top: 16, bottom: 22, left: 4, right: 52 };

  const up = points.length < 2 || points[points.length - 1].c >= points[0].c;
  const color = up ? c.up : c.down;

  const geo = useMemo(() => {
    if (points.length < 2 || !width) return null;
    const vals = points.map((p) => p.c);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    min -= span * 0.06; max += span * 0.06;
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    const x = (i: number) => pad.left + (i / (points.length - 1)) * w;
    const y = (v: number) => pad.top + (1 - (v - min) / (max - min)) * h;
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(1)},${height - pad.bottom} L${x(0).toFixed(1)},${height - pad.bottom} Z`;
    const ticks = [max - (max - min) * 0.06, (max + min) / 2, min + (max - min) * 0.06];
    return { x, y, line, area, ticks, w };
  }, [points, width, height]);

  const fmt = (v: number) => (isIndex ? fmtIndex(v) : fmtPrice(v));

  const handle = (e: GestureResponderEvent) => {
    if (!geo) return;
    const rel = (e.nativeEvent.locationX - pad.left) / geo.w;
    const i = Math.max(0, Math.min(points.length - 1, Math.round(rel * (points.length - 1))));
    setActive(i);
    onScrub?.(points[i]);
  };
  const end = () => { setActive(null); onScrub?.(null); };

  if (points.length < 2) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <T muted style={{ textAlign: 'center', lineHeight: 20 }}>
          L’historique se construit jour après jour avec la collecte automatique. Le graphique apparaîtra dès la prochaine séance.
        </T>
      </View>
    );
  }

  return (
    <View
      style={{ height }}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={handle}
      onResponderMove={handle}
      onResponderRelease={end}
      onResponderTerminate={end}>
      {geo ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {geo.ticks.map((t, i) => (
            <Line key={i} x1={pad.left} x2={width - pad.right} y1={geo.y(t)} y2={geo.y(t)} stroke={c.border} strokeDasharray="3 5" />
          ))}
          <Path d={geo.area} fill="url(#fill)" />
          <Path d={geo.line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
          {active != null ? (
            <>
              <Line x1={geo.x(active)} x2={geo.x(active)} y1={pad.top} y2={height - pad.bottom} stroke={c.textSecondary} strokeWidth={1} />
              <Circle cx={geo.x(active)} cy={geo.y(points[active].c)} r={5} fill={color} stroke={c.background} strokeWidth={2} />
            </>
          ) : null}
        </Svg>
      ) : null}
      {geo ? geo.ticks.map((t, i) => (
        <T key={i} dim style={[num, { position: 'absolute', right: 0, top: geo.y(t) - 8, fontSize: 11, width: pad.right - 6, textAlign: 'right' }]}>
          {fmt(t)}
        </T>
      )) : null}
      <View style={{ position: 'absolute', bottom: 0, left: pad.left, right: pad.right, flexDirection: 'row', justifyContent: 'space-between' }}>
        <T dim style={{ fontSize: 11 }}>{fmtShortDate(points[0].d)}</T>
        <T dim style={{ fontSize: 11 }}>{fmtShortDate(points[points.length - 1].d)}</T>
      </View>
    </View>
  );
}

/** Mini-courbe pour les listes */
export function Sparkline({ points, width = 64, height = 28 }: { points: number[]; width?: number; height?: number }) {
  const c = useTheme();
  if (points.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...points);
  const max = Math.max(...points) || min + 1;
  const d = points
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * width).toFixed(1)},${(height - ((v - min) / (max - min || 1)) * height).toFixed(1)}`)
    .join(' ');
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={points[points.length - 1] >= points[0] ? c.up : c.down} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}
