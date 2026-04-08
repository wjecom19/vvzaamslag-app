/* =========================================================
   VV Zaamslag – Admin  |  admin.js
   ========================================================= */

'use strict';

// =========================================================
// Config
// =========================================================
const SUPABASE_URL = 'https://knuwdcteeejcdbocchfp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7l-5fa-LaIjFMsDO5JK_QA_GBBdSE0l';
const ADMIN_PASS   = 'vvzadmin2024'; // Wijzig dit naar een eigen wachtwoord

let supabaseClient = null;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
  console.warn('Supabase initialisatie mislukt:', e);
}

// =========================================================
// DOM-referenties
// =========================================================
const loginScreen     = document.getElementById('login-screen');
const adminMain       = document.getElementById('admin-main');
const passwordInput   = document.getElementById('password-input');
const loginBtn        = document.getElementById('login-btn');
const loginError      = document.getElementById('login-error');

const loadingState    = document.getElementById('loading-state');
const emptyState      = document.getElementById('empty-state');
const errorState      = document.getElementById('error-state');
const errorText       = document.getElementById('error-text');
const submissionsGrid = document.getElementById('submissions-grid');
const resultCount     = document.getElementById('result-count');
const refreshBtn      = document.getElementById('refresh-btn');
const retryBtn        = document.getElementById('retry-btn');
const downloadZipBtn  = document.getElementById('download-zip-btn');
const filterBtns      = document.querySelectorAll('.filter-btn');

// =========================================================
// Staat
// =========================================================
let allSubmissions = [];
let activeFilter   = 'all';

// =========================================================
// Login
// =========================================================
if (sessionStorage.getItem('vvz_admin') === 'true') {
  openAdmin();
}

loginBtn.addEventListener('click', handleLogin);
passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

function handleLogin() {
  if (passwordInput.value === ADMIN_PASS) {
    sessionStorage.setItem('vvz_admin', 'true');
    loginError.hidden = true;
    openAdmin();
  } else {
    loginError.hidden = false;
    passwordInput.value = '';
    passwordInput.focus();
  }
}

function openAdmin() {
  loginScreen.hidden = true;
  adminMain.hidden   = false;
  laadInzendingen();
}

// =========================================================
// Filters
// =========================================================
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderGrid();
  });
});

refreshBtn.addEventListener('click', laadInzendingen);
retryBtn.addEventListener('click', laadInzendingen);
downloadZipBtn.addEventListener('click', downloadAllesFotos);

// =========================================================
// Data ophalen
// =========================================================
async function laadInzendingen() {
  toonStaat('loading');

  try {
    const { data, error } = await supabaseClient
      .from('inzendingen')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    allSubmissions = data ?? [];
    renderGrid();

  } catch (err) {
    console.error('[Admin] Laden mislukt:', err);
    errorText.textContent = `Laden mislukt: ${err.message}`;
    toonStaat('error');
  }
}

// =========================================================
// Grid opbouwen
// =========================================================
function renderGrid() {
  const zichtbaar = activeFilter === 'all'
    ? allSubmissions
    : allSubmissions.filter(s => s.status === activeFilter);

  submissionsGrid.innerHTML = '';

  if (zichtbaar.length === 0) {
    toonStaat('empty');
    resultCount.textContent = '';
    return;
  }

  toonStaat('grid');
  resultCount.textContent = `${zichtbaar.length} inzending${zichtbaar.length !== 1 ? 'en' : ''}`;
  zichtbaar.forEach(s => submissionsGrid.appendChild(maakKaart(s)));
}

function maakKaart(s) {
  const kaart = document.createElement('div');
  kaart.className = 'submission-card';
  kaart.dataset.id = s.id;

  const datum = new Date(s.created_at).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const statusInfo = {
    pending:     { label: 'In behandeling', cls: 'badge-pending'    },
    goedgekeurd: { label: 'Goedgekeurd',    cls: 'badge-approved'   },
    afgewezen:   { label: 'Afgewezen',      cls: 'badge-rejected'   },
  }[s.status] ?? { label: s.status, cls: 'badge-pending' };

  kaart.innerHTML = `
    <div class="card-image">
      <img src="${s.image_url}" alt="Inzending foto" loading="lazy" />
    </div>
    <div class="card-body">
      <div class="card-badges">
        <span class="template-badge">${s.template_type}</span>
        <span class="status-badge ${statusInfo.cls}">${statusInfo.label}</span>
      </div>
      <p class="card-date">📅 ${datum}</p>
      ${s.status === 'pending' ? `
        <div class="card-actions">
          <button class="btn-approve" data-id="${s.id}">✓ Goedkeuren</button>
          <button class="btn-reject"  data-id="${s.id}">✕ Afwijzen</button>
        </div>
      ` : ''}
      ${s.status === 'goedgekeurd' ? `
        <div class="card-actions">
          <button class="btn-share" data-id="${s.id}" data-url="${s.image_url}" data-type="${s.template_type}">
            ↑ Delen
          </button>
        </div>
      ` : ''}
    </div>
  `;

  kaart.querySelector('.btn-approve')?.addEventListener('click', () => pasStatusAan(s.id, 'goedgekeurd'));
  kaart.querySelector('.btn-reject')?.addEventListener('click',  () => pasStatusAan(s.id, 'afgewezen'));
  kaart.querySelector('.btn-share')?.addEventListener('click',   () => deelFoto(s.id, s.image_url, s.template_type));

  return kaart;
}

