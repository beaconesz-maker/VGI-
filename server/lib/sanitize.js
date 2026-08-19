/**
 * server/lib/sanitize.js — quita campos sensibles antes de responder.
 */
'use strict';

function sanitizeUser(user) {
  if (!user) return user;
  const { passwordHash, ...rest } = user;
  return rest;
}

module.exports = { sanitizeUser };
