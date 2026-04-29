'use strict';
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/* ── State ── */
let pf = null;
let totalPgs = 0;
let curPg = 0;
const pageTexts = [];
let pgW = 500, pgH = 707;
const FIXED_W = 1200;
let fixedH = 734;

/* ══════════════════════════════════════
   LOAD & RENDER PDF
══════════════════════════════════════ */
async function loadPDF() {
  const loadingTask = pdfjsLib.getDocument({ url: 'vision2035.pdf', cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/', cMapPacked: true });
  const pdf = await loadingTask.promise;
  totalPgs = pdf.numPages;

  const hiImages = [];
  const thumbCanvases = [];

  for (let i = 1; i <= totalPgs; i++) {
    const page = await pdf.getPage(i);

    if (i === 1) {
      const vp0 = page.getViewport({ scale: 1 });
      pgW = vp0.width;
      pgH = vp0.height;
    }

    try {
      const tc = await page.getTextContent();
      pageTexts.push(tc.items.map(it => it.str).join(' '));
    } catch { pageTexts.push(''); }

    const scale = Math.min(1.5, (FIXED_W * 1.5) / pgW);
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    hiImages.push(c.toDataURL('image/jpeg', 0.92));

    const tvp = page.getViewport({ scale: 0.35 });
    const tc2 = document.createElement('canvas');
    tc2.width = tvp.width; tc2.height = tvp.height;
    await page.render({ canvasContext: tc2.getContext('2d'), viewport: tvp }).promise;
    thumbCanvases.push(tc2);

    const pct = Math.round((i / totalPgs) * 100);
    document.getElementById('lFill').style.width = pct + '%';
    document.getElementById('lTxt').textContent = `문서를 불러오는 중... ${pct}%`;
  }

  initFlipbook(hiImages);
  initThumbnails(thumbCanvases);
  initDots();
  hideLoader();
}

/* ══════════════════════════════════════
   FLIPBOOK (StPageFlip)
══════════════════════════════════════ */
function initFlipbook(images) {
  fixedH = Math.round(FIXED_W * pgH / pgW);

  pf = new St.PageFlip(document.getElementById('book'), {
    width: FIXED_W,
    height: fixedH,
    size: 'fixed',
    maxShadowOpacity: 0.55,
    showCover: true,
    mobileScrollSupport: false,
    usePortrait: true,
    startPage: 0,
    drawShadow: true,
    flippingTime: 700,
    useMouseEvents: true,
    swipeDistance: 25,
    clickEventForward: true,
  });

  pf.loadFromImages(images);

  pf.on('flip', e => {
    curPg = e.data;
    updateUI();
  });
}

function hideLoader() {
  const lo = document.getElementById('loader');
  lo.classList.add('hide');
  setTimeout(() => { lo.style.display = 'none'; }, 650);
  document.getElementById('btnPrev').disabled = false;
  document.getElementById('btnNext').disabled = false;
  updateUI();
  setTimeout(autoFit, 200);
}

/* ══════════════════════════════════════
   NAVIGATION
══════════════════════════════════════ */
function prevPg() { pf?.flipPrev('bottom'); }
function nextPg() { pf?.flipNext('bottom'); }
function goTo(idx) { pf?.flip(idx, 'bottom'); }

function updateUI() {
  document.getElementById('pgInd').textContent = (curPg + 1) + ' / ' + totalPgs;
  document.getElementById('btnPrev').disabled = !pf || curPg === 0;
  document.getElementById('btnNext').disabled = !pf || curPg >= totalPgs - 1;
  document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('on', i === curPg));
  document.querySelectorAll('.titem').forEach((el, i) => el.classList.toggle('on', i === curPg));
  const active = document.querySelector('#tList .titem.on');
  if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function initDots() {
  const el = document.getElementById('dots');
  el.innerHTML = '';
  if (totalPgs > 20) return;
  for (let i = 0; i < totalPgs; i++) {
    const d = document.createElement('div');
    d.className = 'dot' + (i === 0 ? ' on' : '');
    d.onclick = () => goTo(i);
    el.appendChild(d);
  }
}

/* ══════════════════════════════════════
   THUMBNAILS
══════════════════════════════════════ */
function initThumbnails(canvases) {
  const list = document.getElementById('tList');
  canvases.forEach((cv, i) => {
    const item = document.createElement('div');
    item.className = 'titem' + (i === 0 ? ' on' : '');
    item.onclick = () => { goTo(i); toggleThumb(); };
    item.appendChild(cv);
    const lbl = document.createElement('div');
    lbl.className = 'tlbl';
    lbl.textContent = i + 1;
    item.appendChild(lbl);
    list.appendChild(item);
  });
}

function toggleThumb() {
  document.getElementById('tDrawer').classList.toggle('on');
  document.getElementById('tOverlay').classList.toggle('on');
  document.getElementById('btnThumb').classList.toggle('on');
}

/* ══════════════════════════════════════
   ZOOM
══════════════════════════════════════ */
const ZOOMS = [0.3, 0.4, 0.5, 0.65, 0.75, 0.85, 1, 1.2, 1.4, 1.7];
let zIdx = 6;

function applyZoom() {
  const z = ZOOMS[zIdx];
  document.getElementById('bwrap').style.transform = `scale(${z})`;
  document.getElementById('zLvl').textContent = Math.round(z * 100) + '%';
}

function zoomChg(dir) {
  zIdx = Math.max(0, Math.min(ZOOMS.length - 1, zIdx + dir));
  applyZoom();
}

function autoFit() {
  const stage = document.getElementById('stage');
  const sw = stage.clientWidth - 40;
  const sh = stage.clientHeight - 20;
  const scale = Math.min(sw / FIXED_W, sh / fixedH, 1.0);
  let best = 0;
  ZOOMS.forEach((z, i) => { if (Math.abs(z - scale) < Math.abs(ZOOMS[best] - scale)) best = i; });
  zIdx = best;
  applyZoom();
}

/* ══════════════════════════════════════
   SEARCH
══════════════════════════════════════ */
let srchMatches = [], srchIdx = 0;

function toggleSearch() {
  const p = document.getElementById('srchPanel');
  p.classList.toggle('on');
  document.getElementById('btnSrch').classList.toggle('on');
  if (p.classList.contains('on')) {
    document.getElementById('srchInp').focus();
  } else {
    document.getElementById('srchInp').value = '';
    document.getElementById('srchCnt').textContent = '';
    srchMatches = [];
  }
}

function doSearch(q) {
  srchMatches = []; srchIdx = 0;
  const s = q.trim();
  if (!s) { document.getElementById('srchCnt').textContent = ''; return; }

  const n = parseInt(s, 10);
  if (!isNaN(n) && n >= 1 && n <= totalPgs) {
    srchMatches = [n - 1];
  } else {
    pageTexts.forEach((txt, i) => {
      if (txt.toLowerCase().includes(s.toLowerCase())) srchMatches.push(i);
    });
  }

  if (srchMatches.length) {
    document.getElementById('srchCnt').textContent = srchMatches.length + '건';
    goTo(srchMatches[0]);
  } else {
    document.getElementById('srchCnt').textContent = '없음';
  }
}

function srchNav(dir) {
  if (!srchMatches.length) return;
  srchIdx = (srchIdx + dir + srchMatches.length) % srchMatches.length;
  goTo(srchMatches[srchIdx]);
}

function srchKey(e) {
  if (e.key === 'Enter') srchNav(1);
  if (e.key === 'Escape') toggleSearch();
}

/* ══════════════════════════════════════
   SHARE
══════════════════════════════════════ */
let shrReady = false;

function toggleShare() {
  document.getElementById('shrModal').classList.toggle('on');
  document.getElementById('btnShr').classList.toggle('on');
  if (!shrReady) {
    shrReady = true;
    const url = window.location.href;
    document.getElementById('shrUrl').textContent = url;
    const qrBox = document.getElementById('qrBox');
    qrBox.innerHTML = '<div style="color:#aaa;font-size:12px;text-align:center;padding-top:70px">QR 생성 중...</div>';
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => {
      qrBox.innerHTML = '';
      new QRCode(qrBox, { text: url, width: 180, height: 180, colorDark: '#1e4d8c', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
    };
    document.head.appendChild(s);
  }
}

function shrBgClick(e) {
  if (e.target === document.getElementById('shrModal')) toggleShare();
}

function copyUrl() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.querySelector('.shcopy');
    btn.textContent = '복사됨 ✓';
    setTimeout(() => btn.textContent = '링크 복사', 2200);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

/* ══════════════════════════════════════
   KEYBOARD & TOUCH
══════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (document.activeElement === document.getElementById('srchInp')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextPg();
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prevPg();
  if (e.key === '+' || e.key === '=') zoomChg(1);
  if (e.key === '-') zoomChg(-1);
});

let touchX = null;
document.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) { dx < 0 ? nextPg() : prevPg(); }
  touchX = null;
});

/* ── Resize ── */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(autoFit, 250);
});

/* ── Start ── */
loadPDF().catch(err => {
  document.getElementById('lTxt').textContent = 'PDF 로딩 실패: ' + err.message;
  console.error(err);
});
