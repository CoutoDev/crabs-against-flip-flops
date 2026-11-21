# ADR-0001 — Arquitetura do "Crabs Against Flip Flops" / "Caranguejos vs Chinelos"

Status: **Aceita** (D1–D15 acordadas em 2026-11-20; D16–D19, do M2, acordadas em 2026-11-20 e implementadas; D6 revisada e D20 acordadas em 2026-11-21 e implementadas; D21–D24, do M3, definidas em 2026-11-21 sem consulta e **a revisar**; pendências na seção 7)
Data: 2026-11-20

> Espelho do ADR-002 do projeto "Dev Projects" no claude.ai. Neste repositório, este arquivo é a fonte da verdade a partir de agora.

## 1. Contexto

Minigame de browser em que o jogador arremessa chinelos (estilo havaiana) em caranguejos e siris que cruzam a tela. Acertos geram pontos; há níveis com dificuldade crescente; pontos compram skins de chinelo. Temática de praia e manguezal. Estética 8 bits, com sons interativos (acerto e marcos de pontos). Idiomas: português (pt-BR) e inglês (en). Persistência apenas local, sem conta de usuário no primeiro momento.

Referência de inspiração: repositório CoutoDev/lov3 ("Pegue os corações"): JS puro em ES module, sem build, ~290 linhas em um único `game.js`, canvas 2D para o mundo e DOM para telas e textos flutuantes, loop com `requestAnimationFrame` e delta variável, hit test circular no clique, sem persistência e sem efeitos sonoros. Serve de inspiração de UX (toque no alvo, feedback flutuante, marcos de pontuação), não de arquitetura: este jogo tem projétil com tempo de voo, níveis, loja, persistência e i18n.

Propriedade intelectual: "Havaianas" é marca de terceiros. Os sprites serão originais e genéricos ("chinelo de borracha"), sem logotipo, nome de marca ou padrão de tira que copie o produto.

## 2. Decisões

