#!/usr/bin/env bash
# setup.sh — recreate .cursor/rules/ symlinks after cloning
# Run once on a new machine if symlinks are missing

set -e

RULES_DIR=".cursor/rules"
LLM_DIR=".llm/rules"

echo "Setting up .cursor/rules/ symlinks..."

mkdir -p "$RULES_DIR"

# Core rules (always active)
declare -A SYMLINKS=(
  ["behavior.mdc"]="../../$LLM_DIR/behavior.md"
  ["code-style.mdc"]="../../$LLM_DIR/code-style.md"
  ["git-workflow.mdc"]="../../$LLM_DIR/git-workflow.md"
  ["testing.mdc"]="../../$LLM_DIR/testing.md"
  ["workflow.mdc"]="../../$LLM_DIR/workflow.md"
)

# Stack-specific rules are added in stack branches (e.g. typescript, nestjs)
# Each branch extends this array with its own rules

for link in "${!SYMLINKS[@]}"; do
  target="${SYMLINKS[$link]}"
  link_path="$RULES_DIR/$link"

  if [ -L "$link_path" ]; then
    echo "  exists: $link_path"
  else
    ln -s "$target" "$link_path"
    echo "  created: $link_path -> $target"
  fi
done

echo "Done."
