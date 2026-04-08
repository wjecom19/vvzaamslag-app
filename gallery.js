/* =========================================================
   VV Zaamslag – Galerij + Diavoorstelling  |  gallery.js
   ========================================================= */

'use strict';

// =========================================================
// Config
// =========================================================
const SUPABASE_URL     = 'https://knuwdcteeejcdbocchfp.supabase.co';
const SUPABASE_KEY     = 'sb_publishable_7l-5fa-LaIjFMsDO5JK_QA_GBBdSE0l';
const DUUR_PER_FOTO_MS = 8000;
const VERVERS_MS       = 5 * 60 * 1000;

let supabaseClient = null;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
  console.warn('Supabase initialisatie mislukt:', e);
}

// =========================================================
// Modus bepalen: galerij of diavoorstelling
// =========================================================
const isSlideshowModus = new URLSearchParams(window.location.search).has('slideshow');

if (isSlideshowModus) {
  startSlideshowModus();
} else {
  startGalerijModus();
}

// =========================================================
// DIAVOORSTELLING
// =========================================================
function startSlideshowModus() {
  document.getElementById('slideshow-overlay').hidden = false;
  document.querySelector('header').hidden             = true;
  document.getElementById('gallery-main').hidden      = true;

  let fotos       = [];
  let index       = 0;
  let actief      = document.getElementById('slide-a');
  let timer       = null;

  const slideA      = document.getElementById('slide-a');
  const slideB      = document.getElementById('slide-b');
  const teller      = document.getElementById('ss-teller');
  const progressbar = document.getElementById('ss-progressbar');
  const laadscherm  = document.getElementById('ss-laadscherm');
  const leegscherm  = document.getElementById('ss-leeg');

  laadFotosVoorSlideshow();
  setInterval(laadFotosVoorSlideshow, VERVERS_MS);

  async function laadFotosVoorSlideshow() {
    try {
      const { data, error } = await supabaseClient
        .from('inzendingen')
        .select('id, image_url')
        .eq('status', 'goedgekeurd')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const nieuw = data ?? [];

      if (nieuw.length === 0) {
        laadscherm.hidden = true;
        leegscherm.hidden = false;
        return;
      }

      leegscherm.hidden = true;

      if (fotos.length === 0) {
        fotos = nieuw;
        laadscherm.hidden = true;
        toonFoto(0);
      } else {
        fotos = nieuw;
      }
    } catch (err) {
      console.error('[Slideshow]', err);
    }
  }

  function toonFoto(i) {
    if (fotos.length === 0) return;
    index = ((i % fotos.length) + fotos.length) % fotos.length;

    const volgend = actief === slideA ? slideB : slideA;
    volgend.src = fotos[index].image_url;

    volgend.onload = () => {
      volgend.classList.add('actief');
      actief.classList.remove('actief');
      actief = volgend;

      teller.textContent = `${index + 1} / ${fotos.length}`;
      animeerProgressbar();

      clearTimeout(timer);
      timer = setTimeout(() => toonFoto(index + 1), DUUR_PER_FOTO_MS);
    };

    volgend.onerror = () => {
      clearTimeout(timer);
      timer = setTimeout(() => toonFoto(index + 1), 3000);
    };
  }

  function animeerProgressbar() {
    progressbar.style.transition = 'none';
    progressbar.style.width      = '0%';
    void progressbar.offsetWidth;
    progressbar.style.transition = `width ${DUUR_PER_FOTO_MS}ms linear`;
    progressbar.style.width      = '100%';
  }
}

// =========================================================
// GALERIJ
// =========================================================
function startGalerijModus() {
  const loadingState = document.getElementById('loading-state');
  const emptyState   = document.getElementById('empty-state');
  const errorState   = document.getElementById('error-state');
  const errorText    = document.getElementById('error-text');
  const galleryGrid  = document.getElementById('gallery-grid');
  const galleryCta   = document.getElementById('gallery-cta');
  const resultCount  = document.getElementById('result-count');
  const retryBtn     = document.getElementById('retry-btn');
  const refreshBtn   = document.getElementById('refresh-btn');
  const filterBtns   = document.querySelectorAll('.filter-btn');

  let allFotos     = [];
  let activeFilter = 'all';

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderGrid();
    });
  });

  refreshBtn.addEventListener('click', laadFotos);
  retryBtn.addEventListener('click', laadFotos);

  laadFotos();

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
      errorText.textContent = `Laden mislukt: ${err.message}`;
      toonStaat('error');
    }
  }

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
    const kaart      = document.createElement('a');
    kaart.className  = 'gallery-card';
    kaart.href       = foto.image_url;
    kaart.target     = '_blank';
    kaart.rel        = 'noopener noreferrer';
    kaart.innerHTML  = `
      <div class="gallery-card-img">
        <img src="${foto.image_url}" alt="${foto.template_type}" loading="lazy" />
      </div>
      <div class="gallery-card-footer">
        <span class="template-badge">${foto.template_type}</span>
      </div>
    `;
    return kaart;
  }

  function toonStaat(staat) {
    loadingState.hidden = staat !== 'loading';
    emptyState.hidden   = staat !== 'empty';
    errorState.hidden   = staat !== 'error';
    galleryGrid.hidden  = staat !== 'grid';
    galleryCta.hidden   = staat !== 'grid';
  }
}
