/* =========================================================
   VV Zaamslag – Diavoorstelling  |  slideshow.js
   ========================================================= */

'use strict';

// =========================================================
// Config
// =========================================================
const SUPABASE_URL      = 'https://knuwdcteeejcdbocchfp.supabase.co';
const SUPABASE_KEY      = 'sb_publishable_7l-5fa-LaIjFMsDO5JK_QA_GBBdSE0l';
const DUUR_PER_FOTO_MS  = 8000;   // hoe lang elke foto zichtbaar is
const VERVERS_INTERVAL  = 5 * 60 * 1000;  // elke 5 min nieuwe foto's ophalen

let supabaseClient = null;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
  console.warn('Supabase initialisatie mislukt:', e);
}

// =========================================================
// DOM-referenties
// =========================================================
const slideA      = document.getElementById('slide-a');
const slideB      = document.getElementById('slide-b');
const progressbar = document.getElementById('progressbar');
const teller      = document.getElementById('teller');
const laadscherm  = document.getElementById('laadscherm');
const leegscherm  = document.getElementById('leegscherm');

// =========================================================
// Staat
// =========================================================
let fotos        = [];
let huidigIndex  = 0;
let actieveSlide = slideA;   // wisselend tussen A en B
let timer        = null;
let progressTimer = null;

// =========================================================
// Opstarten
// =========================================================
laadFotos();
setInterval(laadFotos, VERVERS_INTERVAL);

async function laadFotos() {
  try {
    const { data, error } = await supabaseClient
      .from('inzendingen')
      .select('id, image_url')
      .eq('status', 'goedgekeurd')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const nieuweFotos = data ?? [];

    if (nieuweFotos.length === 0) {
      laadscherm.style.display  = 'none';
      leegscherm.style.display  = 'flex';
      return;
    }

    leegscherm.style.display = 'none';

    // Eerste keer laden: start de slideshow
    if (fotos.length === 0) {
      fotos = nieuweFotos;
      laadscherm.style.display = 'none';
      toonFoto(0);
    } else {
      // Verversen: bewaar huidige positie
      fotos = nieuweFotos;
    }

  } catch (err) {
    console.error('[Slideshow] Laden mislukt:', err);
  }
}

// =========================================================
// Foto tonen met crossfade
// =========================================================
function toonFoto(index) {
  if (fotos.length === 0) return;

  huidigIndex = ((index % fotos.length) + fotos.length) % fotos.length;

  const volgendeSlide = actieveSlide === slideA ? slideB : slideA;
  volgendeSlide.src = fotos[huidigIndex].image_url;

  volgendeSlide.onload = () => {
    // Fade in volgende, fade out huidige
    volgendeSlide.classList.add('actief');
    actieveSlide.classList.remove('actief');
    actieveSlide = volgendeSlide;

    // Teller bijwerken
    teller.textContent = `${huidigIndex + 1} / ${fotos.length}`;

    // Voortgangsbalk animeren
    startProgressbar();

    // Volgende foto inplannen
    clearTimeout(timer);
    timer = setTimeout(() => toonFoto(huidigIndex + 1), DUUR_PER_FOTO_MS);
  };

  // Fallback als afbeelding niet laadt: sla over na 3 sec
  volgendeSlide.onerror = () => {
    clearTimeout(timer);
    timer = setTimeout(() => toonFoto(huidigIndex + 1), 3000);
  };
}

// =========================================================
// Voortgangsbalk
// =========================================================
function startProgressbar() {
  progressbar.style.transition = 'none';
  progressbar.style.width      = '0%';

  // Force reflow zodat de reset zichtbaar is
  void progressbar.offsetWidth;

  progressbar.style.transition = `width ${DUUR_PER_FOTO_MS}ms linear`;
  progressbar.style.width      = '100%';
}
