// `Number('notanumber')` is NaN, and passing NaN as a Prisma numeric `where`
// argument throws — which, combined with the wrapAsync issue, used to be
// able to take the whole server down from a single malformed URL param.
// Every place a route param is parsed as an id should use this instead of
// a bare `Number(...)`.
function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

module.exports = { parsePositiveInt };
