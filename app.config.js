const projectId = (process.env.EAS_PROJECT_ID || '').trim();
const runtimeVersion = '1.0.4';

module.exports = {
  expo: {
    name: 'Paperly',
    slug: 'paperly',
    version: '1.0.4',
    orientation: 'portrait',
    android: {
      package: 'com.paperly',
      versionCode: 5,
    },
    runtimeVersion,
    updates: {
      enabled: Boolean(projectId),
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
      requestHeaders: {'expo-channel-name': 'production'},
      ...(projectId ? {url: 'https://u.expo.dev/' + projectId} : {}),
    },
    extra: {
      eas: projectId ? {projectId} : {},
    },
  },
};
