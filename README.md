# Autenticación y usuarios Pokémon

Express/MySQL es la autoridad de identidad de los tres proyectos. Cada persona
inicia sesión con su correo y contraseña. El administrador gestiona las cuentas
desde `/users` en `vite-react-railway`; Nest utiliza sus identificadores estables
para las conversaciones WebSocket.

## Despliegue y migración

Desplegar este servicio **antes de las nuevas versiones de Nest y React**.
Conservar las variables `DB_*` y `JWT_SECRET` existentes. La misma clave privada
de firma debe existir en Nest; nunca configurar esa clave en React.

Al arrancar, el servidor espera una migración aditiva: añade `role`
(`player`/`admin`), `token_version` y el registro `schema_migrations`. Conserva
usuarios y contraseñas existentes. La cuenta `najerad2223@gmail.com` recibe rol
administrador una única vez durante esta migración; los arranques posteriores
respetan los cambios de roles. Los demás usuarios existentes quedan como jugadores.
En una instalación vacía se conserva la inicialización de cuentas de ejemplo.
La tabla `users` debe usar InnoDB y la cuenta SQL necesita permisos de migración.
Si falla la inicialización, el proceso termina sin abrir el servidor HTTP.

## API

Todas las rutas salvo login requieren `Authorization: Bearer <token>`.

| Método y ruta | Acceso y respuesta |
| --- | --- |
| `POST /api/login` | `{email,password}` → `{token,user}`. |
| `GET /api/auth/me` | Perfil vigente de la sesión → `{user}`. |
| `POST /api/logout` | `204`; el cliente elimina su token local. |
| `GET /api/users/contacts` | Cualquier usuario autenticado; `{users}`, sin la propia cuenta. |
| `GET /api/users` | Admin; `{users}`. |
| `GET /api/users/:id` | Admin; `{user}`. |
| `POST /api/users` | Admin; `{email,first_name,last_name,password,role?}` → `201 {user}`. |
| `PUT /api/users/:id` | Admin; cualquiera de los campos anteriores → `{user}`. |
| `DELETE /api/users/:id` | Admin; eliminación definitiva → `204`. |

El perfil público contiene solo `{id,email,first_name,last_name,role}`. El correo
se normaliza a minúsculas y debe ser único. Los nombres y correo admiten hasta
100 caracteres; las contraseñas nuevas requieren al menos 8 caracteres y hasta
72 bytes UTF-8, y se guardan con bcrypt. Al editar, omitir `password` si se conserva.
No hay registro público, verificación por correo ni recuperación de contraseña.
El administrador crea la cuenta y entrega sus credenciales al jugador.

La autorización consulta el usuario actual en MySQL. Cambiar correo, contraseña
o rol incrementa la versión de sesión e invalida sus JWT previos; eliminar una
cuenta también impide usar sus tokens. Cambiar solo el nombre conserva la sesión.
Los JWT caducan a las doce horas. Los anteriores sin versión se aceptan únicamente
mientras la cuenta conserve versión cero. Logout cierra la sesión local; no
revoca todos los dispositivos.

No se permite eliminarse ni retirarse el propio rol de administrador, y debe
quedar al menos un administrador. Las escrituras se serializan en una transacción
y revalidan al administrador después de tomar el bloqueo.

## Pruebas locales

```bash
npm run test:users
```

Usan Express real con un repositorio en memoria y un adaptador SQL simulado para
la migración. Cubren permisos, validación, CRUD, revocación, concurrencia y
conservación de datos. No conectan a MySQL ni Railway; la migración aún debe
verificarse en el entorno desplegado.
