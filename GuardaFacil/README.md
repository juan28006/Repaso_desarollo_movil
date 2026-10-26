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
│   ├── MisReservasScreen.js         # Reservas activas e historial del usuario
│   ├── GestionReservasScreen.js     # Gestor/administrador: ver y liberar reservas
│   └── UsuariosScreen.js            # Administrador: cambiar roles
├── services/
│   ├── apiClient.js                 # Único acceso al servidor (token, renovación, errores)
│   ├── sesion.js                    # Sesión guardada en almacén seguro
│   ├── zonasService.js              # Zonas, casilleros y reservas vía API (+ caché)
│   ├── gestionService.js            # Reservas globales y usuarios (gestor/admin)
│   ├── offlineDb.js                 # SQLite: caché y cola offline
│   └── offlineQueueService.js       # Cola persistente de operaciones
├── constantes/roles.js              # estudiante / gestor / administrador
├── App.js                           # Punto de entrada
├── app.json                         # Configuración de Expo
├── package.json                     # Dependencias y scripts
├── .gitignore
├── .env                             # Variables locales, no se versiona
└── README.md
```

## Requisitos

- Node.js LTS y npm.
- La API de GuardaFácil en ejecución (carpeta `../api`, ver su README).
- Expo Go, un emulador Android o un simulador iOS.

## Instalación

Desde `GuardaFacil` instala las dependencias:

```bash
npm install
```

Configura un archivo `.env` en la raíz con la URL de la API (ver `.env.example`):

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

En un celular físico usa la IP de tu computador en la red local, no `localhost`. El cliente ya no
incluye Firebase: la API es la única que accede a Firestore y a Firebase Auth.

## Ejecutar

```bash
npx expo start
npm run android
npm run ios
npm run web
npm run lint
npm test
```

La aplicación usa `App.js` como entrada y `NavegacionStack` muestra Home, Login y Registro cuando no hay sesión, y `Lista` cuando el usuario está autenticado. Registro, login, reservas y demás reglas de negocio se ejecutan en la API; el cliente solo guarda el token de sesión en el almacén seguro del dispositivo.

## Roles

- **Estudiante:** reserva un casillero libre (zona → casillero → fecha y franja), consulta **Mis reservas**, cancela las suyas hasta el inicio de la franja e inicia el uso durante ella.
- **Gestor:** además de lo anterior, ve **Gestión de reservas**, cancela cualquier reserva vigente para liberar el casillero y puede reservar a nombre de un estudiante escribiendo su correo en el detalle del casillero.
- **Administrador:** todo lo del gestor más **Usuarios y roles** para promover o cambiar roles.

El rol lo asigna la API; las pantallas solo ocultan opciones y la API rechaza lo que no corresponde.

## Modo sin conexión

La aplicación usa `expo-network` para observar conectividad y **SQLite** (`expo-sqlite`, base `guardafacil.db`) en una versión reducida de dos tablas: `cache` (última respuesta de la API por UID y recurso: zonas, casilleros, reservas, y para el personal reservas globales/usuarios) y `cola` (operaciones pendientes por UID). Si la API no responde, las pantallas muestran los últimos datos guardados e indican que la disponibilidad puede estar desactualizada. La base es local a la instalación y no está cifrada; el token de sesión va aparte, en `expo-secure-store`. La app abre con la sesión guardada aunque no haya internet.

Las reservas, cancelaciones (también las liberaciones de un gestor) e inicios de uso solicitados sin conexión se guardan en la cola. Una reserva en cola aparece como **Pendiente de validación**, nunca como confirmada. Cuando vuelve la conexión, la API valida cada operación con sus reglas. Si la acepta, se actualiza la caché y se quita de la cola; los conflictos quedan marcados como **Conflicto** y los errores definitivos del cliente como **Rechazada**, ambos disponibles para descartar explícitamente desde el aviso. Los conflictos se pueden reintentar; los rechazos deben descartarse antes de volver a enviar una solicitud corregida. La cola se reintenta al recuperar conectividad, al volver la aplicación al primer plano o manualmente desde el aviso. Cambiar roles requiere conexión.

Al cerrar sesión con operaciones pendientes se puede intentar sincronizarlas, cancelar el cierre o cerrar sesión conservándolas. Las operaciones conservadas permanecen aisladas bajo la cuenta original y no se envían al iniciar sesión con otra cuenta.

### Prueba manual del modo offline

Usa una cuenta de prueba y datos no productivos. En el dispositivo o emulador puedes simular la pérdida de internet con modo avión o desactivando Wi-Fi y datos móviles.

1. **Conexión normal:** inicia sesión, abre zonas, casilleros y Mis reservas. Comprueba el indicador **Conectado** y que se guarden datos después de cargarlos.
2. **Pérdida de internet:** desactiva la red sin cerrar la aplicación. Comprueba **Sin conexión**, el aviso de disponibilidad desactualizada y que los listados previamente cargados sigan visibles.
3. **Reinicio offline:** mantén la red desactivada, cierra la aplicación por completo y vuelve a abrirla con la misma cuenta. Comprueba que aparezcan los listados guardados y el aviso offline.
4. **Operación pendiente:** sin red, solicita una reserva. Debe aparecer en Mis reservas como **Pendiente de validación** y en la cola; no debe mostrarse como confirmada. También se pueden encolar una cancelación o inicio de uso de una reserva existente.
5. **Recuperación:** vuelve a conectar el dispositivo. Comprueba que la cola se procese y que la operación solo desaparezca después de la confirmación de la API. Una reserva ocupada debe quedar identificada como conflicto.
6. **Error de sincronización:** reserva sin conexión un casillero que otra cuenta reserve mientras tanto (o detén la API) y vuelve a conectar. Comprueba que siga en cola con error/conflicto; reanuda la API y usa **Reintentar sincronización**.
7. **Cambio de usuario:** encola una operación offline con la cuenta A y cierra sesión conservándola. Inicia sesión con la cuenta B: la cola y los datos de A no deben mostrarse ni enviarse. Al volver a A, su operación debe seguir disponible para reintento.