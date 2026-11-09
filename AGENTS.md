# Contexto de la trilogia Pokemon

Acuerdo del usuario confirmado el 2026-11-08:

- `mysql-restapi` gestiona autenticacion e identidad mediante JWT.
- `nest-mongo-pokedex` comunica las instancias del frontend mediante WebSocket.
- `vite-react-railway` contiene las vistas de jugadores y administrador; las batallas se llevan a cabo en el panel administrador.
- Los tres proyectos forman una sola aplicacion y se deben usar conjuntamente.

Si esta disponible, leer [la memoria compartida](../PROJECT_MEMORY.md). Este resumen se conserva tambien aqui para sesiones que abran solo este repositorio.

Evaluar este servicio como proveedor de autenticacion para toda la trilogia. La implementacion actual no redefine el reparto acordado. Las mejoras de roles, verificacion entre servicios y sesiones descritas en la memoria son propuestas pendientes de implementacion, no funcionalidades existentes ni nuevos requisitos confirmados.

No guardar credenciales o tokens en la documentacion. Actualizar el contexto cuando el usuario confirme nuevos acuerdos.

Primera integracion local (2026-11-09): `/mensajes-prueba` conecta las dos cuentas de prueba por Socket.IO en Nest y reutiliza el JWT de login existente. Los dos servidores requieren el mismo `JWT_SECRET`; nunca exponerlo a React. Ver README.
