# Crabs Against Flip Flops / Caranguejos vs Chinelos

**EN** — An 8-bit browser minigame: throw flip flops at crabs scuttling across beaches and mangroves, earn points, climb through harder levels and spend your points on new flip flop skins. Available in English and Brazilian Portuguese. Progress is saved locally in your browser (no account).

**PT-BR** — Minigame 8 bits de navegador: arremesse chinelos em caranguejos e siris que cruzam praias e manguezais, ganhe pontos, avance por níveis mais difíceis e gaste os pontos em skins de chinelo. Disponível em português (Brasil) e inglês. O progresso é salvo localmente no navegador (sem conta).

> Status: **M1 (domain core)** — rules and simulation are implemented and tested, but there is no rendering yet: the game is not playable. / as regras e a simulação estão implementadas e testadas, mas ainda não há tela: o jogo ainda não é jogável.

## Development / Desenvolvimento

Requires Node.js 20+ (CI uses 22).

```bash
npm install
npm run dev          # dev server
npm test             # unit tests (Vitest)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run format       # Prettier
npm run build        # typecheck + production build in dist/
```

## Deploy (GitHub Pages)

The browser cannot run `.ts` files, so the site is **built** with Vite and only `dist/` is published; the workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) does that on every push to `main`. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. To try the production build locally: `npm run build && npm run preview`.

O navegador não executa `.ts`, então o site é **compilado** pelo Vite e só o `dist/` é publicado; o workflow acima faz isso a cada push na `main`. Configuração única: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Para testar o build de produção localmente: `npm run build && npm run preview`.

## Architecture / Arquitetura

Clean-architecture layers (`domain` → `application` → `infrastructure`/`ui`), fixed-timestep simulation, 320×180 pixel canvas, chiptune audio synthesized with WebAudio, levels and skins as data, `localStorage` behind a repository port. Full rationale and roadmap in [`docs/adr/0001-arquitetura.md`](docs/adr/0001-arquitetura.md).

## Notes

Sprites are original; "flip flop" here is a generic item and the project is not affiliated with or endorsed by any footwear brand.
