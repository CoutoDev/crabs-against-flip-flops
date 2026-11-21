# ADR-0001 — Arquitetura do "Crabs Against Flip Flops" / "Caranguejos vs Chinelos"

Status: **Aceita** (decisões D1–D15 acordadas em 2026-11-20; pendências na seção 7)
Data: 2026-11-20

> Espelho do ADR-002 do projeto "Dev Projects" no claude.ai. Neste repositório, este arquivo é a fonte da verdade a partir de agora.

## 1. Contexto

Minigame de browser em que o jogador arremessa chinelos (estilo havaiana) em caranguejos e siris que cruzam a tela. Acertos geram pontos; há níveis com dificuldade crescente; pontos compram skins de chinelo. Temática de praia e manguezal. Estética 8 bits, com sons interativos (acerto e marcos de pontos). Idiomas: português (pt-BR) e inglês (en). Persistência apenas local, sem conta de usuário no primeiro momento.

Referência de inspiração: repositório CoutoDev/lov3 ("Pegue os corações"): JS puro em ES module, sem build, ~290 linhas em um único `game.js`, canvas 2D para o mundo e DOM para telas e textos flutuantes, loop com `requestAnimationFrame` e delta variável, hit test circular no clique, sem persistência e sem efeitos sonoros. Serve de inspiração de UX (toque no alvo, feedback flutuante, marcos de pontuação), não de arquitetura: este jogo tem projétil com tempo de voo, níveis, loja, persistência e i18n.

Propriedade intelectual: "Havaianas" é marca de terceiros. Os sprites serão originais e genéricos ("chinelo de borracha"), sem logotipo, nome de marca ou padrão de tira que copie o produto.

## 2. Decisões

| #   | Decisão          | Escolha                                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Stack            | Vite + TypeScript estrito + Canvas 2D, sem framework de jogo. Testes com Vitest                                                                                                                                                                                                                                                               |
| D2  | Arremesso        | Toque/clique no ponto de destino. O chinelo sai de um ponto fixo e voa em arco, com tempo de voo, até o ponto escolhido, então o jogador precisa adiantar o alvo. Equivalente por teclado (setas + espaço)                                                                                                                                    |
| D3  | Arte e áudio     | Pixel art definida em código (matrizes de caracteres + paleta; skin = sprite/paleta alternativa). Áudio chiptune sintetizado via WebAudio. Nenhum arquivo de asset                                                                                                                                                                            |
| D4  | Persistência     | `localStorage` atrás de uma interface de repositório (porta), schema versionado. Troca futura por API/conta sem tocar no domínio                                                                                                                                                                                                              |
| D5  | Game loop        | Timestep fixo de 60 Hz com acumulador; renderização desacoplada da simulação                                                                                                                                                                                                                                                                  |
| D6  | Resolução        | Canvas lógico 320×180, ampliado em múltiplos inteiros com `image-rendering: pixelated`                                                                                                                                                                                                                                                        |
| D7  | Níveis           | Campanha finita (8 a 12 níveis), definida por dados, em biomas (praia, rochas, manguezal, noturno). Endless pode vir depois sem refatorar                                                                                                                                                                                                     |
| D8  | Fim de rodada    | Munição limitada de chinelos por nível + meta de pontos. Bateu a meta, passa de nível; acabou a munição sem a meta, perde                                                                                                                                                                                                                     |
| D9  | i18n             | pt-BR e en com dicionários TypeScript tipados, sem biblioteca. O domínio nunca produz texto: eventos e dados carregam chaves/ids e a UI traduz. `Intl.PluralRules` e `Intl.NumberFormat` para plural e números. Locale detectado de `navigator.languages`, fallback `en`, persistido em `settings.locale`. `<html lang>` atualizado ao trocar |
| D10 | Nome             | "Crabs Against Flip Flops" (en) e "Caranguejos vs Chinelos" (pt-BR). Repositório: `crabs-against-flip-flops`                                                                                                                                                                                                                                  |
| D11 | Colisão          | O acerto vale no ponto de pouso do chinelo (estilo artilharia), não ao longo da trajetória                                                                                                                                                                                                                                                    |
| D12 | Saldo            | Os pontos da rodada são creditados ao saldo no fim de toda rodada, inclusive em derrota. A meta só controla a progressão                                                                                                                                                                                                                      |
| D13 | UI               | Menus, loja, HUD textual e configurações em DOM (acessibilidade nativa, foco, leitor de tela) sobre o canvas. Canvas apenas para o mundo do jogo                                                                                                                                                                                              |
| D14 | Marcos de pontos | Jingle e efeito a cada 100 pontos na rodada (valor em config, ajustável por nível)                                                                                                                                                                                                                                                            |
| D15 | Skins            | Puramente cosméticas (sprite, paleta, rastro). Catálogo e preços propostos no M4 e aprovados antes de implementar                                                                                                                                                                                                                             |

