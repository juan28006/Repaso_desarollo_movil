# GuardaFácil API

Concentra la lógica de negocio. El cliente Expo (`../GuardaFacil`) solo habla con esta API.

## Roles

| Acción | estudiante | gestor | administrador |
|---|:-:|:-:|:-:|
| Ver zonas, casilleros y disponibilidad | ✅ | ✅ | ✅ |
| Reservar un casillero libre para sí mismo | ✅ | ✅ | ✅ |
| Cancelar su propia reserva (antes de que empiece la franja) | ✅ | ✅ | ✅ |
| Iniciar el uso de su reserva | ✅ | ✅ | ✅ |
| Reservar en nombre de un estudiante (`usuarioEmail`) | ❌ | ✅ | ✅ |
| Ver todas las reservas | ❌ | ✅ | ✅ |
| Cancelar cualquier reserva vigente y liberar el casillero (incluso en uso) | ❌ | ✅ | ✅ |
| Listar usuarios y cambiar roles | ❌ | ❌ | ✅ |

Todo registro público crea un **estudiante**. Los correos de `ADMIN_EMAILS` reciben el rol
administrador; desde ahí se promueve a gestores con `PATCH /usuarios/:uid/rol`.
Los usuarios que ya existían sin rol se tratan como estudiantes.

## Endpoints

```
POST  /auth/registro   POST /auth/login   POST /auth/refresh   GET /auth/me
GET   /zonas   GET /zonas/:zonaId/casilleros   GET /zonas/:zonaId/casilleros/:id
GET   /casilleros/:id/disponibilidad?fecha=AAAA-MM-DD&franja=Mañana|Tarde|Noche
POST  /reservas                 { zonaId, casilleroId, fecha, franja, usuarioEmail? }
GET   /reservas/mias
GET   /reservas?fecha=&estadoVisible=&usuarioEmail=&zonaId=      (gestor / administrador)
POST  /reservas/:id/cancelar    POST /reservas/:id/iniciar-uso
GET   /usuarios                 PATCH /usuarios/:uid/rol  { rol }  (administrador)
```

Errores: `{ "error": { "code", "mensaje" } }` con códigos `unauthenticated` (401),
`permission-denied` (403), `invalid-argument` (400), `not-found` (404) y
`reservation-conflict` / `operation-conflict` (409).

Cada reserva llega ya calculada: `estadoVisible`, `inicioUso`, `finUso`, `cancelableHasta`,
`puedeCancelar` y `puedeIniciarUso`. El cliente no reimplementa las reglas.

## Ejecutar

```bash
cd api
cp .env.example .env      # ajusta los valores
npm install
npm test                  # pruebas automáticas (modo memoria)
npm start                 # carga .env y arranca la API
```

`MODO_DATOS` es obligatorio. Con `MODO_DATOS=memoria` hay datos de ejemplo y nada persiste:
úsalo solo para desarrollar o probar con `NODE_ENV=development` o `NODE_ENV=test`; el backend
rechaza este modo en cualquier otro entorno.
Con `MODO_DATOS=firebase` se usan Firestore y Firebase Auth reales; necesitas la cuenta de servicio
del proyecto (Configuración del proyecto → Cuentas de servicio) y la *Web API key*. Las colecciones
son las que ya usaba la app (`users`, `zonas/*/casilleros`, `reservas`, `historial_reservas`).
Publica `firestore.rules` para impedir el acceso directo de las apps a Firestore.

`UTC_OFFSET_HORAS` fija la zona horaria de las franjas (Mañana 06–12, Tarde 12–18, Noche 18–24).
En un dispositivo físico, `EXPO_PUBLIC_API_URL` debe apuntar a la IP local del computador
en la misma red Wi-Fi (no `localhost` ni una IP antigua).
