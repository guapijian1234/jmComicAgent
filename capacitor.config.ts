import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.jmcomic.agent',
  appName: 'Comic Agent',
  webDir: 'out/renderer',
  server: {
    // Allow cleartext HTTP to LAN server
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
}

export default config
