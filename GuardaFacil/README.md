GuardaFacil/
├── assets/                         # Imágenes e iconos de la aplicación
├── contextos/
│   └── AuthContexto.js             # Estado de autenticación compartido
│   └── EstadoConexionContexto.js   # Conectividad y sincronización por usuario
├── navegacion/
│   └── NavegacionStack.js          # Stack principal de navegación
├── pantallas/
│   ├── HomeScreen.js                # Bienvenida pública
│   ├── LoginScreen.js               # Inicio de sesión
│   ├── RegistroScreen.js            # Creación de cuenta y perfil
│   ├── validacionesAuth.js          # Validaciones de Login y Registro
│   ├── ListaScreen.js               # Pantalla home protegida
│   └── MisReservasScreen.js         # Reservas activas e historial del usuario
├── services/
│   └── zonasService.js              # Consultas de zonas, casilleros y reservas
│   └── offlineStorage.js            # Caché local separada por UID
│   └── offlineQueueService.js       # Cola persistente de operaciones
├── firebase/
│   └── firebaseConfig.js            # Inicialización de Firebase Auth y Firestore
├── App.js                           # Punto de entrada
├── app.json                         # Configuración de Expo
├── package.json                     # Dependencias y scripts
├── .gitignore
├── .env                             # Variables locales, no se versiona
└── README.md
```

## Requisitos

- Node.js LTS y npm.
- Una cuenta de Firebase con Authentication habilitado.
- Expo Go, un emulador Android o un simulador iOS.

## Instalación

Desde `GuardaFacil` instala las dependencias:

```bash
npm install
```

Configura un archivo `.env` en la raíz con las credenciales de Firebase:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=tu-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu-messaging-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=tu-app-id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=tu-measurement-id
```

El archivo `.env` está excluido del repositorio. No publiques credenciales reales.

## Ejecutar

```bash
npx expo start
npm run android
npm run ios
npm run web
npm run lint
```

La aplicación usa `App.js` como entrada, `NavigationContainer` como contenedor raíz y `NavegacionStack` para mostrar Home, Login y Registro cuando no hay sesión, y `Lista` cuando el usuario está autenticado. Los datos adicionales del registro se guardan en `users/{uid}` de Cloud Firestore; las contraseñas solo son gestionadas por Firebase Authentication.

Desde `Lista`, el usuario autenticado puede abrir **Mis reservas** para consultar sus reservas activas y el historial. Las reservas se pueden cancelar hasta el inicio de su franja (Mañana 06:00, Tarde 12:00 y Noche 18:00, hora local del dispositivo); la cancelación requiere confirmación y se conserva para el historial en Firestore.

## Modo sin conexión

La aplicación usa `expo-network` para observar conectividad e `AsyncStorage` para guardar una caché de zonas, casilleros por zona y reservas/historial. Cada clave local está separada por UID. La caché conserva su fecha de actualización; si Firestore no responde, las pantallas muestran los últimos datos guardados e indican que la disponibilidad puede estar desactualizada. Esta caché es local a la instalación y no está cifrada por AsyncStorage.

Las reservas, cancelaciones e inicios de uso solicitados sin conexión se guardan en una cola local vinculada al UID. Una reserva en cola aparece como **Pendiente de validación**, nunca como confirmada. Cuando vuelve la conexión, Firestore valida cada operación mediante las transacciones existentes; un conflicto o error conserva la operación en la cola. Los conflictos se pueden reintentar o descartar explícitamente desde el aviso; descartar elimina solo la solicitud local no confirmada, no modifica Firestore. La cola se reintenta al recuperar conectividad, al volver la aplicación al primer plano o manualmente desde el aviso. Los errores de disponibilidad no se interpretan como confirmación ni como disponibilidad.

Al cerrar sesión con operaciones pendientes se puede intentar sincronizarlas, cancelar el cierre o cerrar sesión conservándolas. Las operaciones conservadas permanecen aisladas bajo la cuenta original y no se envían al iniciar sesión con otra cuenta.

### Prueba manual del modo offline

Usa una cuenta de prueba y datos no productivos. En el dispositivo o emulador puedes simular la pérdida de internet con modo avión o desactivando Wi-Fi y datos móviles.

1. **Conexión normal:** inicia sesión, abre zonas, casilleros y Mis reservas. Comprueba el indicador **Conectado** y que se guarden datos después de cargarlos.
2. **Pérdida de internet:** desactiva la red sin cerrar la aplicación. Comprueba **Sin conexión**, el aviso de disponibilidad desactualizada y que los listados previamente cargados sigan visibles.
3. **Reinicio offline:** mantén la red desactivada, cierra la aplicación por completo y vuelve a abrirla con la misma cuenta. Comprueba que aparezcan los listados guardados y el aviso offline.
4. **Operación pendiente:** sin red, solicita una reserva. Debe aparecer en Mis reservas como **Pendiente de validación** y en la cola; no debe mostrarse como confirmada. También se pueden encolar una cancelación o inicio de uso de una reserva existente.
5. **Recuperación:** vuelve a conectar el dispositivo. Comprueba que la cola se procese y que la operación solo desaparezca después de la confirmación de Firestore. Una reserva ocupada debe quedar identificada como conflicto.
6. **Error de sincronización:** en un proyecto Firebase de prueba, configura temporalmente una regla que deniegue la operación encolada y vuelve a conectar. Comprueba que siga en cola con error/conflicto; restaura la regla y usa **Reintentar sincronización**.
7. **Cambio de usuario:** encola una operación offline con la cuenta A y cierra sesión conservándola. Inicia sesión con la cuenta B: la cola y los datos de A no deben mostrarse ni enviarse. Al volver a A, su operación debe seguir disponible para reintento.