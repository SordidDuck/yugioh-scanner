import { searchCards, searchByKeywords, fetchCardSets, MONSTER_TYPES, ATTRIBUTES, RACES } from './api.js';
import {
  getCollection, saveCard, updateQuantity, removeCard, importCollection,
  cacheCard, getCachedCard,
} from './storage.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ---------- Navigation ---------- */
$$('.tabbar button').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tabbar button').forEach(b => b.classList.toggle('active', b === btn));
    $$('.page').forEach(p => p.classList.toggle('active', p.id === `page-${btn.dataset.page}`));
    stopCamera();
    if (btn.dataset.page === 'collection') renderCollection();
  });
});

/* ---------- Caméra & Scan ---------- */
let stream = null;

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    $('#camera-preview').srcObject = stream;
    $('#btn-start-camera').classList.add('hidden');
    $('#btn-capture').classList.remove('hidden');
    $('#btn-stop-camera').classList.remove('hidden');
    $('#scan-status').textContent = 'Place la carte dans le cadre (nom bien lisible), puis scanne.';
  } catch (e) {
    $('#scan-status').textContent = 'Caméra indisponible. Utilise l\'onglet Recherche à la place.';
  }
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  $('#btn-start-camera').classList.remove('hidden');
  $('#btn-capture').classList.add('hidden');
  $('#btn-stop-camera').classList.add('hidden');
}

$('#btn-start-camera').addEventListener('click', startCamera);
$('#btn-stop-camera').addEventListener('click', stopCamera);

$('#btn-capture').addEventListener('click', async () => {
  const video = $('#camera-preview');
  if (!video.videoWidth) return;
  const canvas = $('#capture-canvas');
  const w = video.videoWidth, h = video.videoHeight;
  const cropSize = Math.min(w, h) * 0.8;
  canvas.width = cropSize;
  canvas.height = cropSize;
  canvas.getContext('2d').drawImage(
    video,
    (w - cropSize) / 2, (h - cropSize) / 2, cropSize, cropSize,
    0, 0, cropSize, cropSize,
  );
  await ocrCard(canvas.toDataURL('image/png'));
});

async function ocrCard(imageData) {
  const status = $('#scan-status');
  const candidatesEl = $('#ocr-candidates');
  candidatesEl.innerHTML = '';
  if (typeof Tesseract === 'undefined') {
    status.textContent = 'OCR indisponible (hors-ligne ?). Utilise la recherche manuelle.';
    return;
  }
  status.textContent = '⏳ Reconnaissance du texte en cours…';
  $('#btn-capture').disabled = true;
  try {
    const { data } = await Tesseract.recognize(imageData, 'eng');
    const text = data.text.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) {
      status.textContent = 'Aucun texte détecté. Réessaie avec un meilleur éclairage.';
      return;
    }
    status.textContent = `Texte détecté : « ${text.slice(0, 60)}… » — recherche…`;
    const cards = await searchByKeywords(text);
    if (!cards.length) {
      status.textContent = 'Carte non identifiée. Vérifie le nom dans l\'onglet Recherche.';
      return;
    }
    status.textContent = 'Cartes candidates — clique sur la bonne :';
    renderCardGrid(candidatesEl, cards);
  } catch (e) {
    status.textContent = 'Erreur pendant le scan. Réessaie.';
  } finally {
    $('#btn-capture').disabled = false;
  }
}

/* ---------- Recherche ---------- */
const searchInput = $('#search-input');
let suggestTimer = null;
let suggestIndex = -1;

searchInput.addEventListener('input', () => {
  clearTimeout(suggestTimer);
  const q = searchInput.value.trim();
  if (q.length < 3) { $('#search-suggestions').classList.add('hidden'); return; }
  suggestTimer = setTimeout(() => autocomplete(q), 250);
});

searchInput.addEventListener('keydown', (e) => {
  const items = [...$('#search-suggestions').children];
  if (!items.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    suggestIndex = e.key === 'ArrowDown'
      ? (suggestIndex + 1) % items.length
      : (suggestIndex - 1 + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle('active', i === suggestIndex));
  } else if (e.key === 'Enter' && suggestIndex >= 0) {
    items[suggestIndex].click();
  }
});

