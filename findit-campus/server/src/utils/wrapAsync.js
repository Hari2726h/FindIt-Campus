// Express 4 does NOT forward a rejected promise from an async route handler
// to the error-handling middleware — an uncaught rejection there becomes a
// Node unhandledRejection, which crashes the whole process by default on
// modern Node. Every route handler in this app is async, so every one of
// them must be wrapped with this before being registered.
function wrapAsync(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { wrapAsync };
