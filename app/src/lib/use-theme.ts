import { useColorScheme } from 'react-native';

import { Colors, type Palette } from '@/constants/theme';

/** Thème sombre par défaut (comme les applis de bourse), clair si le téléphone est en mode clair */
export function useTheme(): Palette {
  const scheme = useColorScheme();
  return scheme === 'light' ? Colors.light : Colors.dark;
}

export function toneColor(c: Palette, v: number | null | undefined) {
  if (v == null || v === 0) return c.flat;
  return v > 0 ? c.up : c.down;
}

export function toneSoft(c: Palette, v: number | null | undefined) {
  if (v == null || v === 0) return c.surfaceAlt;
  return v > 0 ? c.upSoft : c.downSoft;
}
