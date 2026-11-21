import './style.css';
import { EventBus } from './application/event-bus';
import { GameFlow } from './application/game-flow';
import { PlayerControls } from './application/player-controls';
import { CRAB_TYPES } from './data/crab-types';
import { LEVELS } from './data/levels';
import { FIELD_HEIGHT_PX, FIELD_WIDTH_PX } from './domain/constants';
import type { DomainEvent } from './domain/events';
import { bindSfx } from './infrastructure/audio/bind-sfx';
import { WebAudioSfx } from './infrastructure/audio/web-audio-sfx';
import { startGameLoop } from './infrastructure/browser/game-loop';
import { bindKeyboard, bindPointer } from './infrastructure/input/dom-input';
import { CanvasPresenter } from './infrastructure/render/canvas-presenter';
import { Effects } from './infrastructure/render/effects';
import { Framebuffer } from './infrastructure/render/framebuffer';
import { Scene } from './infrastructure/render/scene';
import { spriteToCanvas } from './infrastructure/render/sprite-canvas';
import { SPRITES } from './infrastructure/render/sprites';
import { announcementFor } from './ui/announce';
import { GameView, type CampaignView, type CrabIcons } from './ui/game-view';
import { buildHud } from './ui/hud-model';
import { detectLocale } from './ui/i18n/detect-locale';
import { createTranslator } from './ui/i18n/translator';

/**
 * Composition root: the only place that knows every layer. It creates the objects, wires them
 * together and owns the few pieces of impure state (random seeds, the audio context, the DOM).
 * The chosen locale and the mute choice are not persisted yet: that arrives with the progress
 * repository (M4).
 */
const root = document.querySelector<HTMLElement>('#app');
if (root === null) throw new Error('Missing #app root element');

const bus = new EventBus<DomainEvent>();
const flow = new GameFlow({
  levels: LEVELS,
  crabSpecs: CRAB_TYPES,
  newSeed: () => Math.floor(Math.random() * 0x100000000),
  bus,
});
const controls = new PlayerControls(flow);
const sfx = new WebAudioSfx();
const effects = new Effects();
const scene = new Scene();
const frame = new Framebuffer(FIELD_WIDTH_PX, FIELD_HEIGHT_PX);

let translator = createTranslator(detectLocale(navigator.languages));
let muted = false;
let hudKey = '';

const crabIcons: CrabIcons = {
  common: () => spriteToCanvas(SPRITES.crabs.common[0]),
  swimmer: () => spriteToCanvas(SPRITES.crabs.swimmer[0]),
  fiddler: () => spriteToCanvas(SPRITES.crabs.fiddler[0]),
};

const view = new GameView(
  root,
  {
    play: () => {
      void sfx.unlock(); // browsers only start audio after a user gesture, and this is one
      effects.clear();
      flow.play();
    },
    start: () => {
      void sfx.unlock();
      flow.start();
    },
    retry: () => {
      void sfx.unlock();
      effects.clear();
      flow.retry();
    },
    next: () => {
      void sfx.unlock();
      effects.clear();
      flow.next();
    },
    selectLevel: (index) => flow.select(index),
    resume: () => flow.resume(),
    pause: () => flow.pause(),
    toMenu: () => flow.toMenu(),
    setLocale: (locale) => {
      translator = createTranslator(locale);
      hudKey = '';
      view.setTranslator(translator, muted);
      refit();
    },
    toggleSound: () => {
      muted = !muted;
      sfx.setMuted(muted);
      view.setTranslator(translator, muted);
    },
  },
  crabIcons,
);
const presenter = new CanvasPresenter(view.canvas, frame);

function refit(): void {
  const { width, height } = view.availableSize();
  presenter.fit(width, height, window.devicePixelRatio);
}

bindSfx(bus, sfx);
bus.subscribe((event) => effects.handle(event));
bus.subscribe((event) => {
  const message = announcementFor(event, translator);
  if (message !== undefined) view.announce(message);
});

function campaignView(): CampaignView {
  const level = LEVELS[flow.levelIndex];
  return {
    levelIds: LEVELS.map((level) => level.id),
    selected: flow.levelIndex,
    highestUnlocked: flow.highestUnlockedIndex,
    biome: level?.biome ?? 'beach',
    crabs: (level?.crabs ?? []).map(({ type }) => ({ type, points: CRAB_TYPES[type].points })),
  };
}

flow.onChange(() => {
  hudKey = ''; // another level changes the goal and the level number, not just the score
  view.showScreen(flow.screen, flow.outcome, campaignView());
  refit();
});

bindPointer(view.canvas, () => presenter.rect(), {
  onMove: (position) => controls.pointerMoved(position),
  onPress: (position) => {
    void sfx.unlock();
    controls.pointerPressed(position);
  },
});
bindKeyboard(document, (command) => {
  if (command.kind === 'throw') void sfx.unlock();
  return controls.handle(command);
});

// A round must never keep running unseen: leaving the tab or window pauses it.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flow.pause();
});
window.addEventListener('blur', () => flow.pause());
window.addEventListener('resize', refit);
view.onLayoutChange(refit);

view.setTranslator(translator, muted);
view.showScreen(flow.screen, flow.outcome, campaignView());
refit();

startGameLoop((dtMs) => {
  const session = flow.session;
  if (session === undefined) {
    scene.renderBackdrop(frame, LEVELS[flow.levelIndex]?.biome ?? 'beach');
  } else {
    session.advance(dtMs);
    if (flow.screen !== 'paused') effects.update(dtMs);
    const state = session.state;
    scene.render(frame, {
      state,
      effects,
      aim: controls.aimVisible ? controls.aim : undefined,
    });
    const key = `${state.score}|${state.ammo}|${state.combo}`;
    if (key !== hudKey) {
      hudKey = key;
      view.updateHud(buildHud(state, flow.levelIndex + 1, translator));
    }
  }
  presenter.present();
});
