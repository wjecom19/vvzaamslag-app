/* =========================================================
   VV Zaamslag – Foto App  |  script.js
   ========================================================= */

'use strict';

// =========================================================
// Supabase
// =========================================================
const SUPABASE_URL = 'https://knuwdcteeejcdbocchfp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7l-5fa-LaIjFMsDO5JK_QA_GBBdSE0l';
const BUCKET       = 'fotos';

let supabaseClient = null;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
  console.warn('Supabase initialisatie mislukt:', e.message);
}

// =========================================================
// DOM-referenties
// =========================================================
const photoInput     = document.getElementById('photo-input');
const canvas         = document.getElementById('canvas');
const ctx            = canvas.getContext('2d');
const stepPreview    = document.getElementById('step-preview');
const captionInput   = document.getElementById('caption-input');
const captionCounter = document.getElementById('caption-counter');
const verzendBtn     = document.getElementById('verzend-btn');
const verzendLabel   = document.getElementById('verzend-label');
const btnSpinner     = document.getElementById('btn-spinner');
const statusMsg      = document.getElementById('status-msg');
const changePhotoBtn = document.getElementById('change-photo-btn');
const flashOverlay   = document.getElementById('flash-overlay');

// =========================================================
// Staat
// =========================================================
let loadedImage = null;

// =========================================================
// 1. Foto inladen
// =========================================================
photoInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = event => {
    const img = new Image();
    img.onload = () => {
      loadedImage = img;
      triggerFlash();
      renderCanvas();
      verbergStatus();
      stepPreview.hidden = false;
      stepPreview.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

changePhotoBtn.addEventListener('click', () => {
  photoInput.value = '';
  photoInput.click();
});

// =========================================================
// 2. Onderschrift — live hertekenen
// =========================================================
captionInput.addEventListener('input', () => {
  const len = captionInput.value.length;
  captionCounter.textContent = `${len}/60`;
  captionCounter.classList.toggle('caption-counter--vol', len >= 50);
  if (loadedImage) renderCanvas();
});

// =========================================================
// 3. Canvas tekenen: foto + gradient + branding + caption
// =========================================================
function renderCanvas() {
  const img   = loadedImage;
  const MAX_W = 1080;

  // Logische afmetingen (onafhankelijk van DPR)
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > MAX_W) {
    h = Math.round(h * MAX_W / w);
    w = MAX_W;
  }

  // Schaal canvas op met device pixel ratio voor scherpe tekst op retineschermen
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width        = w * dpr;
  canvas.height       = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);  // teken alles in logische pixels

  ctx.drawImage(img, 0, 0, w, h);
  tekenGradient(w, h);
  tekenTekst(w, h, captionInput.value.trim());
}

function tekenGradient(w, h) {
  const gradH    = Math.round(h * 0.42);
  const gradient = ctx.createLinearGradient(0, h - gradH, 0, h);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, h - gradH, w, gradH);
}

function tekenTekst(w, h, caption) {
  const padding   = Math.round(w * 0.04);
  const onderrand = h - Math.round(h * 0.03);
  const maxWidth  = w - padding * 2;

  // Font-groottes op basis van breedte (niet hoogte) — voorkomt overflow bij portretfotos
  const brandSize   = Math.min(Math.round(w * 0.038), 36);
  const captionSize = Math.min(Math.round(w * 0.052), 48);

  // VV Zaamslag branding (altijd aanwezig, linksonder)
  ctx.save();
  ctx.fillStyle    = '#a2c626';
  ctx.font         = `800 ${brandSize}px Inter, Arial, sans-serif`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('VV ZAAMSLAG', padding, onderrand);
  ctx.restore();

  if (!caption) return;

  // Caption: gesplitst over maximaal 2 regels, gecentreerd
  ctx.save();
  ctx.font           = `700 ${captionSize}px Inter, Arial, sans-serif`;
  ctx.fillStyle      = '#ffffff';
  ctx.textAlign      = 'center';
  ctx.textBaseline   = 'bottom';
  ctx.shadowColor    = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur     = 4;
  ctx.shadowOffsetY  = 1;

  const regels    = woordWrap(ctx, caption, maxWidth);
  const regelH    = captionSize * 1.3;
  const basisY    = onderrand - brandSize - Math.round(h * 0.025);

  // Teken regels van onder naar boven
  regels.reverse().forEach((regel, i) => {
    ctx.fillText(regel, w / 2, basisY - i * regelH);
  });

  ctx.restore();
}