| #   | Decisão                | Escolha                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Stack                  | Vite + TypeScript estrito + Canvas 2D, sem framework de jogo. Testes com Vitest                                                                                                                                                                                                                                                                                                                                             |
| D2  | Arremesso              | Toque/clique no ponto de destino. O chinelo sai de um ponto fixo e voa em arco, com tempo de voo, até o ponto escolhido, então o jogador precisa adiantar o alvo. Equivalente por teclado (setas + espaço)                                                                                                                                                                                                                  |
| D3  | Arte e áudio           | Pixel art definida em código (matrizes de caracteres + paleta; skin = sprite/paleta alternativa). Áudio chiptune sintetizado via WebAudio. Nenhum arquivo de asset                                                                                                                                                                                                                                                          |
| D4  | Persistência           | `localStorage` atrás de uma interface de repositório (porta), schema versionado. Troca futura por API/conta sem tocar no domínio                                                                                                                                                                                                                                                                                            |
| D5  | Game loop              | Timestep fixo de 60 Hz com acumulador; renderização desacoplada da simulação                                                                                                                                                                                                                                                                                                                                                |
| D6  | Resolução              | **Revisada em 2026-11-21.** Canvas lógico **retrato 180×320 (9:16)**, ampliado em múltiplos inteiros de **pixels do dispositivo** (DPR) com `image-rendering: pixelated`. No celular em pé ocupa a tela; no desktop aparece centralizado (mesma mecânica, só maior). Celular deitado: HUD ao lado do campo. Antes: 320×180 (16:9), ruim de jogar no celular                                                                 |
| D7  | Níveis                 | Campanha finita (8 a 12 níveis), definida por dados, em biomas (praia, rochas, manguezal, noturno). Endless pode vir depois sem refatorar                                                                                                                                                                                                                                                                                   |
| D8  | Fim de rodada          | Munição limitada de chinelos por nível + meta de pontos. Bateu a meta, passa de nível; acabou a munição sem a meta, perde                                                                                                                                                                                                                                                                                                   |
| D9  | i18n                   | pt-BR e en com dicionários TypeScript tipados, sem biblioteca. O domínio nunca produz texto: eventos e dados carregam chaves/ids e a UI traduz. `Intl.PluralRules` e `Intl.NumberFormat` para plural e números. Locale detectado de `navigator.languages`, fallback `en`, persistido em `settings.locale`. `<html lang>` atualizado ao trocar                                                                               |
| D10 | Nome                   | "Crabs Against Flip Flops" (en) e "Caranguejos vs Chinelos" (pt-BR). Repositório: `crabs-against-flip-flops`                                                                                                                                                                                                                                                                                                                |
| D11 | Colisão                | O acerto vale no ponto de pouso do chinelo (estilo artilharia), não ao longo da trajetória                                                                                                                                                                                                                                                                                                                                  |
| D12 | Saldo                  | Os pontos da rodada são creditados ao saldo no fim de toda rodada, inclusive em derrota. A meta só controla a progressão                                                                                                                                                                                                                                                                                                    |
| D13 | UI                     | Menus, loja, HUD textual e configurações em DOM (acessibilidade nativa, foco, leitor de tela) sobre o canvas. Canvas apenas para o mundo do jogo                                                                                                                                                                                                                                                                            |
| D14 | Marcos de pontos       | Jingle e efeito a cada 100 pontos na rodada (valor em config, ajustável por nível)                                                                                                                                                                                                                                                                                                                                          |
| D15 | Skins                  | Puramente cosméticas (sprite, paleta, rastro). Catálogo e preços propostos no M4 e aprovados antes de implementar                                                                                                                                                                                                                                                                                                           |
| D16 | Arte e paleta (M2)     | Paleta própria de 16 cores indexadas (`render/palette.ts`); sprites como matrizes de texto em TypeScript, com _slots_ de skin (`S` sola, `T` tira) para a loja do M4 trocar só as cores. Contraste WCAG da paleta coberto por teste.                                                                                                                                                                                        |
| D17 | Renderização (M2)      | Software: tudo é desenhado num `Framebuffer` RGBA 180×320 (testável em Node) e o canvas só recebe `putImageData`. Escala inteira (em pixels do dispositivo) via CSS com `image-rendering: pixelated`; fundo do bioma pré-renderizado uma vez.                                                                                                                                                                               |
| D18 | Orquestração (M2)      | `GameSession` (timestep fixo 60 Hz + acumulador) publica eventos num `EventBus`; áudio, efeitos, HUD e anúncios só assinam. `GameFlow` decide a tela (menu, jogando, pausa, fim) e `PlayerControls` traduz comandos (teclado, mouse, toque) em ações. Tudo em `application/`, sem DOM.                                                                                                                                      |
| D19 | Testes de UI (M2)      | Lógica de apresentação em módulos puros testados no Vitest (`hud-model`, `announce`, `keyboard-commands`, `game-loop` com scheduler injetado, `WebAudioSfx` com contexto falso). O DOM fica em cola fina e é verificado no navegador real pelos testes E2E (D20).                                                                                                                                                           |
| D20 | Testes E2E             | Playwright (`@playwright/test`) versionado em `e2e/`, rodando contra o build de produção servido por `vite preview` e no CI (job `e2e`, Chromium). Projetos: `desktop` 1280×800, `phone` 360×640 @3x com toque em pt-BR, `phone-landscape` 740×360. Page object (`GamePage`) concentra seletores e o bot que joga lendo os pixels do canvas. `PW_CHROME_PATH` permite usar um Chrome já instalado (ambientes sem download). |
| D21 | Campanha (M3)          | 12 níveis, 3 por bioma (praia, rochas, manguezal, noite), por dados em `data/levels.ts`. Caranguejo comum desde o nível 1, siri a partir do 3, violinista a partir do 5. A dificuldade sobe por quem aparece, velocidade/densidade e menos folga de chinelos por ponto de meta. **A revisar:** número de níveis e nomes (`levels.<id>.name`).                                                                               |
| D22 | Progressão (M3)        | `GameFlow` guarda `CampaignProgress` (`highestUnlockedLevel`, `bestScoreByLevel`, por id de nível, mesmo formato do save v1). Vencer o nível da fronteira libera o próximo; derrota não libera nada; níveis bloqueados são recusados (`RangeError`). O M4 só persiste e restaura esse objeto (`GameFlowDeps.progress`). Sem persistência, o progresso vale até recarregar a página.                                         |
| D23 | Telas da campanha (M3) | Menu: "Jogar" começa o nível selecionado (por padrão, o mais avançado liberado) e há um seletor de níveis (bloqueados desabilitados). Fim de rodada: vitória → Próximo nível / Jogar de novo / Menu; derrota → Tentar de novo / Menu; última vitória → "Campanha concluída!". **A revisar:** sem tela de mapa e sem estrelas.                                                                                               |
| D24 | Biomas (M3)            | Cada bioma muda chão, céu e cenário (rochas, raízes, estrelas), e o `aria-label` do campo acompanha o bioma. Um teste exige chão diferente por bioma e legibilidade mínima do caranguejo (corpo ou contorno) sobre cada chão.                                                                                                                                                                                               |

