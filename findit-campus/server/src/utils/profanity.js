// Small static word list — no external service or dependency. Good enough to
// catch casual abuse in post text and chat messages; not meant to be
// exhaustive or to replace human moderation (that's what reports are for).
const BLOCKED_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dumbass', 'motherfucker',
];

const PATTERN = new RegExp(`\\b(${BLOCKED_WORDS.join('|')})\\b`, 'i');

function containsProfanity(text) {
  return PATTERN.test(text || '');
}

module.exports = { containsProfanity };