Por que D9 sem biblioteca: são 2 idiomas e algumas centenas de strings, sem carregamento sob demanda e sem formatação ICU complexa. Um dicionário tipado dá segurança em tempo de compilação (faltou uma chave em pt-BR, não compila) e zero dependência. O `Translator` fica atrás de uma interface, então trocar por i18next ou similar é localizado na camada de UI. Revisitar se aparecerem mais idiomas ou textos com gênero/concordância complexos.

## 3. Visão geral

```
src/
  domain/            TS puro, sem DOM, sem Date.now, sem Math.random (lint garante)
    entities/        Crab, Slipper, Level, Skin, Wallet
    rules/           trajetória do arremesso, movimento, colisão, pontuação, dificuldade, loja
    events.ts        eventos de domínio (SlipperThrown, CrabHit, SlipperMissed, ScoreMilestone, LevelCleared, RoundLost, SkinPurchased)
  application/       casos de uso + portas
    use-cases/       StartLevel, ThrowSlipper, TickSimulation, PurchaseSkin, EquipSkin
    ports/           ProgressRepository, Rng, EventBus
    locale.ts        Locale, LOCALES, DEFAULT_LOCALE
  infrastructure/    adaptadores
    storage/         LocalStorageProgressRepository (+ validação e migração de schema)
    audio/           WebAudioSfx (assina eventos de domínio)
    render/          CanvasRenderer (pixel art a partir de matrizes + paleta)
    input/           PointerInput, KeyboardInput
  ui/                telas DOM (menu, loja, pausa, fim de rodada), HUD e i18n
    i18n/            catálogos tipados (messages/en.ts é a fonte), Translator, detectLocale
  data/              levels.ts, skins.ts (dados, não código)
```

Dependências apontam para dentro: `infrastructure` e `ui` dependem de `application`, que depende de `domain`. O domínio não importa nada de fora. As regras de lint do repositório proíbem DOM, `localStorage`, `Math.random` e `Date.now` em `domain/` e `application/`, e proíbem importar de `infrastructure/` e `ui/`.

## 4. Mecânicas e regras (rascunho)

- **Arremesso:** origem fixa na base da tela. Ao receber o ponto alvo, calcula-se o tempo de voo (proporcional à distância, com limites mínimo e máximo por nível). A posição base é interpolada linearmente e um deslocamento parabólico é somado em Y para o arco visual. O estado do chinelo é função pura do tempo decorrido, o que facilita testes.
- **Caranguejos:** movimento lateral (o caranguejo anda de lado, parte do humor e do design), com velocidade, tamanho e trajetória por tipo e por nível. Tipos previstos: caranguejo comum, siri (mais rápido), caranguejo-violinista (hit box menor, mais pontos), e variações por bioma.
- **Munição:** `N` chinelos por nível. Cada arremesso consome 1. Sem munição e sem chinelos em voo, avalia-se vitória ou derrota.
- **Pontuação:** pontos por tipo de caranguejo, com bônus de sequência de acertos (combo). O combo zera ao errar.
- **Dificuldade por nível (tudo em dados):** velocidade, densidade de spawn, tamanho do alvo, munição, meta de pontos, mix de tipos, tempo de voo mínimo.
- **Aleatoriedade:** sempre via porta `Rng` com semente (ex.: mulberry32). Em produção, semente aleatória; nos testes, fixa.

Esboço do contrato de um nível:

```ts
interface LevelConfig {
  id: number;
  biome: 'beach' | 'rocks' | 'mangrove' | 'night';
  ammo: number;
  targetScore: number;
  spawn: { intervalMs: [min: number, max: number]; maxOnScreen: number };
  crabs: { type: CrabType; weight: number; speedPxPerSec: [number, number] }[];
  throw: { minFlightMs: number; maxFlightMs: number };
}
```

## 5. Persistência (schema v1)

```ts
interface SaveDataV1 {
  version: 1;
  balance: number; // moeda gasta na loja
  highestUnlockedLevel: number;
  bestScoreByLevel: Record<number, number>;
  ownedSkins: string[];
  equippedSkin: string;
  settings: { muted: boolean; volume: number; locale: Locale };
}
```

