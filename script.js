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

const deelBtn        = document.getElementById('deel-btn');
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
let panX = 0, panY = 0;          // verschuiving in bronafbeelding-pixels
let isDragging = false;
let lastX = 0, lastY = 0;

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
      initPan();
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
// 2. Canvas tekenen: foto (9:16 Instagram Story) + gradient + branding
// =========================================================
const W = 1080;
const H = 1920;

function berekenSchaal(img) {
  return Math.max(W / img.naturalWidth, H / img.naturalHeight);
}

function initPan() {
  const scale = berekenSchaal(loadedImage);
  const sw = W / scale;
  const sh = H / scale;
  panX = (loadedImage.naturalWidth  - sw) / 2;
  panY = (loadedImage.naturalHeight - sh) / 2;
}

function renderCanvas() {
  const img   = loadedImage;
  const dpr   = Math.min(window.devicePixelRatio || 1, 3);
  const scale = berekenSchaal(img);
  const sw    = W / scale;
  const sh    = H / scale;

  canvas.width        = W * dpr;
  canvas.height       = H * dpr;
  canvas.style.width  = '100%';
  canvas.style.height = 'auto';

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(img, panX, panY, sw, sh, 0, 0, W, H);

  tekenGradient();
  tekenBranding();
}

// =========================================================
// 3. Slepen om bijsnijpositie te kiezen
// =========================================================
function getEventPos(e) {
  return e.touches
    ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
    : { x: e.clientX, y: e.clientY };
}

canvas.addEventListener('mousedown',  e => { isDragging = true; const p = getEventPos(e); lastX = p.x; lastY = p.y; });
canvas.addEventListener('touchstart', e => { isDragging = true; const p = getEventPos(e); lastX = p.x; lastY = p.y; }, { passive: true });

canvas.addEventListener('mousemove',  onDrag);
canvas.addEventListener('touchmove',  onDrag, { passive: false });

canvas.addEventListener('mouseup',    () => isDragging = false);
canvas.addEventListener('mouseleave', () => isDragging = false);
canvas.addEventListener('touchend',   () => isDragging = false);

function onDrag(e) {
  if (!isDragging || !loadedImage) return;
  if (e.cancelable) e.preventDefault();

  const pos = getEventPos(e);
  const dx  = pos.x - lastX;
  const dy  = pos.y - lastY;
  lastX = pos.x;
  lastY = pos.y;

  const scale = berekenSchaal(loadedImage);
  const sw    = W / scale;
  const sh    = H / scale;
  const rect  = canvas.getBoundingClientRect();

  // CSS-pixels omzetten naar bronafbeelding-pixels
  panX -= dx * sw / rect.width;
  panY -= dy * sh / rect.height;

  // Niet buiten de afbeelding schuiven
  panX = Math.max(0, Math.min(loadedImage.naturalWidth  - sw, panX));
  panY = Math.max(0, Math.min(loadedImage.naturalHeight - sh, panY));

  renderCanvas();
}

function tekenGradient() {
  const gradH    = Math.round(H * 0.25);
  const gradient = ctx.createLinearGradient(0, H - gradH, 0, H);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.50)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, H - gradH, W, gradH);
}

function tekenBranding() {
  const padding   = Math.round(W * 0.05);
  const onderrand = H - Math.round(H * 0.025);
  const fontSize  = Math.round(W * 0.038);  // ~41px op 1080px breed

  ctx.save();
  ctx.fillStyle    = '#a2c626';
  ctx.font         = `800 ${fontSize}px Inter, Arial, sans-serif`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'bottom';
  ctx.shadowColor  = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur   = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillText('VV ZAAMSLAG', padding, onderrand);
  ctx.restore();
}


// =========================================================
// 4. Direct opslaan / delen (naar Instagram etc.)
// =========================================================
deelBtn.addEventListener('click', async () => {
  if (!loadedImage) return;
  const blob    = await canvasNaarBlob();
  const bestand = new File([blob], 'vv-zaamslag.jpg', { type: 'image/jpeg' });

  if (navigator.canShare && navigator.canShare({ files: [bestand] })) {
    await navigator.share({ files: [bestand] });
  } else {
    // Fallback: download
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = 'vv-zaamslag.jpg';
    link.click();
    URL.revokeObjectURL(url);
  }
});

// =========================================================
// 5. Verzenden naar Supabase
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
