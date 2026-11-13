import { Stack } from "expo-router";
import { PaperProvider } from "react-native-paper";
import {DarkTheme as NavigationDarkTheme,DefaultTheme as NavigationDefaultTheme, ThemeProvider} from '@react-navigation/native';
import {MD3DarkTheme,MD3LightTheme,adaptNavigationTheme} from 'react-native-paper';
import merge from 'deepmerge';
import { customThemeColor } from "@/utils/colors";
import { useColorScheme } from "react-native";
import { useEffect } from 'react';
import { useAiStore } from '@/ai/store';

const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

const customLightTheme={...MD3LightTheme,colors:customThemeColor.light};
const customDarkTheme={...MD3DarkTheme,colors:customThemeColor.dark};

const combineLightTheme=merge(LightTheme,customLightTheme);
const combineDarkTheme=merge(DarkTheme,customDarkTheme);

export default function RootLayout() {
  const colorScheme=useColorScheme();
  const theme=colorScheme==='dark'?combineDarkTheme:combineLightTheme;
  // Pre-load AI config on app start
  useEffect(() => {
    useAiStore.getState().loadConfig()
  }, [])
  return (
    <PaperProvider theme={theme}>
      <ThemeProvider value={theme}>
        <Stack screenOptions={{headerShown:false}}>
          <Stack.Screen name="index" />
          <Stack.Screen name="explore" />
          <Stack.Screen name="import" />
          <Stack.Screen name="export" />
          <Stack.Screen name="ai-settings" options={{ title: 'AI Settings', presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </PaperProvider>
  );
}
