import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/lib/use-theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon = (on: IconName, off: IconName) =>
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? on : off} color={color} size={size - 2} />;
  };

export default function TabLayout() {
  const c = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Marchés', tabBarIcon: icon('stats-chart', 'stats-chart-outline') }} />
      <Tabs.Screen name="actions" options={{ title: 'Actions', tabBarIcon: icon('list', 'list-outline') }} />
      <Tabs.Screen name="news" options={{ title: 'Actualités', tabBarIcon: icon('newspaper', 'newspaper-outline') }} />
      <Tabs.Screen name="watchlist" options={{ title: 'Ma liste', tabBarIcon: icon('star', 'star-outline') }} />
      <Tabs.Screen name="more" options={{ title: 'Plus', tabBarIcon: icon('grid', 'grid-outline') }} />
    </Tabs>
  );
}
