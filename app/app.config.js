// Configurazione dinamica: parte da app.json e la adatta al server scelto per la build.
//
// EXPO_PUBLIC_API_URL (impostata in eas.json per ogni profilo) decide a quale backend
// si collega l'APK. Se è un indirizzo http:// (Raspberry Pi in rete locale) Android
// deve permettere il traffico non cifrato; per https:// (Render) resta bloccato.
module.exports = ({ config }) => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || config.extra?.apiUrl;
  // Può essere una lista separata da virgole: basta un indirizzo http:// per servire il permesso
  const cleartext =
    typeof apiUrl === 'string' && apiUrl.split(',').some((u) => u.trim().startsWith('http://'));

  const plugins = (config.plugins || []).map((p) =>
    p === 'expo-build-properties'
      ? ['expo-build-properties', { android: { usesCleartextTraffic: cleartext } }]
      : p,
  );

  return {
    ...config,
    plugins,
    extra: { ...config.extra, apiUrl },
  };
};