- Leitura sempre validada (tipos, limites, skins existentes, locale suportado). Dado corrompido ou desconhecido cai no estado padrão, sem quebrar o jogo.
- `version` permite migração futura (v1 → v2, conta de usuário/sync).
- Adulteração via DevTools é aceita: jogo single-player local, sem ranking. Se um ranking global entrar, a validação passa a ser no servidor.

## 6. Qualidade transversal

- **TDD no domínio:** trajetória, colisão, pontuação, combo, fim de rodada, compra de skin (saldo insuficiente, skin já possuída) e carga de save corrompido são testados com Vitest sem canvas e sem navegador, graças ao timestep fixo e ao RNG injetado.
- **i18n:** testes garantem paridade de chaves, placeholders e forma plural entre os catálogos. Nenhum texto visível ao jogador fica fora dos catálogos (inclusive `aria-label`, `title` e alt text). Nomes de níveis e skins entram por chave (`levels.<id>.name`, `skins.<id>.name`).
- **Áudio:** `AudioContext` só é criado/retomado após gesto do usuário (política de autoplay), no botão de jogar. O módulo de áudio apenas assina eventos de domínio. Mute e volume persistidos.
- **Acessibilidade:** jogável por teclado; pausa e pausa automática ao perder o foco da aba; respeita `prefers-reduced-motion` (sem screen shake e sem flashes); feedback de acerto nunca depende só de som; contraste de paleta verificado; `aria-live="polite"` apenas em marcos e fim de rodada, nunca a cada acerto; zoom do navegador não é bloqueado.
- **Performance:** 320×180 com poucas dezenas de entidades. Dispensa pool de objetos e quadtree. Sprites pré-compostos em canvas auxiliar uma vez, não por frame.
- **Segurança:** sem rede e sem dados pessoais. `localStorage` tratado como entrada não confiável. A UI usa `textContent`, nunca `innerHTML` com texto interpolado.

| Risco                                                    | Impacto | Confiança | Mitigação                                                                                       |
| -------------------------------------------------------- | ------- | --------- | ----------------------------------------------------------------------------------------------- |
| Game feel do arremesso ruim (tempo de voo, hit box)      | Alto    | Moderada  | Parâmetros em config, protótipo jogável cedo (M2) e ajuste com playtest                         |
| Dificuldade desbalanceada entre níveis                   | Médio   | Moderada  | Níveis como dados + simulação determinística permitem testar com "bot" simples e ajustar rápido |
| Chiptune sintetizado soar irritante ou repetitivo        | Médio   | Moderada  | Envelopes curtos, variação de pitch por combo, volume padrão baixo, mute visível                |
| Pixel art em código demorar mais que o previsto          | Médio   | Moderada  | Começar com poucos sprites (2 caranguejos, 2 chinelos, 1 bioma) e crescer por dados             |
| Áudio bloqueado pelo navegador / iOS Safari              | Baixo   | Alta      | `AudioContext` no primeiro gesto; teste manual em iOS                                           |
| Textos em pt-BR mais longos que em en quebrando o layout | Baixo   | Moderada  | Layout flexível no DOM (D13); revisar telas nos dois idiomas a cada marco                       |
| Escopo crescer (endless, ranking, contas)                | Médio   | Alta      | Fora do MVP; portas (`ProgressRepository`) já deixam o caminho aberto                           |

## 7. Pendências

1. **Catálogo de skins e preços:** proposta no M4, a aprovar antes de implementar (D15).
2. **Hospedagem:** site estático (ex.: GitHub Pages) depois do MVP. O build já usa `base: './'`.
3. **Licença:** a definir antes de tornar o repositório público. Sem licença, o código fica com todos os direitos reservados.

## 8. Plano de marcos

- **M0 — Scaffold:** Vite + TS estrito + Vitest + ESLint/Prettier, estrutura de pastas, CI, base de i18n. ✔ feito
- **M1 — Núcleo de domínio (TDD):** trajetória, caranguejos, colisão, pontuação, fim de rodada.
- **M2 — Esqueleto andante:** CanvasRenderer + input + SFX básicos; um nível jogável de ponta a ponta.
- **M3 — Campanha:** níveis em dados, biomas, dificuldade crescente, progressão.
- **M4 — Loja e persistência:** repositório em `localStorage`, saldo, skins, equipar, locale persistido.
- **M5 — Acabamento:** áudio completo, juice (partículas, rastro), acessibilidade, deploy estático.
