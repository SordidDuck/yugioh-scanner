const DB_NAME = 'yugioh-scanner';
const STORE = 'collection';
const CACHE = 'cardCache';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE, { keyPath: 'name' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

function reqAsPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCollection() {
  const db = await openDB();
  const items = await reqAsPromise(tx(db, STORE, 'readonly').getAll());
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveCard(card, quantity) {
  const db = await openDB();
  const store = tx(db, STORE, 'readwrite');
  const existing = await reqAsPromise(store.get(card.id));
  const entry = {
    id: card.id,
    name: card.name,
    type: card.type,
    race: card.race || '',
    attribute: card.attribute || '',
    level: card.level || '',
    rarity: card.rarity || '',
    set: card.card_sets?.[0]?.set_name || '',
    image: card.card_images?.[0]?.image_url || '',
    imageSmall: card.card_images?.[0]?.image_url_small || '',
    price: card.card_prices?.[0]?.tcgplayer_price || '0',
    quantity,
    addedAt: existing?.addedAt || Date.now(),
  };
  await reqAsPromise(store.put(entry));
}

export async function updateQuantity(id, quantity) {
  if (quantity <= 0) return removeCard(id);
  const db = await openDB();
  const store = tx(db, STORE, 'readwrite');
  const entry = await reqAsPromise(store.get(id));
  if (!entry) return;
  entry.quantity = quantity;
  await reqAsPromise(store.put(entry));
}

export async function removeCard(id) {
  const db = await openDB();
  await reqAsPromise(tx(db, STORE, 'readwrite').delete(id));
}

export async function clearCollection() {
  const db = await openDB();
  await reqAsPromise(tx(db, STORE, 'readwrite').clear());
}

export async function importCollection(cards) {
  const db = await openDB();
  const store = tx(db, STORE, 'readwrite');
  for (const c of cards) {
    if (!c.id || !c.name || !c.quantity) continue;
    const existing = await reqAsPromise(store.get(c.id));
    if (existing) {
      existing.quantity = Math.max(existing.quantity, c.quantity);
      await reqAsPromise(store.put(existing));
    } else {
      await reqAsPromise(store.put({ ...c, addedAt: Date.now() }));
    }
  }
}

export async function cacheCard(name, card) {
  const db = await openDB();
  await reqAsPromise(tx(db, CACHE, 'readwrite').put({ name: name.toLowerCase(), card }));
}

export async function getCachedCard(name) {
  const db = await openDB();
  return reqAsPromise(tx(db, CACHE, 'readonly').get(name.toLowerCase()));
}
