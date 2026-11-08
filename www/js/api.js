const API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

async function apiFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return data.data || [];
}

export function searchCards({ name = '', fuzzy = false, type = '', attribute = '', race = '', level = '', set = '', rarity = '' } = {}) {
  const params = new URLSearchParams();
  if (name) params.set(fuzzy ? 'fname' : 'name', name);
  if (type) params.set('type', type);
  if (attribute) params.set('attribute', attribute);
  if (race) params.set('race', race);
  if (level) params.set('level', level);
  if (set) params.set('cardset', set.toUpperCase());
  if (rarity) params.set('rarity', rarity);
  if (![...params.keys()].length) return Promise.resolve([]);
  return apiFetch(`${API}?${params}`);
}

export function searchByKeywords(text, limit = 12) {
  const words = text.split(/\s+/).filter(w => w.length > 2).slice(0, 4);
  if (!words.length) return Promise.resolve([]);
  const query = words.join(' ');
  return searchCards({ name: query, fuzzy: true }).then(cards => cards.slice(0, limit));
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