async function autocomplete(q) {
  const cached = await getCachedCard(q);
  const cards = cached ? [cached.card] : await searchCards({ name: q, fuzzy: true });
  const box = $('#search-suggestions');
  box.innerHTML = '';
  const top = cards.slice(0, 8);
  if (!top.length) { box.classList.add('hidden'); return; }
  if (!cached && top[0]) cacheCard(q, top[0]);
  top.forEach(c => {
    const div = document.createElement('div');
    div.textContent = c.name;
    div.addEventListener('click', () => {
      searchInput.value = c.name;
      box.classList.add('hidden');
      runSearch();
    });
    box.appendChild(div);
  });
  box.classList.remove('hidden');
  suggestIndex = -1;
}

$('#btn-search').addEventListener('click', runSearch);
searchInput.addEventListener('search', runSearch);

async function runSearch() {
  const status = $('#search-status');
  const resultsEl = $('#search-results');
  resultsEl.innerHTML = '';
  $('#search-suggestions').classList.add('hidden');
  const filters = {
    name: searchInput.value.trim(),
    type: $('#filter-type').value,
    attribute: $('#filter-attribute').value,
    race: $('#filter-race').value,
    level: $('#filter-level').value,
    set: $('#filter-set').value.trim(),
    rarity: $('#filter-rarity').value,
  };
  if (!filters.name && !filters.type && !filters.attribute && !filters.race && !filters.level && !filters.set && !filters.rarity) {
    status.textContent = 'Saisis un nom ou des filtres.';
    return;
  }
  status.textContent = '⏳ Recherche…';
  try {
    const cards = await searchCards(filters.name ? { ...filters, name: filters.name, fuzzy: true } : filters);
    if (!cards.length) { status.textContent = 'Aucun résultat.'; return; }
    status.textContent = `${cards.length} carte(s) trouvée(s)`;
    renderCardGrid(resultsEl, cards.slice(0, 60));
  } catch (e) {
    status.textContent = 'Erreur réseau. Vérifie ta connexion.';
  }
}

/* ---------- Rendu cartes (résultats / candidats) ---------- */
function renderCardGrid(container, cards) {
  container.innerHTML = '';
  cards.forEach(card => {
    const el = document.createElement('div');
    el.className = 'card-item';
    const img = card.card_images?.[0];
    const price = card.card_prices?.[0]?.tcgplayer_price || '0';
    el.innerHTML = `
      <img src="${img?.image_url_small || ''}" alt="${card.name}" loading="lazy">
      <div class="name">${card.name}</div>
      <div class="meta">${card.type}${card.race ? ' · ' + card.race : ''}</div>
      <div class="price">≈ $${price}</div>
      <div class="actions">
        <button class="btn primary small add-btn">+ Ajouter</button>
        <button class="btn small detail-btn">ℹ️</button>
      </div>`;
    el.querySelector('.add-btn').addEventListener('click', async () => {
      await saveCard(card, 1);
      flash(el, '✅ Ajoutée !');
    });
    el.querySelector('.detail-btn').addEventListener('click', () => showCardModal(card));
    el.querySelector('img').addEventListener('click', () => showCardModal(card));
    container.appendChild(el);
  });
}

function flash(el, msg) {
  const btn = el.querySelector('.add-btn');
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = old; }, 1200);
}