Por que D9 sem biblioteca: são 2 idiomas e algumas centenas de strings, sem carregamento sob demanda e sem formatação ICU complexa. Um dicionário tipado dá segurança em tempo de compilação (faltou uma chave em pt-BR, não compila) e zero dependência. O `Translator` fica atrás de uma interface, então trocar por i18next ou similar é localizado na camada de UI. Revisitar se aparecerem mais idiomas ou textos com gênero/concordância complexos.

## 3. Visão geral

```
src/
  domain/            TS puro, sem DOM, sem Date.now, sem Math.random (lint garante)
    entities/        Crab, Slipper (SlipperFlight), Level, Skin, Wallet
    rng.ts           interface Rng + mulberry32 (a semente vem do composition root)
    constants.ts     campo 180×320 (retrato), origem do arremesso, raio do chinelo, STEP_MS
    rules/           trajetória, colisão, pontuação, caranguejos, validação de nível, rodada (createRound/throwSlipper/step), loja
    events.ts        eventos de domínio (SlipperThrown, CrabHit, SlipperMissed, ScoreMilestone, LevelCleared, RoundLost, SkinPurchased)
  application/       orquestração, sem DOM (testada no Vitest)
    event-bus.ts     pub/sub síncrono dos eventos de domínio
    game-session.ts  uma rodada: timestep fixo 60 Hz + acumulador, publica eventos
    game-flow.ts     telas (menu, jogando, pausa, fim) e resultado da rodada
    player-controls.ts  comandos do jogador (teclado/mouse/toque) → ações; aim.ts, viewport.ts
    locale.ts        Locale, LOCALES, DEFAULT_LOCALE
    (M4) use-cases/ e ports/ProgressRepository entram junto da persistência
  infrastructure/    adaptadores
    render/          palette, sprite(s), framebuffer, font, effects, background, scene, canvas-presenter
    audio/           sfx-specs, sfx-for-event, web-audio-sfx, bind-sfx
    input/           keyboard-commands (puro), dom-input (listeners)
    browser/         game-loop (requestAnimationFrame com scheduler injetável)
    storage/         (M4) LocalStorageProgressRepository (+ validação e migração de schema)
  ui/                DOM (game-view: HUD compacto, diálogos com idioma e som), modelos puros (hud-model, announce) e i18n
    i18n/            catálogos tipados (messages/en.ts é a fonte), Translator, detectLocale
  data/              levels.ts, skins.ts (dados, não código)
```

Dependências apontam para dentro: `infrastructure` e `ui` dependem de `application`, que depende de `domain`. O domínio não importa nada de fora. As regras de lint do repositório proíbem DOM, `localStorage`, `Math.random` e `Date.now` em `domain/` e `application/`, e proíbem importar de `infrastructure/`, `ui/` e `data/`. O `Rng` é interface do próprio domínio (ele precisa dele para sortear spawns e dependências só apontam para dentro); o composition root apenas injeta a semente.

## 4. Mecânicas e regras (rascunho)

