/**
 * Plural message. `one`/`other` follow Intl.PluralRules; `zero` is an optional override for
 * count === 0 (needed in pt-BR, where CLDR treats 0 as "one": "0 ponto" reads wrong in a score).
 */
export interface PluralMessage {
  readonly zero?: string;
  readonly one: string;
  readonly other: string;
}

export type Message = string | PluralMessage;

/**
 * English is the source catalog: every other locale must provide exactly these keys
 * (enforced by the compiler through `MessageKey`).
 */
export const en = {
  'game.title': 'Crabs Against Flip Flops',
  'game.tagline': 'Throw flip flops at the crabs!',
  'menu.play': 'Play',
  'score.points': { one: '{count} point', other: '{count} points' },
  'settings.language': 'Language',
  'language.pt-BR': 'Português',
  'language.en': 'English',
  'hud.score': 'Score',
  'hud.ammo': 'Flip flops',
  'hud.combo': 'Combo',
  'hud.goal': 'Goal',
  'hud.level': 'Level {level}',
  'round.won.title': 'Level cleared!',
  'round.lost.title': 'Out of flip flops!',
  'round.summary': 'Score {score} · {hits} hits in {throws} throws',
  'round.again': 'Play again',
  'round.retry': 'Try again',
  'round.menu': 'Main menu',
  'pause.title': 'Paused',
  'pause.resume': 'Resume',
  'pause.button': 'Pause',
  'sound.on': 'Sound: on',
  'sound.off': 'Sound: off',
  'controls.help':
    'Click or tap the field to throw. Keyboard: arrow keys or WASD aim (Shift = faster), Space or Enter throws, P or Esc pauses.',
  'canvas.label': 'Game field: crabs walk sideways across the beach. Throw flip flops at them.',
  'announce.milestone': 'Milestone: {milestone}',
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;
