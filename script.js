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
  let w = img.naturalWidth;
  let h = img.naturalHeight;

  if (w > MAX_W) {
    h = Math.round(h * MAX_W / w);
    w = MAX_W;
  }

  canvas.width  = w;
  canvas.height = h;

  // 1. Foto
  ctx.drawImage(img, 0, 0, w, h);

  // 2. Gradient onderaan
  tekenGradient(w, h);

  // 3. Branding + onderschrift
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
  const padding    = w * 0.04;
  const onderrand  = h - Math.round(h * 0.03);

  // VV Zaamslag branding (altijd aanwezig)
  const brandSize  = Math.round(h * 0.038);
  ctx.save();
  ctx.fillStyle    = '#a2c626';
  ctx.font         = `800 ${brandSize}px 'Inter', Arial, sans-serif`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('VV ZAAMSLAG', padding, onderrand);
  ctx.restore();

  // Onderschrift (optioneel)
  if (!caption) return;

  const captionSize = Math.round(h * 0.058);
  const captionY    = onderrand - brandSize - Math.round(h * 0.02);

  ctx.save();
  ctx.fillStyle      = '#ffffff';
  ctx.font           = `700 ${captionSize}px 'Inter', Arial, sans-serif`;
  ctx.textAlign      = 'center';
  ctx.textBaseline   = 'bottom';
  ctx.shadowColor    = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur     = 10;
  ctx.shadowOffsetY  = 2;

  // Lange tekst afkappen met ellipsis als het niet past
  const maxWidth = w - padding * 2;
  const tekst    = kapTekstAf(ctx, caption, maxWidth);
  ctx.fillText(tekst, w / 2, captionY);
  ctx.restore();
}

function kapTekstAf(context, tekst, maxWidth) {
  if (context.measureText(tekst).width <= maxWidth) return tekst;
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
