# Analytics e privacidade

O jogo mede o uso com **Google Tag Manager** (container `GTM-MCWMM5C6`, em `src/main.ts`), mas só depois que o jogador aceita. Este documento descreve o que é enviado e o que falta configurar do lado do Tag Manager e do aviso de privacidade.

> Isto é documentação técnica, não aconselhamento jurídico. O desenho segue os requisitos da LGPD, do GDPR e das leis da América do Norte (por exemplo a CCPA/CPRA, a PIPEDA e a Lei 25 do Quebec), mas a conformidade final depende do seu aviso de privacidade e da configuração das tags.

## Como o consentimento funciona

- **Opt-in em todo lugar.** O site é estático e não sabe onde o visitante está; pedir antes é a regra mais rígida (GDPR, LGPD, Lei 25) e vai além do que as leis dos EUA pedem.
- **Nada vai ao Google antes do aceite.** O container do GTM nem é baixado. Só o `dataLayer` local é criado, com o Consent Mode v2 em `denied` para `ad_storage`, `ad_user_data`, `ad_personalization` e `analytics_storage`.
- **Ao aceitar**: `analytics_storage` vira `granted` (os de anúncio ficam sempre `denied`: o jogo não tem anúncios), o `gtm.start` é empurrado e o container é carregado.
- **Aceitar e Recusar** são botões gêmeos (mesmo tamanho, lado a lado). Não há caixa pré-marcada.
- **Retirar o consentimento** é tão fácil quanto dar: o botão **Escolhas de privacidade** do menu reabre o diálogo. Ao recusar depois de aceitar, os cookies `_ga*`, `_gid`, `_gat*`, `_gcl*` e `_gac*` são apagados e a página recarrega (um container já carregado não pode ser descarregado). O progresso é salvo antes.
- **Global Privacy Control** (`navigator.globalPrivacyControl`): vale como recusa, sem mostrar o banner. O jogador ainda pode aceitar de propósito em "Escolhas de privacidade".
- **Registro**: `localStorage`, chave `crabs-against-flip-flops:consent`, `{ version, analytics, decidedAt }`. Pergunta de novo depois de 12 meses, se `CONSENT_VERSION` mudar (em `src/application/consent.ts`) ou se o registro estiver danificado. Mude a versão sempre que a finalidade ou as ferramentas mudarem.
- Eventos de antes da escolha **não são guardados** para enviar depois.

## Eventos

Todos vão para o `dataLayer` como `{ event: <nome>, ...parâmetros }`, com um conjunto fixo de chaves (o `dataLayer` do GTM mantém valores antigos). Só ids, números e booleanos: **o nome do jogador nunca é enviado**. Código em `src/application/analytics.ts` e `analytics-recorder.ts`.

| Evento                   | Quando                                                                                                                   | Parâmetros                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `level_start`            | A rodada começa a ser jogada (do briefing, ou de novo pelo "Tentar de novo"/"Jogar de novo"). Voltar da pausa não conta. | `level_id`, `biome`                                                                   |
| `level_end`              | A rodada termina                                                                                                         | `level_id`, `biome`, `success`, `score`, `hits`, `throws`, `accuracy_pct`, `new_best` |
| `campaign_complete`      | Vitória no último nível (logo depois do `level_end`)                                                                     | `score`                                                                               |
| `level_quit`             | O jogador sai de uma rodada em andamento, da pausa para o menu                                                           | `level_id`, `biome`                                                                   |
| `game_pause`             | A rodada é pausada (inclui a pausa automática ao sair da aba)                                                            | `level_id`                                                                            |
| `spend_virtual_currency` | Compra de um chinelo (evento recomendado do GA4)                                                                         | `value`, `virtual_currency_name` (`points`), `item_name` (id da skin)                 |
| `skin_equip`             | Troca de chinelo                                                                                                         | `skin_id`                                                                             |
| `language_change`        | Troca de idioma                                                                                                          | `language` (`pt-BR` ou `en`)                                                          |
| `audio_change`           | Som e música (0/1) ou volume (0..100, só ao soltar o slider)                                                             | `setting` (`sound`, `music`, `volume`), `value`                                       |

## O que falta fazer no Tag Manager (só você pode)

Os eventos só aparecem nos relatórios depois de criar as tags:

1. Uma tag **Google tag / GA4 Configuration** com o seu ID de medição, disparando em **Initialization / All Pages**, com a verificação de consentimento embutida em `analytics_storage`.
2. Uma tag **GA4 Event** por evento (ou uma só, com o nome vindo da variável de camada de dados `event`), com um gatilho **Custom Event** para cada nome da tabela acima e os parâmetros lidos de variáveis de camada de dados com o mesmo nome.
3. Em GA4, registre os parâmetros úteis como dimensões personalizadas (`level_id`, `biome`, `success`...).
4. Teste no modo de visualização do GTM: com "Recusar" nenhuma tag deve disparar; com "Aceitar" os eventos aparecem.

## O que falta no aviso de privacidade (só você pode)

O banner explica o essencial, mas LGPD (art. 9), GDPR (art. 13) e a CCPA exigem um **aviso de privacidade completo** com a identificação do controlador e um contato (encarregado/DPO, se houver), as finalidades, os destinatários (Google), as transferências internacionais, os prazos e os direitos do titular. Ele ainda não existe. Quando existir, ligue o texto "Mais detalhes" do banner a ele.

Se o jogo for dirigido a crianças, as regras mudam (COPPA, o ECA Digital e a LGPD para dados de crianças, o GDPR-K): decida isso antes de ligar a análise.
