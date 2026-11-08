import type { CapacitorConfig } from '@capacitor/cli'

// App Android (APK) para las tablets de los mozos. Empaqueta la misma aplicación web;
// la dirección del servidor se indica en la tablet la primera vez que se abre.
const config: CapacitorConfig = {
  appId: 'ar.cyanbox.gestion',
  appName: 'Cyanbox',
  webDir: 'dist',
  server: {
    // El servidor del restaurante se usa por HTTP dentro de la red local.
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
