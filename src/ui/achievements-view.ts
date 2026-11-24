import { el } from './dom';
import type { MessageKey } from './i18n/messages/en';
import type { Translator } from './i18n/translator';
import { icon } from './icons';

/** Names and hints are catalog keys by achievement id (`achievements.<id>.name` and `.hint`). */
export const achievementNameKey = (id: string): MessageKey =>
  `achievements.${id}.name` as MessageKey;
export const achievementHintKey = (id: string): MessageKey =>
  `achievements.${id}.hint` as MessageKey;
export const achievementName = (translator: Translator, id: string): string =>
  translator.t(achievementNameKey(id));

/** What an achievement pays, as the view needs it: coins and the skins it unlocks. */
export interface RewardView {
  readonly coins: number;
  readonly items: readonly string[];
}

export interface AchievementRowModel {
  readonly id: string;
  readonly earned: boolean;
  readonly current: number;
  readonly goal: number;
  readonly reward: RewardView;
}

export interface AchievementsModel {
  readonly rows: readonly AchievementRowModel[];
}

/** "10 coins, skin Ember": the reward in words, whatever it is made of. */
export function rewardText(
  translator: Translator,
  reward: RewardView,
  skinLabel: (skinId: string) => string,
): string {
  const { t } = translator;
  const parts: string[] = [];
  if (reward.coins > 0) parts.push(t('score.coins', { count: reward.coins }));
  for (const item of reward.items)
    parts.push(t('achievements.rewardSkin', { name: skinLabel(item) }));
  return parts.join(', ');
}

interface Row {
  readonly root: HTMLElement;
  readonly mark: HTMLElement;
  readonly name: HTMLElement;
  readonly hint: HTMLElement;
  readonly progress: HTMLElement;
  readonly reward: HTMLElement;
  readonly state: HTMLElement;
  readonly bar: HTMLProgressElement;
}

/**
 * Every achievement, earned or not: none is hidden (decided on 2026-11-24). A locked one shows its
 * hint, how far along the player is and what it pays. The state is also written in words, so it
 * never depends on color alone. Rows are built once and then only updated.
 */
export class AchievementList {
  readonly root = el('ul', 'achievements');
  private readonly rows = new Map<string, Row>();

  constructor(private readonly skinLabel: (skinId: string) => string) {}

  update(translator: Translator, model: AchievementsModel): void {
    const { t } = translator;
    for (const entry of model.rows) {
      const row = this.rows.get(entry.id) ?? this.build(entry.id);
      row.root.dataset['state'] = entry.earned ? 'earned' : 'locked';
      row.name.textContent = t(achievementNameKey(entry.id));
      row.hint.textContent = t(achievementHintKey(entry.id));
      row.progress.textContent = t('achievements.progress', {
        current: entry.current,
        goal: entry.goal,
      });
      row.progress.hidden = entry.earned;
      row.bar.max = entry.goal;
      row.bar.value = entry.current;
      row.bar.hidden = entry.earned;
      row.reward.textContent = t('achievements.reward', {
        reward: rewardText(translator, entry.reward, this.skinLabel),
      });
      row.state.textContent = entry.earned ? t('achievements.earned') : t('achievements.locked');
    }
  }

  private build(id: string): Row {
    const mark = el('span', 'achievements__mark', icon('trophy'));
    mark.setAttribute('aria-hidden', 'true');
    const name = el('span', 'achievements__name');
    const hint = el('span', 'achievements__hint');
    const progress = el('span', 'achievements__progress');
    const bar = el('progress', 'achievements__bar');
    bar.setAttribute('aria-hidden', 'true');
    const reward = el('span', 'achievements__reward');
    const state = el('span', 'achievements__state');
    const text = el('span', 'achievements__text', name, hint, progress, bar, reward);
    const root = el('li', 'achievements__item', mark, text, state);
    root.dataset['achievement'] = id;
    this.root.append(root);
    const row = { root, mark, name, hint, progress, reward, state, bar };
    this.rows.set(id, row);
    return row;
  }
}
