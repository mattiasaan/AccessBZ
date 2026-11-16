import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from './src/AppContext';
import ProximityBanner from './src/components/ProximityBanner';
import ReportSheet from './src/components/ReportSheet';
import { Icon } from './src/components/ui';
import MapScreen from './src/screens/MapScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ReportScreen from './src/screens/ReportScreen';
import RouteScreen from './src/screens/RouteScreen';
import { t } from './src/i18n';
import { colors, fonts } from './src/theme';

const Tab = createBottomTabNavigator();

// [icona normale, icona quando la scheda è attiva]
const ICONS = {
  Mappa: ['map-outline', 'map'],
  Percorso: ['directions', 'directions'],
  Segnala: ['plus-circle-outline', 'plus-circle'],
  Profilo: ['account-circle-outline', 'account-circle'],
};

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg } };

function Root() {
  const { ready, user } = useApp();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!user) return <OnboardingScreen />;

  return (
    <>
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            animation: 'fade',
            // I nomi delle schede restano in italiano (servono a navigate); l'etichetta è tradotta
            tabBarLabel: t(`tabs.${route.name}`),
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textSubtle,
            tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
            tabBarIcon: ({ focused, color }) => (
              <Icon name={ICONS[route.name][focused ? 1 : 0]} size={24} color={color} />
            ),
          })}
        >
          <Tab.Screen name="Mappa" component={MapScreen} />
          <Tab.Screen name="Percorso" component={RouteScreen} />
          <Tab.Screen name="Segnala" component={ReportScreen} />
          <Tab.Screen name="Profilo" component={ProfileScreen} />
        </Tab.Navigator>
      </NavigationContainer>
      <ReportSheet />
      <ProximityBanner />
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        {fontsLoaded ? <Root /> : <View style={{ flex: 1, backgroundColor: colors.bg }} />}
      </AppProvider>
    </SafeAreaProvider>
  );
}
