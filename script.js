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
// 2. Canvas tekenen: foto (1:1 Instagram) + gradient + branding
// =========================================================
function renderCanvas() {
  const img  = loadedImage;
  const SIZE = 1080;  // Instagram vierkant

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width        = SIZE * dpr;
  canvas.height       = SIZE * dpr;
  canvas.style.width  = '100%';
  canvas.style.height = 'auto';

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Middenbijsnijden naar vierkant
  const src = Math.min(img.naturalWidth, img.naturalHeight);
  const sx  = (img.naturalWidth  - src) / 2;
  const sy  = (img.naturalHeight - src) / 2;
  ctx.drawImage(img, sx, sy, src, src, 0, 0, SIZE, SIZE);

  tekenGradient(SIZE);
  tekenBranding(SIZE);
}

function tekenGradient(size) {
  const gradH    = Math.round(size * 0.28);
  const gradient = ctx.createLinearGradient(0, size - gradH, 0, size);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, size - gradH, size, gradH);
}

function tekenBranding(size) {
  const padding   = Math.round(size * 0.04);
  const onderrand = size - Math.round(size * 0.03);
  const fontSize  = Math.min(Math.round(size * 0.024), 22);

  ctx.save();
  ctx.fillStyle    = '#a2c626';
  ctx.font         = `800 ${fontSize}px Inter, Arial, sans-serif`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('VV ZAAMSLAG', padding, onderrand);
  ctx.restore();
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
        status:    'pending',
      });

    if (dbError) throw new Error(`Database-fout: ${dbError.message}`);

    toonStatus('success', 'Foto succesvol verzonden naar de admin!');

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
