import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.taskapp.app',
  appName: 'Task App',
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    url: 'https://task-app-aamir.vercel.app',
    cleartext: true
  }
};

export default config;
