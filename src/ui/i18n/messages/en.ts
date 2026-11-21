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
  'levels.1.name': 'Sandy Shore',
  'levels.2.name': 'Low Tide',
  'levels.3.name': 'Swimmers Ahoy',
  'levels.4.name': 'Rocky Point',
  'levels.5.name': 'Tide Pools',
  'levels.6.name': 'Fiddler Ridge',
  'levels.7.name': 'Mangrove Edge',
  'levels.8.name': 'Root Maze',
  'levels.9.name': 'Deep Swamp',
  'levels.10.name': 'Moonlit Beach',
  'levels.11.name': 'Midnight Scuttle',
  'levels.12.name': "The Crab King's Night",
  'menu.levels': 'Choose a level',
  'menu.levelOpen': 'Level {level}: {name}',
  'menu.levelLocked': 'Level {level}: locked',
  'menu.selected': 'Level {level} · {name}',
  'round.won.title': 'Level cleared!',
  'round.lost.title': 'Out of flip flops!',
  'round.summary': 'Score {score} · {hits} hits in {throws} throws',
  'menu.shop': 'Shop',
  'menu.name': 'Your name',
  'menu.namePlaceholder': 'Optional',
  'shop.title': 'Flip flop shop',
  'shop.balance': 'You have {points}',
  'shop.free': 'Free',
  'shop.buy': 'Buy',
  'shop.equip': 'Use',
  'shop.equipped': 'In use',
  'shop.back': 'Back',
  'shop.action': '{action}: {name}',
  'shop.bought': '{name} bought',
  'shop.nowUsing': 'Using {name}',
  'skins.classic.name': 'Classic',
  'skins.ocean.name': 'Ocean',
  'skins.lime.name': 'Lime',
  'skins.mangrove.name': 'Mangrove',
  'skins.pink.name': 'Pink',
  'skins.midnight.name': 'Midnight',
  'skins.gold.name': 'Gold',
  'briefing.targets': 'Your targets',
  'briefing.start': 'Start',
  'crab.common': 'Crab',
  'crab.swimmer': 'Swimmer crab',
  'crab.fiddler': 'Fiddler crab',
  'round.earned': 'Added to your balance: {points}',
  'round.newBest': 'New best for this level!',
  'round.best': 'Best on this level: {points}',
  'round.next': 'Next level',
  'round.again': 'Play again',
  'round.campaign.title': 'Campaign complete!',
  'round.retry': 'Try again',
  'round.menu': 'Main menu',
  'pause.title': 'Paused',
  'pause.resume': 'Resume',
  'pause.button': 'Pause',
  'sound.on': 'Sound: on',
  'music.on': 'Music: on',
  'music.off': 'Music: off',
  'settings.volume': 'Volume',
  'sound.off': 'Sound: off',
  'controls.help':
    'Click or tap the field to throw. Keyboard: arrow keys or WASD aim (Shift = faster), Space or Enter throws, P or Esc pauses.',
  'canvas.label.beach':
    'Game field: crabs walk sideways across the beach. Throw flip flops at them.',
  'canvas.label.rocks': 'Game field: crabs scuttle across a rocky shore. Throw flip flops at them.',
  'canvas.label.mangrove':
    'Game field: crabs scuttle along the mangrove mud. Throw flip flops at them.',
  'canvas.label.night':
    'Game field: crabs scuttle across the beach at night. Throw flip flops at them.',
  'announce.milestone': 'Milestone: {milestone}',
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;
