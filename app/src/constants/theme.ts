// Identité visuelle BRVMexa : encre profonde + vert émeraude, chiffres tabulaires.
export const Colors = {
  dark: {
    background: '#0A0F1A',
    surface: '#111827',
    surfaceAlt: '#182133',
    border: '#1F2A3D',
    text: '#F3F6FB',
    textSecondary: '#93A0B5',
    textMuted: '#5F6B80',
    accent: '#16C47F',
    accentSoft: 'rgba(22,196,127,0.14)',
    up: '#16C47F',
    upSoft: 'rgba(22,196,127,0.14)',
    down: '#F0526B',
    downSoft: 'rgba(240,82,107,0.14)',
    flat: '#93A0B5',
    gold: '#F2B33D',
  },
  light: {
    background: '#F4F6FA',
    surface: '#FFFFFF',
    surfaceAlt: '#EDF1F7',
    border: '#E2E7EF',
    text: '#0B1220',
    textSecondary: '#55627A',
    textMuted: '#8A95A8',
    accent: '#0E9F67',
    accentSoft: 'rgba(14,159,103,0.10)',
    up: '#0E9F67',
    upSoft: 'rgba(14,159,103,0.10)',
    down: '#D92D4B',
    downSoft: 'rgba(217,45,75,0.10)',
    flat: '#55627A',
    gold: '#C98A0B',
  },
};

export type Palette = typeof Colors.dark;

export const Radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
