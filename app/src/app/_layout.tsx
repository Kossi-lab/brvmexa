import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DataProvider, WatchlistProvider } from '@/lib/data-context';
import { useTheme } from '@/lib/use-theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useTheme();
  const base = scheme === 'light' ? DefaultTheme : DarkTheme;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider
        value={{ ...base, colors: { ...base.colors, background: c.background, card: c.surface, text: c.text, border: c.border, primary: c.accent } }}>
        <DataProvider>
          <WatchlistProvider>
            <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: c.background },
                headerTintColor: c.text,
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: c.background },
              }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="instrument/[id]" options={{ title: '' }} />
              <Stack.Screen name="search" options={{ presentation: 'modal', headerShown: false }} />
            </Stack>
          </WatchlistProvider>
        </DataProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
