const KEY = 'burrow_visitor_id';

/**
 * Returns a stable random ID for this browser session.
 * Used to track which users explored which spots in the community gallery.
 * Not linked to any personal information — just an anonymous seed for the avatar.
 */
export function getVisitorId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    // 24-char hex string — enough entropy, short enough to use as an avatar seed
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem(KEY, id);
  }
  return id;
}
