# Code of Conduct — WWF Crotone Website

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` new feature
- `fix:` bug fix
- `style:` styling changes
- `refactor:` code refactoring
- `chore:` tooling, deps
- `docs:` documentation
- `security:` security fixes

## Branch Naming
- `feat/description` — new features
- `fix/description` — bug fixes
- `security/description` — security patches

## Review Checklist
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] No secrets in code
- [ ] No `console.log` in production code
- [ ] All user input validated server-side
- [ ] All API routes check authentication