function showCardModal(card) {
  const img = card.card_images?.[0];
  const desc = card.desc || '';
  const sets = (card.card_sets || []).map(s => `${s.set_name} (${s.set_rarity})`).join(', ');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <img src="${img?.image_url || ''}" alt="${card.name}">
      <h2>${card.name}</h2>
      <div class="meta">${card.type}${card.level ? ' · Niveau ' + card.level : ''}${card.atk !== undefined ? ' · ATK ' + card.atk : ''}${card.def !== undefined ? ' / DEF ' + card.def : ''}</div>
      <div class="desc">${desc}</div>
      ${sets ? `<div class="desc"><strong>Éditions :</strong> ${sets}</div>` : ''}
      <div class="price">≈ $${card.card_prices?.[0]?.tcgplayer_price || '0'} (TCGPlayer)</div>
      <button class="btn primary close">Fermer</button>
    </div>`;
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  backdrop.querySelector('.close').addEventListener('click', () => backdrop.remove());
  document.body.appendChild(backdrop);
}

/* ---------- Collection ---------- */
async function renderCollection() {
  const filter = $('#collection-filter').value.trim().toLowerCase();
  const items = (await getCollection())
    .filter(c => !filter || c.name.toLowerCase().includes(filter)
      || (c.set || '').toLowerCase().includes(filter)
      || (c.type || '').toLowerCase().includes(filter));
  const list = $('#collection-list');
  list.innerHTML = '';
  let totalCards = 0, totalValue = 0, unique = 0, doubles = 0;
  const all = await getCollection();
  all.forEach(c => {
    unique++;
    totalCards += c.quantity;
    if (c.quantity > 1) doubles++;
    totalValue += (parseFloat(c.price) || 0) * c.quantity;
  });
  $('#collection-stats').innerHTML = `
    <div class="stat-box"><div class="val">${unique}</div><div class="lbl">Cartes uniques</div></div>
    <div class="stat-box"><div class="val">${totalCards}</div><div class="lbl">Exemplaires</div></div>
    <div class="stat-box"><div class="val">${doubles}</div><div class="lbl">Doubles</div></div>
    <div class="stat-box"><div class="val">$${totalValue.toFixed(2)}</div><div class="lbl">Valeur estimée</div></div>`;

  if (!items.length) {
    list.innerHTML = '<p class="status">Collection vide. Scanne ou recherche une carte pour commencer !</p>';
    return;
  }
  items.forEach(c => {
    const row = document.createElement('div');
    row.className = 'col-row';
    row.innerHTML = `
      <img src="${c.imageSmall || c.image}" alt="${c.name}" loading="lazy">
      <div class="info">
        <div class="name">${c.name}</div>
        <div class="meta">${c.type}${c.race ? ' · ' + c.race : ''}${c.set ? ' · ' + c.set : ''}</div>
        <div class="meta price">≈ $${(parseFloat(c.price) * c.quantity).toFixed(2)} (${c.quantity} × $${c.price})</div>
      </div>
      <div class="qty">
        <button class="btn small qty-minus">−</button>
        <input type="number" min="1" value="${c.quantity}" class="qty-input">
        <button class="btn small qty-plus">+</button>
        <button class="btn danger small del-btn">🗑</button>
      </div>`;
    const input = row.querySelector('.qty-input');
    row.querySelector('.qty-minus').addEventListener('click', () => changeQty(c.id, c.quantity - 1));
    row.querySelector('.qty-plus').addEventListener('click', () => changeQty(c.id, c.quantity + 1));
    input.addEventListener('change', () => changeQty(c.id, parseInt(input.value) || 1));
    row.querySelector('.del-btn').addEventListener('click', async () => {
      await removeCard(c.id);
      renderCollection();
    });
    row.querySelector('img').addEventListener('click', () => showCardModal({
      name: c.name, type: c.type, desc: '', card_images: [{ image_url: c.image }],
      card_prices: [{ tcgplayer_price: c.price }],
    }));
    list.appendChild(row);
  });
}

async function changeQty(id, qty) {
  await updateQuantity(id, Math.max(1, qty));
  renderCollection();
}

$('#collection-filter').addEventListener('input', renderCollection);

/* ---------- Export / Import ---------- */
function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('#btn-export-csv').addEventListener('click', async () => {
  const items = await getCollection();
  const header = 'id;nom;type;race;attribut;niveau;set;rarete;prix_unitaire;quantite;valeur_totale';
  const rows = items.map(c => [
    c.id, c.name, c.type, c.race, c.attribute, c.level, c.set, c.rarity,
    c.price, c.quantity, (parseFloat(c.price) * c.quantity).toFixed(2),
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'));
  download(`yugioh-collection-${new Date().toISOString().slice(0, 10)}.csv`,
    [header, ...rows].join('\n'), 'text/csv;charset=utf-8');
});

$('#btn-export-json').addEventListener('click', async () => {
  const items = await getCollection();
  download(`yugioh-collection-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(items, null, 2), 'application/json');
});

$('#btn-import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const cards = JSON.parse(await file.text());
    await importCollection(cards);
    renderCollection();
  } catch {
    alert('Fichier JSON invalide.');
  }
  e.target.value = '';
});

/* ---------- Init filtres ---------- */
function fillSelect(id, values) {
  const sel = $(id);
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.textContent = v;
    opt.value = v;
    sel.appendChild(opt);
  });
}
fillSelect('#filter-type', MONSTER_TYPES);
fillSelect('#filter-attribute', ATTRIBUTES);
fillSelect('#filter-race', RACES);

fetchCardSets().then(sets => {
  const datalist = $('#set-list');
  sets.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.set_name;
    datalist.appendChild(opt);
  });
}).catch(() => {});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
