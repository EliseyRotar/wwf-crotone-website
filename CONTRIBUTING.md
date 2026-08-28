# Contributing

This codebase is the working file of a single volunteer project, not
an open-source community. We're happy to share it, and we're happy to
talk to other NGOs who want to adapt it — but please don't open
drive-by PRs without a conversation first.

## If you want to fork / adapt the code

You're very welcome to. The repository is licensed under **AGPL-3.0**
for source code (see [`LICENSE.code`](./LICENSE.code)) and
**CC BY-NC-SA 4.0** for site content (see [`LICENSE.content`](./LICENSE.content)).

In short:

- ✅ Use the code for your own non-profit
- ✅ Modify it for your own camp / volunteer project / ODV
- ✅ Run it as your own website
- ⚠️ If you run a modified version as a network service, AGPL requires
  you to publish your modifications back under AGPL-3.0
- �️ The WWF logo and name are trademarks — see
  [`LICENSE.trademark`](./LICENSE.trademark). Replace them with your
  own branding for any derivative work.
- ⚠️ Site content is CC BY-NC-SA 4.0 — keep attribution, keep it
  non-commercial, share-alike any derivatives.

## If you spot a bug or security issue

- **Security issues** — email **wwfcrotone26@gmail.com** rather than
  opening a public GitHub issue. We'll work with you on a fix and
  coordinated disclosure.
- **Bugs / typos / small fixes** — open an issue on GitHub and we'll
  triage. PRs are welcome for small, well-scoped changes.
- **Big changes** — open an issue first to discuss before writing code.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) so
the `deploy` workflow can auto-generate changelog entries:

| Prefix | When |
|---|---|
| `feat:` | new feature |
| `fix:` | bug fix |
| `refactor:` | code refactor without behaviour change |
| `style:` | styling / formatting |
| `docs:` | documentation only |
| `chore:` | tooling, deps, build |
| `security:` | security fix |
| `test:` | tests only |
| `ci:` | CI / workflow changes |

## Branch naming

- `feat/short-description`
- `fix/short-description`
- `security/short-description`
- `chore/short-description`

## Local dev checklist

Before opening a PR:

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (216 tests as of 2026-08)
- [ ] `npm run build` passes (or explain why it doesn't)
- [ ] No secrets, tokens, or PII in the diff
- [ ] No `console.log` in production code (use `console.warn` /
      `console.error` only)
- [ ] Any new API route validates input with **zod**
- [ ] Any new external input has rate limiting
- [ ] If you touched GDPR-relevant code (registration, account, admin,
      chat), update [`docs/DPIA.md`](./docs/DPIA.md)

## Code conventions

See [`AGENTS.md`](./AGENTS.md) for the local dev conventions (server
components by default, CSS variables for colours, i18n via
`src/i18n/messages/`, etc.).

## Contact

For anything else, write to **wwfcrotone26@gmail.com** (Italian or
English).
