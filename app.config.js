const projectId = (process.env.EAS_PROJECT_ID || '').trim();
const validProjectId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId);
const runtimeVersion = '1.0.7';

module.exports = {
  expo: {
    name: 'Paperly',
    slug: 'paperly',
    version: '1.0.8',
    orientation: 'portrait',
    android: {
      package: 'com.paperly',
      versionCode: 9,
    },
    runtimeVersion,
    updates: {
      enabled: validProjectId,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
      requestHeaders: {'expo-channel-name': 'production'},
      ...(validProjectId ? {url: 'https://u.expo.dev/' + projectId} : {}),
    },
    extra: {
      eas: validProjectId ? {projectId} : {},
    },
  },
};
