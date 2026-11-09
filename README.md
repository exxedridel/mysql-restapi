# mysql-restapi

Servicio de autenticación de la trilogía Pokémon. React utiliza `POST /api/login`
con `{ "email": "...", "password": "..." }` y guarda el campo `token` de la
respuesta como `bearer_token`.

Para la prueba `/mensajes-prueba`, `nest-mongo-pokedex` verifica ese mismo JWT.
Configura **el mismo valor privado de `JWT_SECRET` en ambos servidores**. El
secreto nunca se configura en variables `VITE_*` ni se envía al navegador.

El contrato actual ya contiene `id`, `email`, nombres y caducidad. Esta primera
integración no modifica las cuentas ni necesita una migración de MySQL.

En Railway se conserva el servicio de autenticación existente. La nueva
comunicación se despliega en Nest y la página en `vite-react-railway`.