// =========================================================
// Status bijwerken
// =========================================================
async function pasStatusAan(id, nieuweStatus) {
  const kaart   = document.querySelector(`[data-id="${id}"]`);
  const actions = kaart?.querySelector('.card-actions');
  if (actions) actions.innerHTML = '<span class="updating-label">Bezig…</span>';

  try {
    const { error } = await supabaseClient
      .from('inzendingen')
      .update({ status: nieuweStatus })
      .eq('id', id);

    if (error) throw error;

    // Lokale staat bijwerken — geen volledige herlaad nodig
    const idx = allSubmissions.findIndex(s => s.id === id);
    if (idx !== -1) allSubmissions[idx].status = nieuweStatus;
    renderGrid();

  } catch (err) {
    console.error('[Admin] Status bijwerken mislukt:', err);
    if (actions) {
      actions.innerHTML = `<span class="update-error">Fout: ${err.message}</span>`;
    }
  }
}

// =========================================================
// Bulk download als ZIP
// =========================================================
async function downloadAllesFotos() {
  const goedgekeurd = allSubmissions.filter(s => s.status === 'goedgekeurd');

  if (goedgekeurd.length === 0) {
    alert('Er zijn nog geen goedgekeurde foto\'s om te downloaden.');
    return;
  }

  downloadZipBtn.disabled   = true;
  downloadZipBtn.title      = 'Bezig…';

  const zip = new JSZip();
  let geslaagd = 0;

  for (let i = 0; i < goedgekeurd.length; i++) {
    const foto = goedgekeurd[i];
    downloadZipBtn.title = `${i + 1} / ${goedgekeurd.length}`;

    try {
      const response = await fetch(foto.image_url);
      if (!response.ok) throw new Error('Niet bereikbaar');
      const blob     = await response.blob();
      const ext      = blob.type.includes('png') ? 'png' : 'jpg';
      const naam     = `${foto.template_type.replace(/\s+/g, '-').toLowerCase()}-${i + 1}.${ext}`;
      zip.file(naam, blob);
      geslaagd++;
    } catch (err) {
      console.warn(`[ZIP] Foto ${i + 1} overgeslagen:`, err.message);
    }
  }

  if (geslaagd === 0) {
    alert('Downloaden mislukt. Controleer je internetverbinding.');
  } else {
    const zipBlob  = await zip.generateAsync({ type: 'blob' });
    const url      = URL.createObjectURL(zipBlob);
    const datum    = new Date().toISOString().slice(0, 10);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = `vvzaamslag-fotos-${datum}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  downloadZipBtn.disabled = false;
  downloadZipBtn.title    = 'Download alle goedgekeurde foto\'s als ZIP';
}

// =========================================================
// Foto delen via Web Share API
// =========================================================
async function deelFoto(id, imageUrl, templateType) {
  const kaart  = document.querySelector(`[data-id="${id}"]`);
  const btn    = kaart?.querySelector('.btn-share');

  if (btn) {
    btn.disabled     = true;
    btn.textContent  = 'Bezig…';
  }

  try {
    // Afbeelding ophalen als blob (vereist voor Web Share met bestand)
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Afbeelding kon niet worden opgehaald.');
    const blob = await response.blob();
    const bestand = new File([blob], `vv-zaamslag-${templateType.toLowerCase().replace(' ', '-')}.png`, {
      type: 'image/png',
    });

    const deelData = {
      title: `VV Zaamslag – ${templateType}`,
      text:  '⚽ Bekijk deze foto van VV Zaamslag! #VVZaamslag',
      files: [bestand],
    };

    // Web Share API met bestand (mobiel) — anders: gewoon downloaden
    if (navigator.canShare && navigator.canShare(deelData)) {
      await navigator.share(deelData);
    } else if (navigator.share) {
      // Bestand niet ondersteund (bijv. desktop Chrome) — deel alleen URL
      await navigator.share({ title: deelData.title, text: deelData.text, url: imageUrl });
    } else {
      // Geen Web Share API — download als fallback
      const link    = document.createElement('a');
      link.href     = imageUrl;
      link.download = bestand.name;
      link.click();
    }

  } catch (err) {
    // Gebruiker heeft geannuleerd — geen foutmelding tonen
    if (err.name !== 'AbortError') {
      console.error('[Delen]', err);
      alert(`Delen mislukt: ${err.message}`);
    }

  } finally {
    if (btn) {
      btn.disabled    = false;
      btn.textContent = '↑ Delen';
    }
  }
}

// =========================================================
// UI-staat wisselen
// =========================================================
function toonStaat(staat) {
  loadingState.hidden    = staat !== 'loading';
  emptyState.hidden      = staat !== 'empty';
  errorState.hidden      = staat !== 'error';
  submissionsGrid.hidden = staat !== 'grid';
}
