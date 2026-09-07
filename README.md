# Eclion — datos en directo

Esta versión usa `functions/api/eclion-status.js`, una función para Cloudflare Pages. El navegador sólo consulta `/api/eclion-status`; las llamadas a YouTube y VRChat ocurren en el servidor, por lo que ninguna clave o credencial se expone en el HTML.

## Qué se actualiza

- **Miembros activos:** `memberCount` del grupo `grp_190a9e43-dbf5-49c8-85e7-e9c4599dff37`.
- **Vídeos y directos:** `statistics.videoCount` de EclionVR. YouTube define este valor como el total de vídeos públicos del canal; incluye retransmisiones públicas una vez publicadas o archivadas.
- **Vídeo destacado:** el primer elemento del feed oficial de publicaciones de EclionVR, es decir, lo último publicado. Esta parte funciona sin clave de YouTube.

La página comprueba los datos al abrirse, al volver a la pestaña y cada 15 minutos. La función conserva resultados cinco minutos en caché para evitar peticiones innecesarias. Mientras una fuente no responda, quedan visibles los últimos valores de respaldo (2.451 miembros y 63 publicaciones).

## Activación

1. Sube la carpeta completa a un proyecto de **Cloudflare Pages**. Pages detecta automáticamente el directorio `functions/` y publica la ruta `/api/eclion-status`.
2. El vídeo más reciente se obtiene desde el feed público del canal y no necesita configuración. Para que el contador de vídeos y directos también sea exacto y automático, añade `YOUTUBE_API_KEY` como secreto del proyecto. La clave debe tener habilitada la **YouTube Data API v3**. Opcionalmente, añade `YOUTUBE_CHANNEL_HANDLE` con `@EclionVR` si el handle cambia.
3. Publica el proyecto. No pongas la clave en `index.html` ni en un repositorio público.

## VRChat: fuente del contador

La función intenta primero la ruta oficial de grupo de VRChat. VRChat puede exigir autenticación para esa consulta o cambiar su API, y además esa API no se puede llamar directamente desde un navegador por CORS. Por seguridad, esta implementación **no pide ni guarda una cookie de sesión de VRChat**.

Si la consulta oficial devuelve un error al desplegar, configura `VRCHAT_GROUP_STATUS_URL` con una URL que controles y que entregue uno de estos JSON públicos:

```json
{ "memberCount": 2451 }
```

También se aceptan las claves `members` o `count`. Ese pequeño endpoint propio puede obtener la cifra con el método de administración autorizado que uséis, sin que el sitio web reciba credenciales. `VRCHAT_USER_AGENT` es opcional y permite identificar el servicio ante VRChat.

## Comprobación

Una vez publicado, abre `https://TU-DOMINIO/api/eclion-status`. Debe devolver `members`, `videoCount`, `latestVideo` y `updatedAt`. Si aparece `warnings`, la página seguirá mostrando el último dato conocido de la fuente que haya fallado.
