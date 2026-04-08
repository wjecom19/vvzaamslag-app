/* =========================================================
   VV Zaamslag – Foto App  |  script.js
   ========================================================= */

// =========================================================
// Supabase initialisatie
// supabase is beschikbaar als globale variabele via de CDN-tag in index.html
// =========================================================
const SUPABASE_URL = 'https://knuwdcteeejcdbocchfp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7l-5fa-LaIjFMsDO5JK_QA_GBBdSE0l';
const BUCKET       = 'fotos';

// Niet-fatale initialisatie: als de CDN niet laadt blijft de rest van de app werken
let supabaseClient = null;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
  console.warn('Supabase kon niet worden geïnitialiseerd:', e.message);
}

// --- DOM-referenties ---
const photoInput     = document.getElementById('photo-input');
const canvas         = document.getElementById('canvas');
const ctx            = canvas.getContext('2d');
const stepUpload     = document.getElementById('step-upload');
const stepPreview    = document.getElementById('step-preview');
const verzendBtn     = document.getElementById('verzend-btn');
const verzendLabel   = document.getElementById('verzend-label');
const btnSpinner     = document.getElementById('btn-spinner');
const statusMsg      = document.getElementById('status-msg');
const changePhotoBtn = document.getElementById('change-photo-btn');
const templateBtns   = document.querySelectorAll('.template-btn');
const flashOverlay   = document.getElementById('flash-overlay');

// --- Staat ---
let activeTemplate = null;   // null | 'eerste' | 'jeugd'
let loadedImage    = null;

// =========================================================
// 1. Template selectie → stap 2 zichtbaar maken
// =========================================================
templateBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    templateBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTemplate = btn.dataset.template;

    // Toon camera-stap als die nog verborgen is
    if (stepUpload.hidden) {
      stepUpload.hidden = false;
      stepUpload.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Herteken canvas als er al een foto geladen is
    if (loadedImage) renderCanvas();
  });
});

// =========================================================
// 2. Foto inladen (camera of galerij)
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

// "Andere foto" knop hergebruikt het verborgen input-element
changePhotoBtn.addEventListener('click', () => photoInput.click());

// =========================================================
// 3. Canvas renderen: foto + template overlay
// =========================================================
function renderCanvas() {
  const img = loadedImage;

  // Schaal naar maximaal 1080 px breed, behoud verhouding
  const MAX_W = 1080;
  let w = img.naturalWidth;
  let h = img.naturalHeight;

  if (w > MAX_W) {
    h = Math.round(h * MAX_W / w);
    w = MAX_W;
  }

  canvas.width  = w;
  canvas.height = h;

  // Stap 1: foto tekenen
  ctx.drawImage(img, 0, 0, w, h);

  // Stap 2: template overlay tekenen
  if (activeTemplate === 'eerste') {
    drawEersteElftal(w, h);
  } else {
    drawJeugd(w, h);
  }
}

