const GROUP_ID = 'grp_190a9e43-dbf5-49c8-85e7-e9c4599dff37';
const YOUTUBE_CHANNEL_ID = 'UCQsSLdfj6gD6kpCYTs16mGg';
const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const CACHE_SECONDS = 300;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // El navegador vuelve a consultar al abrir la página; el edge cachea sólo cinco minutos.
      'Cache-Control': `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=60`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function readJson(response, source) {
  if (!response.ok) throw new Error(`${source} respondió con HTTP ${response.status}`);
  return response.json();
}

async function readText(response, source) {
  if (!response.ok) throw new Error(`${source} respondió con HTTP ${response.status}`);
  return response.text();
}

function asCount(value, source) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error(`${source} no devolvió un contador válido`);
  return count;
}

function decodeXml(value = '') {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function readXmlTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decodeXml(match[1].trim()) : null;
}

async function getLatestYouTubeVideo() {
  const feed = await readText(
    await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`, { headers: { Accept: 'application/atom+xml, application/xml' } }),
    'YouTube (feed de publicaciones)',
  );
  // El feed oficial está ordenado de más reciente a más antiguo y devuelve las 15 últimas publicaciones.
  const entry = feed.match(/<entry>[\s\S]*?<\/entry>/)?.[0];
  const videoId = entry ? readXmlTag(entry, 'yt:videoId') : null;
  if (!videoId) throw new Error('El feed de YouTube no devolvió ningún vídeo');
  return {
    id: videoId,
    title: readXmlTag(entry, 'title') || 'Último vídeo de EclionVR',
    publishedAt: readXmlTag(entry, 'published'),
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
  };
}

async function getYouTubeStatus(env) {
  const latestVideo = await getLatestYouTubeVideo();
  // El feed soluciona el último vídeo sin clave. Para el total exacto de publicaciones públicas,
  // YouTube exige su Data API; la clave se mantiene exclusivamente en el servidor.
  if (!env.YOUTUBE_API_KEY) return { videoCount: null, latestVideo };

  const handle = env.YOUTUBE_CHANNEL_HANDLE || '@EclionVR';
  const channelQuery = new URLSearchParams({
    part: 'statistics',
    forHandle: handle,
    key: env.YOUTUBE_API_KEY,
  });
  const channelPayload = await readJson(
    await fetch(`${YOUTUBE_API}/channels?${channelQuery}`, { headers: { Accept: 'application/json' } }),
    'YouTube (canal)',
  );
  const channel = channelPayload.items?.[0];
  if (!channel?.statistics) throw new Error('No se encontró el canal de YouTube configurado');

  return {
    videoCount: asCount(channel.statistics?.videoCount, 'YouTube'),
    latestVideo,
  };
}

async function getVrchatMemberCount(env) {
  // Si se configura un proveedor propio y aprobado de estadísticas, tiene prioridad.
  // Debe responder con { memberCount }, { members } o { count } y nunca exponer credenciales al navegador.
  const source = env.VRCHAT_GROUP_STATUS_URL || `https://api.vrchat.cloud/api/1/groups/${GROUP_ID}`;
  const response = await fetch(source, {
    headers: {
      Accept: 'application/json',
      'User-Agent': env.VRCHAT_USER_AGENT || 'Eclion website status service (contact: hispaeclion@gmail.com)',
    },
  });
  const payload = await readJson(response, 'VRChat');
  return asCount(payload.memberCount ?? payload.members ?? payload.count, 'VRChat');
}

async function attempt(label, action, warnings) {
  try {
    return await action();
  } catch (error) {
    warnings.push(`${label}: ${error instanceof Error ? error.message : 'respuesta no disponible'}`);
    return null;
  }
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/eclion-status', context.request.url).toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const warnings = [];
  const [youtube, members] = await Promise.all([
    attempt('YouTube', () => getYouTubeStatus(context.env), warnings),
    attempt('VRChat', () => getVrchatMemberCount(context.env), warnings),
  ]);

  const response = json({
    members,
    videoCount: youtube?.videoCount ?? null,
    latestVideo: youtube?.latestVideo ?? null,
    updatedAt: new Date().toISOString(),
    warnings,
  });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
