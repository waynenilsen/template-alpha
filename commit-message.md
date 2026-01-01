# Commit Message Guide

This project uses **Conventional Commits** with an amend-and-force-push workflow to keep commit history clean.

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Formatting, missing semicolons, etc. (no code change) |
| `refactor` | Code restructuring without changing behavior |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies, tooling |

### Scope (optional)

Scope indicates the area of the codebase affected:
- `auth` - Authentication
- `ui` - UI components
- `api` - API/tRPC routes
- `db` - Database/Prisma
- `config` - Configuration files

### Examples

```
feat(auth): add session-based login
fix(ui): correct button alignment on mobile
docs: update README with setup instructions
refactor(api): simplify todo router error handling
chore: upgrade dependencies
```

## Workflow: Amend and Force Push

**Always amend your commits instead of creating new ones.** This keeps the branch history clean with a single, well-crafted commit per feature/fix.

### First Commit

```bash
git add .
git commit -m "feat(scope): description"
git push -u origin <branch-name>
```

### Subsequent Changes

```bash
git add .
git commit --amend --no-edit    # Keep same message
git push --force-with-lease     # Safe force push
```

To update the commit message:

```bash
git add .
git commit --amend -m "feat(scope): updated description"
git push --force-with-lease
```

### Why This Workflow?

1. **Clean history** - One commit per logical change
2. **Easier reviews** - Reviewers see the final state, not WIP noise
3. **Simpler rebasing** - Fewer commits = fewer conflicts
4. **Better bisecting** - Each commit represents a complete change

### Safety Notes

- Use `--force-with-lease` instead of `--force` to prevent overwriting others' work
- Only amend commits that haven't been merged to main
- Coordinate with teammates if working on shared branches
