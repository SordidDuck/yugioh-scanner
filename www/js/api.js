const API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
const SETS_API = 'https://db.ygoprodeck.com/api/v7/cardsets.php';

async function apiFetch(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (res.ok) return data?.data || [];
  if (res.status === 400) return [];
  throw new Error(`API ${res.status}`);
}

function buildParams({ name = '', fuzzy = false, type = '', attribute = '', race = '', level = '', set = '', language = '' } = {}) {
  const params = new URLSearchParams();
  if (name) params.set(fuzzy ? 'fname' : 'name', name);
  if (type) params.set('type', type);
  if (attribute) params.set('attribute', attribute);
  if (race) params.set('race', race);
  if (level) params.set('level', `lte${level}`);
  if (set) params.set('cardset', set);
  if (language) params.set('language', language);
  return params;
}

function filterByRarity(cards, rarity) {
  return cards.filter(c => (c.card_sets || []).some(s => s.set_rarity === rarity));
}

export async function searchCards({ name = '', fuzzy = false, type = '', attribute = '', race = '', level = '', set = '', rarity = '' } = {}) {
  const params = buildParams({ name, fuzzy, type, attribute, race, level, set });
  if (![...params.keys()].length) return [];
  let cards = await apiFetch(`${API}?${params}`);
  if (!cards.length && name) {
    const fr = buildParams({ name, fuzzy, type, attribute, race, level, set, language: 'fr' });
    cards = await apiFetch(`${API}?${fr}`);
  }
  if (rarity) cards = filterByRarity(cards, rarity);
  return cards;
}

export async function searchByKeywords(text, limit = 12) {
  const words = text.split(/\s+/).filter(w => w.length > 2).slice(0, 6);
  for (const count of [4, 3, 2, 1]) {
    const query = words.slice(0, count).join(' ');
    if (!query) continue;
    const cards = await searchCards({ name: query, fuzzy: true });
    if (cards.length) return cards.slice(0, limit);
  }
  return [];
}

export async function fetchCardSets() {
  const res = await fetch(SETS_API);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const sets = await res.json();
  return Array.isArray(sets) ? sets : [];
}

export const MONSTER_TYPES = [
  'Effect Monster', 'Flip Effect Monster', 'Gemini Monster', 'Normal Monster',
  'Normal Tuner Monster', 'Pendulum Effect Monster', 'Pendulum Normal Monster',
  'Pendulum Tuner Effect Monster', 'Ritual Effect Monster', 'Ritual Monster',
  'Spirit Monster', 'Toon Monster', 'Tuner Monster', 'Union Effect Monster',
  'Fusion Monster', 'Link Monster', 'Synchro Monster', 'Synchro Tuner Monster',
  'XYZ Monster', 'Skill Card', 'Spell Card', 'Trap Card',
];
export const ATTRIBUTES = ['Dark', 'Divine', 'Earth', 'Fire', 'Light', 'Water', 'Wind'];
export const RACES = [
  'Aqua', 'Beast', 'Beast-Warrior', 'Creator-God', 'Cyberse', 'Dinosaur', 'Divine-Beast',
  'Dragon', 'Fairy', 'Fiend', 'Fish', 'Insect', 'Machine', 'Plant', 'Psychic', 'Pyro',
  'Reptile', 'Rock', 'Sea Serpent', 'Spellcaster', 'Thunder', 'Warrior', 'Winged Beast', 'Wyrm', 'Zombie',
];