// Splits tekst in maximaal 2 regels op woordgrenzen
function woordWrap(context, tekst, maxWidth) {
  const woorden = tekst.split(' ');
  const regels  = [];
  let huidig    = '';

  for (const woord of woorden) {
    const test = huidig ? huidig + ' ' + woord : woord;
    if (context.measureText(test).width <= maxWidth) {
      huidig = test;
    } else {
      if (huidig) regels.push(huidig);
      huidig = woord;
      if (regels.length >= 1) break; // max 2 regels
    }
  }

  if (huidig) {
    // Zorg dat de laatste regel past (anders afkappen)
    if (context.measureText(huidig).width > maxWidth) {
      huidig = kapTekstAf(context, huidig, maxWidth);
    }
    regels.push(huidig);
  }

  return regels;
}

function kapTekstAf(context, tekst, maxWidth) {
  while (tekst.length > 0) {
    tekst = tekst.slice(0, -1);
    if (context.measureText(tekst + '…').width <= maxWidth) return tekst + '…';
  }
  return '…';
}

// =========================================================
// 4. Verzenden naar Supabase
// =========================================================
verzendBtn.addEventListener('click', verzendFoto);

async function verzendFoto() {
  if (!loadedImage) return;

  if (!supabaseClient) {
    toonStatus('error', 'Verbinding met de server niet beschikbaar. Herlaad de pagina.');
    return;
  }

  if (!navigator.onLine) {
    toonStatus('error', 'Geen internetverbinding. Controleer je verbinding en probeer opnieuw.');
    return;
  }

  setBusy(true);
  toonStatus('loading', 'Bezig met verzenden…');

  try {
    const blob         = await canvasNaarBlob();
    const bestandsnaam = `vvz-${Date.now()}.jpg`;

    const { error: uploadError } = await supabaseClient
      .storage
      .from(BUCKET)
      .upload(bestandsnaam, blob, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) throw new Error(`Upload mislukt: ${uploadError.message}`);

    const { data: urlData } = supabaseClient
      .storage
      .from(BUCKET)
      .getPublicUrl(bestandsnaam);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) throw new Error('Publieke URL kon niet worden opgehaald.');

    const { error: dbError } = await supabaseClient
      .from('inzendingen')
      .insert({
        image_url: publicUrl,
        caption:   captionInput.value.trim() || null,
        status:    'pending',
      });

    if (dbError) throw new Error(`Database-fout: ${dbError.message}`);

    toonStatus('success', 'Foto succesvol verzonden naar de admin!');
    captionInput.value = '';
    captionCounter.textContent = '0/60';

  } catch (err) {
    console.error('[VVZ Upload]', err);
    const bericht = err.message?.includes('Failed to fetch')
      ? 'Verbinding met de server mislukt. Controleer je internet en probeer opnieuw.'
      : `Er ging iets mis: ${err.message}`;
    toonStatus('error', bericht);

  } finally {
    setBusy(false);
  }
}

// =========================================================
// Hulpfuncties
// =========================================================
function setBusy(isBusy) {
  verzendBtn.disabled     = isBusy;
  changePhotoBtn.disabled = isBusy;
  captionInput.disabled   = isBusy;
  verzendLabel.hidden     = isBusy;
  btnSpinner.hidden       = !isBusy;
}

function toonStatus(type, tekst) {
  statusMsg.hidden    = false;
  statusMsg.className = `status-msg status-${type}`;
  statusMsg.textContent = tekst;
}

function verbergStatus() {
  statusMsg.hidden      = true;
  statusMsg.className   = 'status-msg';
  statusMsg.textContent = '';
}

function triggerFlash() {
  flashOverlay.classList.remove('flash');
  void flashOverlay.offsetWidth;
  flashOverlay.classList.add('flash');
}

function canvasNaarBlob() {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas kon niet naar afbeelding worden geconverteerd.'));
    }, 'image/jpeg', 0.85);
  });
}
