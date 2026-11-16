# Documentação — Minhas Economias

Esta pasta é a documentação oficial do sistema. Ela descreve **como o sistema está hoje** (não como foi no passado). Quando algo muda no código, o documento correspondente muda no mesmo trabalho (veja `processo/handoff-e-checklist.md`).

Atualizado em: 2026-11-16.

## Por onde começar

| Se você quer... | Leia |
|---|---|
| Entender o que o sistema faz, sem programar | [produto/visao-geral.md](./produto/visao-geral.md) |
| Saber **como cada conta é calculada** (cartão, fatura, DRE, patrimônio…) | [produto/regras-de-negocio.md](./produto/regras-de-negocio.md) |
| Ver o passo a passo das telas e operações | [produto/fluxos.md](./produto/fluxos.md) |
| Saber o significado de um termo (competência, fatura, a receber…) | [produto/glossario.md](./produto/glossario.md) |
| Saber como o código está organizado | [tecnico/estrutura-do-codigo.md](./tecnico/estrutura-do-codigo.md) |
| Ver os achados e a cobertura da auditoria de 15/11/2026 | [Auditoria funcional e financeira](./AUDITORIA_SISTEMA_2026-11-15.md) |
| Ver a arquitetura (telas, servidor, banco) | [tecnico/arquitetura.md](./tecnico/arquitetura.md) |
| Consultar as rotas da API | [tecnico/api.md](./tecnico/api.md) |
| Entender o banco de dados Neon | [tecnico/banco-de-dados.md](./tecnico/banco-de-dados.md) |
| Conferir regras de segurança | [tecnico/seguranca.md](./tecnico/seguranca.md) |
| Rodar testes e entender a qualidade | [tecnico/testes-e-qualidade.md](./tecnico/testes-e-qualidade.md) |
| Publicar, configurar variáveis, agendamentos | [operacao/deploy-e-ambientes.md](./operacao/deploy-e-ambientes.md) |
| Fazer ou restaurar backup | [operacao/backup-e-restauracao.md](./operacao/backup-e-restauracao.md) |
| Saber **como registrar o trabalho** (HANDOFF obrigatório) | [processo/handoff-e-checklist.md](./processo/handoff-e-checklist.md) |
| Regras para mexer no código | [processo/guia-de-contribuicao.md](./processo/guia-de-contribuicao.md) |
| Consultar documentos antigos (histórico) | [arquivo/](./arquivo/) |

## Arquivos na raiz do projeto

| Arquivo | Para que serve |
|---|---|
| `AGENTS.md` / `CLAUDE.md` | **Instruções para qualquer IA**: o que ler antes, o que atualizar ao terminar, regras que não se quebram. |
| `README.md` | Porta de entrada: o que é o projeto e como rodar. |
| `MASTER_BLUEPRINT.md` | Visão resumida da arquitetura, decisões e regras permanentes do projeto. |
| `HANDOFF.md` | **Diário de bordo**: onde estamos, o que mudou, o que falta. Preenchimento obrigatório a cada entrega. |
| `CHECKLIST.md` | Lista do que está pendente, em andamento e decidido. Só itens abertos ficam nela. |

## Mapa de pastas dos documentos

```text
docs/
├── README.md                 # este índice
├── produto/                  # o que o sistema faz e as regras de negócio
├── tecnico/                  # como o sistema é construído
├── operacao/                 # como publicar, monitorar e recuperar
├── processo/                 # como trabalhamos (handoff, checklist, contribuição)
└── arquivo/                  # registros históricos (não descrevem o estado atual)
    └── handoff/              # histórico completo de entregas antigas
```

## Honestidade da documentação

Cada documento diz o que foi **verificado** (testes automáticos, navegador de teste) e o que **nunca foi verificado** (iPhone/Safari reais, Face ID, envio de e-mail SMTP, cobrança real no Neon em produção). Esses itens estão listados em `processo/handoff-e-checklist.md`, seção "Nunca verificado".
