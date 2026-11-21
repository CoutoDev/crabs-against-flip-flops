export const MAX_PLAYER_NAME_LENGTH = 16;

/**
 * Cleans a name typed by the player: letters, digits, spaces, `_`, `-` and `.` only (no emoji, no
 * markup, no control or invisible characters), single spaces, at most 16 characters. The name will
 * be shown on a shared scoreboard one day, so it is kept boring on purpose. An empty result means
 * "no name".
 */
export function sanitizePlayerName(input: string): string {
  const cleaned = input
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\p{M} _.-]/gu, '')
    .replace(/ +/g, ' ')
    .trim();
  return Array.from(cleaned).slice(0, MAX_PLAYER_NAME_LENGTH).join('').trim();
}