- **Arremesso:** origem fixa na base da tela. Ao receber o ponto alvo (limitado ao campo), calcula-se o tempo de voo: distância ÷ `speedPxPerSec`, limitado a [`minFlightMs`, `maxFlightMs`] por nível. A posição é interpolada linearmente e um deslocamento parabólico de `arcHeightPx` é somado em Y para o arco visual (não afeta o acerto). O estado do chinelo é função pura do tempo decorrido, o que facilita testes.
- **Acerto (D11):** só vale no ponto de pouso. Um chinelo acerta no máximo um caranguejo: o mais próximo cujo alcance (`hitRadiusPx` do tipo + raio do chinelo) cobre o ponto; empate vai para o menor id.
- **Caranguejos:** movimento lateral (o caranguejo anda de lado, parte do humor e do design), com velocidade, tamanho e trajetória por tipo e por nível. Tipos previstos: caranguejo comum, siri (mais rápido), caranguejo-violinista (hit box menor, mais pontos), e variações por bioma.
- **Munição e fim de rodada (D8):** `N` chinelos por nível. Cada arremesso consome 1. A rodada é vencida no instante em que o placar alcança a meta; é perdida quando a munição acaba, não há chinelo em voo e a meta não foi atingida. Caranguejos que atravessam a tela somem sem penalidade. Rodada encerrada ignora novos arremessos (`ThrowRejected`).
- **Spawn:** um caranguejo nasce fora da tela a cada intervalo sorteado (`spawn.intervalMs`), no máximo `maxOnScreen` ao mesmo tempo; se a tela estiver cheia a tentativa é descartada (não fica em fila). Ordem dos sorteios: tipo, velocidade, direção, faixa vertical.
- **Pontuação:** pontos por tipo de caranguejo vezes o multiplicador de combo: +1 a cada `comboStep` acertos seguidos, até `maxMultiplier` (com 3/4: acertos 1–3 ×1, 4–6 ×2, 7–9 ×3, 10+ ×4). O combo zera ao errar. Um `ScoreMilestone` é emitido para cada múltiplo de `milestoneEvery` cruzado.
- **Validação:** `createRound` recusa níveis inválidos, incluindo meta inalcançável (melhor caso: todos os arremessos acertando o tipo mais valioso em sequência).
- **Dificuldade por nível (tudo em dados):** velocidade, densidade de spawn, tamanho do alvo, munição, meta de pontos, mix de tipos, tempo de voo mínimo.
- **Aleatoriedade:** `Rng` (mulberry32) vive no domínio e o estado dele fica dentro do `RoundState`. Assim `step(state, dt)` é função pura: mesma semente e mesmos arremessos geram a mesma rodada (replays e testes determinísticos). Em produção o composition root escolhe a semente.

Esboço do contrato de um nível:

