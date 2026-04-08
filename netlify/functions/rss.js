/* =========================================================
   VV Zaamslag – RSS Feed  |  netlify/functions/rss.js

   Genereert een Media RSS feed van alle goedgekeurde foto's.
   URL: /.netlify/functions/rss

   Media RSS (mrss) wordt ondersteund door de meeste
   narrowcasting- en digitale bord-systemen.
   ========================================================= */

const SUPABASE_URL = 'https://knuwdcteeejcdbocchfp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7l-5fa-LaIjFMsDO5JK_QA_GBBdSE0l';
const SITE_URL     = 'https://vvzaamslag-app.netlify.app';

exports.handler = async function () {
  try {
    // Goedgekeurde foto's ophalen via Supabase REST API
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/inzendingen` +
      `?select=id,image_url,template_type,created_at` +
      `&status=eq.goedgekeurd` +
      `&order=created_at.desc`,
      {
        headers: {
          'apikey':        SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!response.ok) throw new Error(`Supabase: ${response.status} ${response.statusText}`);

    const fotos = await response.json();

    const items = fotos.map(foto => {
      const datum    = new Date(foto.created_at).toUTCString();
      const mimeType = foto.image_url.endsWith('.png') ? 'image/png' : 'image/jpeg';

      return `
    <item>
      <title>VV Zaamslag – ${escapeXml(foto.template_type)}</title>
      <link>${SITE_URL}/gallery.html</link>
      <description>${escapeXml(foto.template_type)}</description>
      <pubDate>${datum}</pubDate>
      <guid isPermaLink="false">${escapeXml(String(foto.id))}</guid>
      <media:content
        url="${escapeXml(foto.image_url)}"
        medium="image"
        type="${mimeType}" />
      <enclosure
        url="${escapeXml(foto.image_url)}"
        type="${mimeType}"
        length="0" />
    </item>`;
    }).join('');

    const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>VV Zaamslag Fotogalerij</title>
    <link>${SITE_URL}/gallery.html</link>
    <description>Goedgekeurde foto's van VV Zaamslag</description>
    <language>nl-NL</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/.netlify/functions/rss" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type':                'application/rss+xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':               'public, max-age=300', // 5 minuten cache
      },
      body: feed,
    };

  } catch (err) {
    console.error('[RSS]', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body:       `RSS generatie mislukt: ${err.message}`,
    };
  }
};

// XML-speciale tekens escapen
function escapeXml(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}
