'use strict';

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape a string for insertion as HTML text or attribute value. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => MAP[c]);
}

/**
 * Serialize data for a <script type="application/json"> block.
 * `<`, `>`, `&` and U+2028/2029 are escaped so the content can never
 * terminate the script element or break a JS parser.
 */
function jsonForScript(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

module.exports = { escapeHtml, jsonForScript };
