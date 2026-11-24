// Use at the few HTML template boundaries that display a child's chosen name.
const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeText = (value) => String(value).replace(/[&<>"']/g, (character) => entities[character])
