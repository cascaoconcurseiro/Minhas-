#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Minhas Economias BR — Script de Sincronização Completa com o GitHub
# Uso:
#   bash scripts/sync-github.sh https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
# ==============================================================================

REMOTE_URL="${1:-}"
COMMIT_MSG="${2:-feat: versão completa Minhas Economias BR com documentação e banco de dados}"

echo "========================================================"
echo "  Minhas Economias BR — Sincronizador Git & GitHub"
echo "========================================================"

if [ ! -d ".git" ]; then
  echo "[1/4] Inicializando repositório Git na branch main..."
  git init -b main
fi

# Configura autor padrão caso não esteja definido no ambiente
if ! git config user.email >/dev/null 2>&1; then
  git config user.email "wesley.diaslima@gmail.com"
fi
if ! git config user.name >/dev/null 2>&1; then
  git config user.name "Wesley Dias Lima"
fi

echo "[2/4] Adicionando todos os arquivos do projeto e documentações..."
git add -A

if ! git diff --cached --quiet; then
  echo "[3/4] Criando commit da versão atual..."
  git commit -m "$COMMIT_MSG"
else
  echo "[3/4] Working tree já está limpa e atualizada no último commit."
fi

if [ -n "$REMOTE_URL" ]; then
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$REMOTE_URL"
  else
    git remote add origin "$REMOTE_URL"
  fi
  echo "[4/4] Enviando branch 'main' para $REMOTE_URL..."
  git branch -M main
  git push -u origin main
  echo "✅ Sincronização concluída com sucesso!"
else
  echo "[4/4] Repositório local pronto e comitado na branch 'main'."
  echo "Para enviar ao GitHub via terminal, execute:"
  echo "  bash scripts/sync-github.sh https://github.com/SEU_USUARIO/minhas-economias-br.git"
  echo "Ou utilize o botão nativo 'Export to GitHub' no topo do Google AI Studio."
fi