// =========================================================
// 4. Template: Eerste Elftal
//    - Halftransparante groene rand rondom
//    - Groene banner onderaan met "VV Zaamslag 1"
//    - Groene hoekaccenten
// =========================================================
function drawEersteElftal(w, h) {
  const border     = Math.round(Math.min(w, h) * 0.025);
  const bannerH    = Math.round(h * 0.13);
  const cornerSize = Math.round(Math.min(w, h) * 0.1);

  // Halftransparante rand
  ctx.save();
  ctx.globalAlpha   = 0.55;
  ctx.strokeStyle   = '#a8ca35';
  ctx.lineWidth     = border * 2;
  ctx.strokeRect(border, border, w - border * 2, h - border * 2);
  ctx.restore();

  // Hoekaccenten (ondoorzichtig)
  drawCornerAccents(w, h, cornerSize, border, 0.9);

  // Onderste banner
  ctx.save();
  ctx.globalAlpha = 0.80;
  ctx.fillStyle   = '#a8ca35';
  ctx.fillRect(0, h - bannerH, w, bannerH);
  ctx.restore();

  // Tekst op banner
  const fontSize = Math.round(bannerH * 0.52);
  ctx.save();
  ctx.globalAlpha     = 1;
  ctx.fillStyle       = '#ffffff';
  ctx.font            = `800 ${fontSize}px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign       = 'center';
  ctx.textBaseline    = 'middle';

  // Lichte slagschaduw voor leesbaarheid
  ctx.shadowColor     = 'rgba(0,0,0,0.35)';
  ctx.shadowOffsetY   = 2;
  ctx.shadowBlur      = 4;

  ctx.fillText('VV ZAAMSLAG 1', w / 2, h - bannerH / 2);
  ctx.restore();
}

// =========================================================
// 5. Template: Jeugd
//    - Groene rand (iets voller)
//    - Bovenste banner met "VV ZAAMSLAG"
//    - Onderste banner met "JEUGD"
//    - Subtiele ster-decoraties
// =========================================================
function drawJeugd(w, h) {
  const border  = Math.round(Math.min(w, h) * 0.025);
  const bannerH = Math.round(h * 0.12);

  // Rand
  ctx.save();
  ctx.globalAlpha = 0.80;
  ctx.strokeStyle = '#a8ca35';
  ctx.lineWidth   = border * 2;
  ctx.strokeRect(border, border, w - border * 2, h - border * 2);
  ctx.restore();

  // Tweede, dunnere binnenkant rand
  ctx.save();
  ctx.globalAlpha = 0.40;
  ctx.strokeStyle = '#a8ca35';
  ctx.lineWidth   = Math.round(border * 0.5);
  const inset     = border * 3;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.restore();

  // Bovenste banner
  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.fillStyle   = '#a8ca35';
  ctx.fillRect(0, 0, w, bannerH);
  ctx.restore();

  // Onderste banner
  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.fillStyle   = '#a8ca35';
  ctx.fillRect(0, h - bannerH, w, bannerH);
  ctx.restore();

  const fontSize = Math.round(bannerH * 0.50);

  // Boventekst: "VV ZAAMSLAG"
  ctx.save();
  ctx.globalAlpha   = 1;
  ctx.fillStyle     = '#ffffff';
  ctx.font          = `800 ${fontSize}px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.shadowColor   = 'rgba(0,0,0,0.3)';
  ctx.shadowOffsetY = 2;
  ctx.shadowBlur    = 4;
  ctx.fillText('VV ZAAMSLAG', w / 2, bannerH / 2);
  ctx.restore();

  // Ondertekst: "JEUGD"
  ctx.save();
  ctx.globalAlpha   = 1;
  ctx.fillStyle     = '#ffffff';
  ctx.font          = `800 ${fontSize}px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.shadowColor   = 'rgba(0,0,0,0.3)';
  ctx.shadowOffsetY = 2;
  ctx.shadowBlur    = 4;
  ctx.fillText('JEUGD', w / 2, h - bannerH / 2);
  ctx.restore();

  // Sterrenmotief links en rechts van de teksten
  drawStar(ctx, w * 0.12, bannerH / 2, bannerH * 0.22, 0.9);
  drawStar(ctx, w * 0.88, bannerH / 2, bannerH * 0.22, 0.9);
  drawStar(ctx, w * 0.12, h - bannerH / 2, bannerH * 0.22, 0.9);
  drawStar(ctx, w * 0.88, h - bannerH / 2, bannerH * 0.22, 0.9);
}

// =========================================================
// Hulpfuncties
// =========================================================

/**
 * Teken vier L-vormige hoekaccenten.
 */
function drawCornerAccents(w, h, size, thickness, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#a8ca35';
  ctx.lineWidth   = thickness * 1.5;
  ctx.lineCap     = 'square';

  const corners = [
    // [startX, startY, hX, hY, vX, vY]
    [0, 0, size, 0, 0, size],
    [w, 0, w - size, 0, w, size],
    [0, h, size, h, 0, h - size],
    [w, h, w - size, h, w, h - size],
  ];

  corners.forEach(([sx, sy, hx, hy, vx, vy]) => {
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(sx, sy);
    ctx.lineTo(vx, vy);
    ctx.stroke();
  });

  ctx.restore();
}

/**
 * Teken een vijfpuntige ster.
 * @param {CanvasRenderingContext2D} context
 * @param {number} cx - middelpunt x
 * @param {number} cy - middelpunt y
 * @param {number} r  - buitenste straal
 * @param {number} alpha - transparantie
 */
function drawStar(context, cx, cy, r, alpha) {
  const spikes  = 5;
  const inner   = r * 0.42;
  let   angle   = -Math.PI / 2;
  const step    = Math.PI / spikes;

  context.save();
  context.globalAlpha = alpha;
  context.fillStyle   = '#ffffff';
  context.shadowColor = 'rgba(0,0,0,0.25)';
  context.shadowBlur  = 3;

  context.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? r : inner;
    context.lineTo(
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius
    );
    angle += step;
  }
  context.closePath();
  context.fill();
  context.restore();
}

// =========================================================
// 6. Verzenden: upload naar Supabase Storage + rij in tabel
// =========================================================
verzendBtn.addEventListener('click', verzendFoto);

async function verzendFoto() {
  if (!loadedImage) return;

  // Controleer of Supabase geladen is
  if (!supabaseClient) {
    toonStatus('error', 'Verbinding met de server niet beschikbaar. Herlaad de pagina en probeer opnieuw.');
    return;
  }

  // Controleer internetverbinding
  if (!navigator.onLine) {
    toonStatus('error', 'Geen internetverbinding. Controleer je verbinding en probeer opnieuw.');
    return;
  }

  setBusy(true);
  toonStatus('loading', 'Bezig met verzenden…');

  try {
    // --- Stap 1: canvas → blob ---
    const blob = await canvasNaarBlob();

    // --- Stap 2: unieke bestandsnaam & upload naar bucket ---
    const templateSlug = activeTemplate === 'eerste' ? 'eerste' : 'jeugd';
    const bestandsnaam = `vvz-${templateSlug}-${Date.now()}.jpg`;

    const { error: uploadError } = await supabaseClient
      .storage
      .from(BUCKET)
      .upload(bestandsnaam, blob, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) throw new Error(`Upload mislukt: ${uploadError.message}`);

    // --- Stap 3: publieke URL ophalen ---
    const { data: urlData } = supabaseClient
      .storage
      .from(BUCKET)
      .getPublicUrl(bestandsnaam);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) throw new Error('Publieke URL kon niet worden opgehaald.');

    // --- Stap 4: rij toevoegen aan tabel 'inzendingen' ---
    const templateLabel = activeTemplate === 'eerste' ? 'Eerste Elftal' : 'Jeugd';

    const { error: dbError } = await supabaseClient
      .from('inzendingen')
      .insert({
        image_url:     publicUrl,
        template_type: templateLabel,
        status:        'pending',
      });

    if (dbError) throw new Error(`Database-fout: ${dbError.message}`);

    // --- Succes ---
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
// UI-hulpfuncties
// =========================================================

/** Zet de knop in laad-modus (of zet hem terug). */
function setBusy(isBusy) {
  verzendBtn.disabled     = isBusy;
  changePhotoBtn.disabled = isBusy;
  verzendLabel.hidden     = isBusy;
  btnSpinner.hidden       = !isBusy;
}

/** Camera-flits: kort wit scherm als visuele bevestiging. */
function triggerFlash() {
  flashOverlay.classList.remove('flash');
  void flashOverlay.offsetWidth; // force reflow zodat animatie herstart
  flashOverlay.classList.add('flash');
}

/**
 * Toon een status-melding boven de knoppen.
 * @param {'loading'|'success'|'error'} type
 * @param {string} tekst
 */
function toonStatus(type, tekst) {
  statusMsg.hidden    = false;
  statusMsg.className = `status-msg status-${type}`;
  statusMsg.textContent = tekst;
}

/** Verberg de status-melding (bijv. bij nieuwe upload). */
function verbergStatus() {
  statusMsg.hidden    = true;
  statusMsg.className = 'status-msg';
  statusMsg.textContent = '';
}

/**
 * Geeft een Promise terug met het canvas als PNG-blob.
 * @returns {Promise<Blob>}
 */
function canvasNaarBlob() {
  return new Promise((resolve, reject) => {
    // JPEG met 85% kwaliteit — reduceert een telefoonFoto van ~8MB naar ~300-600KB
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas kon niet naar afbeelding worden geconverteerd.'));
    }, 'image/jpeg', 0.85);
  });
}
