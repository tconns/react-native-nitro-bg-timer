# Contributing

Contributions are welcome, from typo fixes to native runtime improvements.

Please read and follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) in all project interactions.

## Project Context

`react-native-nitro-bg-timer` is a Nitro Module for React Native and targets Nitro `0.35.x+` (`react-native-nitro-modules` + `nitrogen`).

This repository is a single library package (not a Yarn-workspace monorepo).

## Local Development

Install dependencies:

```sh
npm install
```

Core commands:

```sh
npm run typecheck
npm run lint
npm run typescript
```

Generate Nitro bindings (required after any `*.nitro.ts` change):

```sh
npm run specs
```

Notes:

- `npm run specs` should be run whenever Nitro spec signatures change.
- Keep generated Nitro files in sync before opening a PR.

## Code Quality Expectations

- TypeScript must pass: `npm run typecheck`
- Lint must pass: `npm run lint`
- Build output must be healthy: `npm run typescript`

If formatting/lint issues exist, run:

```sh
npm run lint -- --fix
```

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/en):

- `feat`: new feature
- `fix`: bug fix
- `refactor`: internal restructure without behavior change
- `docs`: documentation updates
- `test`: test additions/changes
- `chore`: tooling/infra updates

## Publishing to npm

This project publishes to the public npm registry (`https://registry.npmjs.org/`).

### 1) Pre-publish checks

Run all preflight checks locally:

```sh
npm run typecheck
npm run lint
npm run specs
npm run typescript
```

Optional package verification:

```sh
npm pack
```

### 2) Authenticate npm account

```sh
npm login --registry https://registry.npmjs.org/ --auth-type=web
npm whoami --registry https://registry.npmjs.org/
```

### 3) Version bump

Update version in `package.json` using SemVer (`major.minor.patch`).

Typical guidance:

- `patch`: bugfixes/internal improvements
- `minor`: backward-compatible feature additions
- `major`: breaking changes

### 4) Publish package

```sh
npm publish --access public
```

If your environment supports trusted publishing/provenance:

```sh
npm publish --access public --provenance
```

### 5) Post-publish verification

Confirm package is available:

```sh
npm view react-native-nitro-bg-timer version
```

Then install the published version in a host app and run Android/iOS smoke builds.

## Pull Requests

When opening a PR:

- Keep scope focused and reviewable.
- Include context: problem, approach, and trade-offs.
- Confirm all checks pass locally.
- Update docs when behavior/API changes.
- For public API or native runtime changes, include a short migration note if needed.
