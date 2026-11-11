# Contexto de la trilogia Pokemon

Acuerdo del usuario confirmado el 2026-11-08:

- `mysql-restapi` gestiona autenticacion e identidad mediante JWT.
- `nest-mongo-pokedex` comunica las instancias del frontend mediante WebSocket.
- `vite-react-railway` contiene las vistas de jugadores y administrador; las batallas se llevan a cabo en el panel administrador.
- Los tres proyectos forman una sola aplicacion y se deben usar conjuntamente.

Si esta disponible, leer [la memoria compartida](../PROJECT_MEMORY.md). Este resumen se conserva tambien aqui para sesiones que abran solo este repositorio.

Este servicio es la autoridad de identidad. Etapa autorizada 2026-11-10:
CRUD admin `/api/users`, perfil `/api/auth/me`, contactos y roles player/admin.
Migracion aditiva al arrancar; admin inicial asignado una sola vez. Cambiar
correo, password o rol revoca tokens previos; la autorizacion consulta MySQL.
No afirmar que el despliegue o la migracion Railway ya fueron verificados.

Reparacion de logout autorizada: POST `/api/logout` revoca solamente el token
actual y confirma 204 despues de persistir SHA-256 y expiracion en
`revoked_tokens`. El middleware consulta esta tabla en las rutas protegidas;
un token revocado recibe 401 `SESSION_REVOKED`. Login nuevo incluye `jti` UUID
para distinguir sesiones del mismo segundo; los tokens anteriores sin `jti`
tambien se revocan por hash. No incrementar `token_version` al cerrar una sesion
ni cerrar otros dispositivos. La migracion de revocaciones es aditiva al arrancar.
Validacion local: 22 pruebas HTTP/migracion con memoria/adaptador SQL simulado;
sin conectar a MySQL real ni desplegar.

No guardar credenciales o tokens en la documentacion. Actualizar el contexto cuando el usuario confirme nuevos acuerdos.

Primera integracion local (2026-11-09): `/mensajes-prueba` conecta las dos cuentas de prueba por Socket.IO en Nest y reutiliza el JWT de login existente. Los dos servidores requieren el mismo `JWT_SECRET`; nunca exponerlo a React. Ver README.
