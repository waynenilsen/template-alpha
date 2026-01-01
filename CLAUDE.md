# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Development Commands

- `bun dev` - Start development server
- `bun build` - Build for production
- `bun lint` - Run Biome linter
- `bun format` - Format code with Biome

## Frontend Development Workflow

**Always close the loop when doing frontend work.** Do not assume your changes work - verify them.

### Verification Process

1. **Use the browser MCP server** to interact with the running application
2. **Take screenshots** to visually verify your changes render correctly
3. **Check the browser console and terminal logs** for errors or warnings
4. **Iterate** until the feature works as expected - fix any issues you discover

### Type Checking

Run TypeScript type checking frequently as you work:

```bash
bunx tsc --noEmit
```

Do this:
- After making changes to TypeScript/TSX files
- Before considering a task complete
- When debugging type-related errors

### Before Creating a PR

Always run the following before committing your final changes:

```bash
bun format && git add .
```

This ensures:
- Code is properly formatted with Biome
- All formatted changes are staged for commit