```ts
interface LevelConfig {
  id: number;
  biome: 'beach' | 'rocks' | 'mangrove' | 'night';
  ammo: number;
  targetScore: number;
  spawn: { intervalMs: Range; maxOnScreen: number; laneY: Range };
  crabs: { type: CrabType; weight: number; speedPxPerSec: Range }[];
  throw: { speedPxPerSec: number; minFlightMs: number; maxFlightMs: number; arcHeightPx: number };
  scoring: { comboStep: number; maxMultiplier: number; milestoneEvery: number };
}
// Range = { min: number; max: number }
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
- **Acessibilidade:** jogável por teclado; pausa e pausa automática ao perder o foco da aba; respeita `prefers-reduced-motion` (sem screen shake e sem flashes); feedback de acerto nunca depende só de som; contraste de paleta verificado; `aria-live="polite"` apenas em marcos e fim de rodada, nunca a cada acerto; zoom do navegador não é bloqueado; alvos de toque ≥ 44 px; a ajuda de teclado some em telas de toque (`pointer: coarse`); `overscroll-behavior: none` e `touch-action: none` no campo para o gesto não rolar a página.
- **Performance:** 180×320 com poucas dezenas de entidades. Dispensa pool de objetos e quadtree. Sprites pré-compostos em canvas auxiliar uma vez, não por frame.
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
2. **Hospedagem:** resolvido. GitHub Pages via GitHub Actions (`deploy.yml`), build com `base: './'`.
3. **Licença:** em aberto e urgente: o repositório já é público e sem licença, o que deixa todos os direitos reservados (ninguém pode legalmente reutilizar o código). Escolher uma licença (ex.: MIT) ou manter fechado de propósito.

## 8. Plano de marcos

- **M0 — Scaffold:** Vite + TS estrito + Vitest + ESLint/Prettier, estrutura de pastas, CI, base de i18n. ✔ feito
- **M1 — Núcleo de domínio (TDD):** trajetória, caranguejos, colisão, pontuação, fim de rodada. ✔ feito (valores iniciais de balanceamento em `src/data/`, a ajustar no playtest do M2)
- **M2 — Esqueleto andante:** renderer + input + SFX básicos; um nível jogável de ponta a ponta. ✔ feito (D16–D19; ver 8.1)
- **M3 — Campanha:** níveis em dados, biomas, dificuldade crescente, progressão. ✔ feito (D21–D24; ver 8.3)
- **M4 — Loja e persistência:** repositório em `localStorage`, saldo, skins, equipar, locale persistido.
- **M5 — Acabamento:** áudio completo, juice (partículas, rastro), acessibilidade, deploy estático.

### 8.1 Resultado do M2 (retrato do fim do M2; o campo 320×180 foi trocado, ver 8.2)

- Jogável de ponta a ponta: menu, rodada, pausa (botão, `P`/`Esc`, perda de foco da aba/janela), fim de rodada e jogar de novo, em pt-BR e en, com troca de idioma durante a rodada.
- Entrada: mouse e toque (Pointer Events) e teclado (setas/WASD mira, `Shift` acelera, `Espaço`/`Enter` arremessa). `Espaço`/`Enter` em botão focado ativam o botão, nunca arremessam.
- Áudio: SFX sintetizados (onda quadrada, triangular e ruído). O acerto sobe a escada pentatônica conforme o combo; o marco de pontos e a vitória são sequenciados, não empilhados. `AudioContext` nasce no primeiro gesto (botão Jogar, clique ou tecla).
- Acessibilidade: `aria-live` só em marcos de pontuação (conforme a seção 6); o diálogo de fim de rodada recebe o foco; botões com alvo mínimo de 44 px; `Pausar` e HUD reservam espaço para o layout não pular entre telas.
- Verificação: 266 testes unitários; `typecheck`, `lint`, `format:check` e `build` limpos (JS: 34,7 kB, 12,8 kB gzip). No Chrome real (Playwright, 41 verificações): teclado, toque, pausa, idiomas, mute, áudio agendado, escala inteira (3× em 1280×900, 2× em 1000×720, 1× em 360×640) e um bot que joga lendo os pixels do canvas e vence o nível 1.
- Ajustes de projeto descobertos no M2: o texto do botão de idioma em pt-BR passou a ser "Português" (cabe em telas estreitas); o `Pausar` mora no HUD, não na barra superior (a barra quebrava de linha e o canvas perdia um degrau de escala).
- Pendências de balanceamento (não bloqueiam o M3): o nível 1 é generoso para o bot (sobram chinelos). Ajustar com playtest humano. Por decisão (D8), não há cronômetro: quem fica parado nunca perde.

### 8.2 Ajuste pós-M2: campo em retrato e E2E versionado

Motivo: no celular o campo 16:9 ficava pequeno e deitado. Decisão (2026-11-21): campo retrato 180×320 que também funciona no desktop (D6 revisada), mais Playwright no repositório (D20).

- Campo 180×320; `THROW_ORIGIN` no centro da base; faixa de caranguejos reposicionada (`laneY` 150–270); fundo (horizonte, mar, sol, palmeiras) redesenhado. Balanceamento preservado em simulação de 200 sementes (nível 1): mira perfeita vence 100%, erro de ±8 px vence 100%, ±16 px vence 90,5%, ±24 px vence 9%, aleatório 0%, sobram 9 chinelos.
- Escala: `computeIntegerScale(largura, altura, dpr)` escolhe o maior passo de pixel do dispositivo que cabe (em celular @3x passa de 1×, 1,33×, 1,67×… em vez de só 1×, 2×). A moldura do palco entra na conta. Um `ResizeObserver` no HUD refaz o ajuste quando o HUD muda de tamanho (textos chegando, fonte carregando), o que corrigiu um estouro de ~10 px de altura.
- Interface: o HUD virou uma linha compacta (rótulo pequeno sobre o valor) + barra de progresso; botão de pausa `II` na mesma linha. Título virou `h1` só para leitores de tela. Idioma e som saíram da barra superior e moram nos diálogos de menu e pausa, liberando altura (em 360×640 @3x o campo passou de 240×427 para 300×533 px). Celular deitado: HUD em coluna ao lado do campo, que mantém a altura toda.
- Resultados medidos (CSS px, campo): 360×640 @3x → 300×533; 1280×800 @1x → 360×640 (centralizado); 740×360 @3x deitado → 180×320.
- E2E (25 testes, ~25 s): menu e foco, idioma e som, teclado, pausa, bot que joga uma rodada inteira, layout nos três tamanhos (sem rolagem, cabe na viewport, passo inteiro de pixel do dispositivo, tamanho estável entre telas, sem degrau desperdiçado), toque e alvos ≥ 44 px. Teste de mutação manual: ignorar a moldura do palco derruba 6 testes em todos os projetos.
- Limite conhecido: os testes de layout usam Chromium; Safari/iOS (barra de endereço dinâmica, `100dvh`) segue em verificação manual.

### 8.3 Resultado do M3: campanha

- 12 níveis em 4 biomas, com progressão em memória (D22), seletor de níveis no menu, botão "Próximo nível", estado de campanha concluída e nomes de nível/`aria-label` por bioma nos dois idiomas.
- Biomas redesenhados: rochas (chão cinza, pedregulhos), manguezal (raízes no mar, chão de terra), noite (estrelas, chão escuro). Conferidos a olho renderizando cada bioma com os três tipos de caranguejo.
- Dificuldade medida: 100 sementes por nível, jogador simulado que mira o ponto exato de pouso com erro uniforme de ±N px. Taxa de vitória (%):

| Nível | Bioma  | Meta | ±0  | ±8  | ±12 | ±16 | ±24 | Aleatório | Sobra de chinelos (±8) |
| ----- | ------ | ---- | --- | --- | --- | --- | --- | --------- | ---------------------- |
| 1     | praia  | 100  | 100 | 100 | 100 | 91  | 6   | 0         | 9,0                    |
| 2     | praia  | 120  | 100 | 100 | 100 | 82  | 2   | 0         | 9,0                    |
| 3     | praia  | 150  | 100 | 100 | 100 | 54  | 0   | 0         | 7,6                    |
| 4     | rochas | 170  | 100 | 100 | 100 | 48  | 0   | 0         | 7,7                    |
| 5     | rochas | 200  | 100 | 100 | 100 | 29  | 1   | 0         | 6,7                    |
| 6     | rochas | 230  | 100 | 100 | 96  | 19  | 1   | 0         | 6,5                    |
| 7     | mangue | 260  | 100 | 100 | 87  | 8   | 0   | 0         | 6,0                    |
| 8     | mangue | 290  | 100 | 100 | 68  | 7   | 0   | 0         | 5,0                    |
| 9     | mangue | 320  | 100 | 100 | 58  | 1   | 0   | 0         | 4,6                    |
| 10    | noite  | 350  | 100 | 99  | 47  | 0   | 0   | 0         | 4,2                    |
| 11    | noite  | 380  | 100 | 94  | 25  | 0   | 0   | 0         | 3,0                    |
| 12    | noite  | 440  | 100 | 94  | 16  | 0   | 0   | 0         | 2,6                    |

- Guardas em `balance.test.ts`: cada nível vence 100% com mira perfeita, ≥ 70% com ±8 px e ≤ 10% no aleatório; e a campanha como um todo começa tolerante (±12 px ≥ 95% no nível 1), termina exigente (≤ 50% no último), nunca fica claramente mais fácil que o nível anterior e piora de bioma para bioma.
- Limite conhecido: o bot joga um chinelo por vez e mira com precisão; humanos arremessam vários e erram de forma diferente. Números de dificuldade para pessoas dependem de playtest (pendência herdada do M2).
- Verificação: testes unitários, `typecheck`, `lint`, `format:check`, `build` e E2E limpos (ver commit).
