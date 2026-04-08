/* =========================================================
   VV Zaamslag – Fotogalerij  |  gallery.js
   ========================================================= */

'use strict';

// =========================================================
// Supabase initialisatie
// =========================================================
const SUPABASE_URL = 'https://knuwdcteeejcdbocchfp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7l-5fa-LaIjFMsDO5JK_QA_GBBdSE0l';

let supabaseClient = null;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
  console.warn('Supabase initialisatie mislukt:', e);
}

const ADMIN_PASS = 'vvzadmin2024'; // Zelfde wachtwoord als admin.html

// =========================================================
// DOM-referenties
// =========================================================
const loginScreen   = document.getElementById('login-screen');
const galleryMain   = document.getElementById('gallery-main');
const passwordInput = document.getElementById('password-input');
const loginBtn      = document.getElementById('login-btn');
const loginError    = document.getElementById('login-error');

const loadingState  = document.getElementById('loading-state');
const emptyState    = document.getElementById('empty-state');
const errorState    = document.getElementById('error-state');
const errorText     = document.getElementById('error-text');
const galleryGrid   = document.getElementById('gallery-grid');
const galleryCta    = document.getElementById('gallery-cta');
const resultCount   = document.getElementById('result-count');
const retryBtn      = document.getElementById('retry-btn');
const filterBtns    = document.querySelectorAll('.filter-btn');

// =========================================================
// Staat
// =========================================================
let allFotos     = [];
let activeFilter = 'all';

// =========================================================
// Login (hergebruikt sessie van admin indien al ingelogd)
// =========================================================
if (sessionStorage.getItem('vvz_admin') === 'true') {
  openGalerij();
}

loginBtn.addEventListener('click', handleLogin);
passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

function handleLogin() {
  if (passwordInput.value === ADMIN_PASS) {
    sessionStorage.setItem('vvz_admin', 'true');
    loginError.hidden = true;
    openGalerij();
  } else {
    loginError.hidden = false;
    passwordInput.value = '';
    passwordInput.focus();
  }
}

function openGalerij() {
  loginScreen.hidden = true;
  galleryMain.hidden = false;
  laadFotos();
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

retryBtn.addEventListener('click', laadFotos);

async function laadFotos() {
  toonStaat('loading');

  try {
    const { data, error } = await supabaseClient
      .from('inzendingen')
      .select('id, image_url, template_type, created_at')
      .eq('status', 'goedgekeurd')
      .order('created_at', { ascending: false });

    if (error) throw error;

    allFotos = data ?? [];
    renderGrid();

  } catch (err) {
    console.error('[Galerij] Laden mislukt:', err);
    errorText.textContent = `Laden mislukt: ${err.message}`;
    toonStaat('error');
  }
}

// =========================================================
// Grid renderen
// =========================================================
function renderGrid() {
  const zichtbaar = activeFilter === 'all'
    ? allFotos
    : allFotos.filter(f => f.template_type === activeFilter);

  galleryGrid.innerHTML = '';

  if (zichtbaar.length === 0) {
    toonStaat('empty');
    resultCount.textContent = '';
    return;
  }

  toonStaat('grid');
  resultCount.textContent = `${zichtbaar.length} foto${zichtbaar.length !== 1 ? "'s" : ''}`;
  zichtbaar.forEach(foto => galleryGrid.appendChild(maakKaart(foto)));
}

function maakKaart(foto) {
  const kaart = document.createElement('a');
  kaart.className  = 'gallery-card';
  kaart.href       = foto.image_url;
  kaart.target     = '_blank';
  kaart.rel        = 'noopener noreferrer';
  kaart.title      = `${foto.template_type} — bekijk volledige foto`;

  kaart.innerHTML = `
    <div class="gallery-card-img">
      <img src="${foto.image_url}" alt="${foto.template_type}" loading="lazy" />
    </div>
    <div class="gallery-card-footer">
      <span class="template-badge">${foto.template_type}</span>
    </div>
  `;

  return kaart;
}

// =========================================================
// UI-staat wisselen
// =========================================================
function toonStaat(staat) {
  loadingState.hidden  = staat !== 'loading';
  emptyState.hidden    = staat !== 'empty';
  errorState.hidden    = staat !== 'error';
  galleryGrid.hidden   = staat !== 'grid';
  galleryCta.hidden    = staat !== 'grid';
}
