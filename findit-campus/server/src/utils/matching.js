// Rule-based matching engine (v1) — no external services, pure JS so it has
// no extra dependencies to install.

const STOPWORDS = new Set([
  'the', 'and', 'with', 'this', 'that', 'from', 'near', 'has', 'have',
  'was', 'were', 'for', 'are', 'its', 'it', 'a', 'an', 'in', 'on', 'at',
]);

function tokenize(text) {
  return new Set(
    (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
  );
}

function jaccard(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function categoryScore(categoryA, categoryB) {
  const a = (categoryA || '').trim().toLowerCase();
  const b = (categoryB || '').trim().toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a === 'other' || b === 'other') return 0.3;
  return 0;
}

function dateScore(dateA, dateB, windowDays = 30) {
  const diffDays = Math.abs((new Date(dateA).getTime() - new Date(dateB).getTime()) / 86400000);
  return Math.max(0, 1 - diffDays / windowDays);
}

function locationScore(locationA, locationB) {
  const a = (locationA || '').trim().toLowerCase();
  const b = (locationB || '').trim().toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.6;
  return 0;
}

function textScore(postA, postB) {
  const setA = tokenize(`${postA.title} ${postA.description}`);
  const setB = tokenize(`${postB.title} ${postB.description}`);
  return jaccard(setA, setB);
}

const WEIGHTS = { category: 0.35, date: 0.2, location: 0.2, text: 0.25 };

function scorePair(postA, postB) {
  const breakdown = {
    category: categoryScore(postA.category, postB.category),
    date: dateScore(postA.dateEvent, postB.dateEvent),
    location: locationScore(postA.locationText, postB.locationText),
    text: textScore(postA, postB),
  };

  const total =
    breakdown.category * WEIGHTS.category +
    breakdown.date * WEIGHTS.date +
    breakdown.location * WEIGHTS.location +
    breakdown.text * WEIGHTS.text;

  return { total, breakdown };
}

module.exports = { scorePair };
