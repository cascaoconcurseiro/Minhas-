# Auditoria de performance — 2026-11-26

Feita com a skill `auditoria-performance`. Dono autorizou todas as correções ("sim pode fazer tudo").

**Stack:** React 19 + Vite (site estático na CDN da Vercel, PWA) · API Express em função da Vercel · banco Neon PostgreSQL em São Paulo (`sa-east-1`).

## Como foi medido
- **Site no ar:** `minhaseconomias-blue.vercel.app`, Lighthouse 12.8.2 em modo celular (o mesmo motor do PageSpeed), 3 rodadas. O PageSpeed do Google estava sem cota no dia (erro 429), por isso a medição foi feita deste ambiente; os números podem diferir um pouco do PageSpeed.
- **Só a tela de entrada é pública.** As telas logadas foram exercitadas pelos roteiros de navegador contra um banco local descartável, sem cronômetro de produção.

## Linha de base (antes)
| Rodada | Desempenho | Acessibilidade | Boas práticas | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| 1 | 85 | 94 | 96 | 100 | 2,6 s | 3,5 s | 190 ms | 0 |
| 2 | 86 | 94 | 96 | 100 | 2,6 s | 3,7 s | 60 ms | 0 |
| 3 | 87 | 94 | 96 | 100 | 2,5 s | 3,5 s | 90 ms | 0 |

FCP = primeira coisa na tela · LCP = maior bloco na tela · TBT = tela travada · CLS = coisas pulando de lugar.

- LCP (um texto da tela de entrada): 17% resposta do servidor, **83% espera para desenhar** (fontes do Google e o app inteiro antes da tela).
- Instalação para uso sem internet: 106 arquivos, 3,4 MB.
- API em Washington (`iad1`), banco em São Paulo: cada pedido logado faz ~6 viagens ao banco (sessão, BEGIN, 2× `set_config`, consulta, COMMIT).

## O que foi feito
| # | Correção | Ganho esperado |
|---|---|---|
| 1 | API em São Paulo (`regions: ["gru1"]`) | cada viagem ao banco cai de ~120 ms para poucos ms (estimado) |
| 2 | `set_config` em uma consulta | uma viagem a menos por pedido |
| 3 | Fontes no próprio site | sem a cadeia de ~1 s até o Google antes de pintar |
| 4 | Sem script de desenvolvimento; tela de entrada pedida junto com o app | um pedido bloqueante a menos e uma espera a menos |
| 5 | Logo WebP 120 px | 18,9 KB → 3,4 KB |
| 6 | Instalação offline menor | 3,4 MB → 2,4 MB |
| 7 | Contraste de 5 textos da entrada | `#90a1b9`/`#62748e` → `#45556c` |
| 8 | `pg_stat_statements` no Neon | permite listar as consultas lentas |

## Fora desta entrega (e por quê)
- Tela de entrada sem o app inteiro: exige dividir a cadeia de hooks do `App.tsx`; ganho só antes do login (ver `CHECKLIST.md`, E).
- Letra de 11 px na entrada: aumentar muda o visual; precisa de pedido do dono.
- Neon "dorme" após 5 min sem uso no plano Free: o primeiro acesso depois disso é mais lento; é do plano, não do código.

## Depois (produção)
Preenchido após a publicação; ver abaixo.
