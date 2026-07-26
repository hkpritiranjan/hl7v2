# Contributing to hl7v2

Thank you for considering a contribution. This document explains how the project is organised, how to set up a development environment, and what to expect during code review.

---

## Table of contents

- [Project philosophy](#project-philosophy)
- [Development setup](#development-setup)
- [Running the tests](#running-the-tests)
- [Code style](#code-style)
- [Submitting a pull request](#submitting-a-pull-request)
- [Reporting issues](#reporting-issues)
- [HL7 resources](#hl7-resources)

---

## Project philosophy

**Zero dependencies.** The core library must have no runtime dependencies. Everything in `dependencies` in `package.json` is reviewed critically for necessity. Test and build tooling in `devDependencies` is fine.

**Strict TypeScript.** `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled. New code must compile cleanly with no `any`, no `@ts-ignore`, and no unsafe indexing.

**Round-trip fidelity.** `encode(parse(raw)) === raw.trim()`. Any change to the parser or encoder must preserve this guarantee across the full fixture set.

**1-based field addressing.** Every public API that takes a field number, component number, or segment index uses 1-based addressing — matching the HL7 specification. Internal 0-based indices are an implementation detail.

---

## Development setup

Prerequisites: **Node.js ≥ 18**, **npm ≥ 9**.

```bash
git clone https://github.com/hkpritiranjan/hl7v2.git
cd hl7v2
npm install
```

### Build

```bash
npm run build      # ESM + CJS + .d.ts → dist/
npm run typecheck  # tsc --noEmit (no emit, just type checking)
```

### Watch mode (for active development)

```bash
npm run dev        # tsup in watch mode
```

---

## Running the tests

```bash
npm test              # run all tests
npm test -- --watch   # re-run on file change
npm run coverage      # generate a coverage report
```

Tests live in `src/__tests__/`. Each module has a corresponding test file:

| Source file | Test file |
|---|---|
| `parser.ts` | `src/__tests__/parser.test.ts` |
| `encoder.ts` | `src/__tests__/encoder.test.ts` |
| `query.ts` | `src/__tests__/query.test.ts` |
| `escape.ts` | `src/__tests__/escape.test.ts` |
| `datetime.ts` | `src/__tests__/datetime.test.ts` |
| `segments/*.ts` | `src/__tests__/segments.test.ts` |

Fixture files used by tests live in `fixtures/`. If you add a new fixture, add at least one test that exercises it.

---

## Code style

- **No inline `any`.** If you genuinely need an escape hatch, use `unknown` + a type guard.
- **No unused exports.** Every public export in `src/index.ts` or `src/segments/index.ts` must be tested.
- **Named types for all return shapes.** Don't return `{ a: string; b: string }` inline from a public function — define an exported interface or type alias.
- **JSDoc on all public symbols.** Describe the HL7 field number, what the field means, and the HL7 table reference if one applies. Follow the pattern in the existing segment classes.
- **Comments only for non-obvious WHY.** Don't explain what the code does; the code should do that itself.

Formatting is enforced with Prettier (`.prettierrc`) and linting with ESLint (`eslint.config.js`). Both run in CI. Before pushing:

```bash
npm run lint      # check
npm run lint:fix  # auto-fix what can be fixed
npm run format    # prettier --write
```

---

## Submitting a pull request

1. **Fork** the repo and create a feature branch from `main`.
2. **Add tests** — all new behaviour must be covered; do not lower the coverage percentage.
3. **Run the full suite** locally (`npm test`) and confirm it passes before opening the PR.
4. **Open the PR** against `main`. Fill in the PR template:
   - What does this change do and why?
   - Which HL7 segment/field/version does it relate to?
   - Is there a spec reference?
5. **One logical change per PR.** Bug fixes and features should not be bundled unless they are tightly coupled.

A maintainer will review within a few days. Expect feedback on type safety, HL7 spec accuracy, and test coverage.

---

## Reporting issues

Use [GitHub Issues](https://github.com/hkpritiranjan/hl7v2/issues). Choose:

- **Bug report** — for incorrect parsing, encoding, or query behaviour
- **Feature request** — for missing segments, new query helpers, or new message type support

For security vulnerabilities, please do **not** file a public issue. Email `priti2chand@gmail.com` directly.

---

## HL7 resources

- [HL7 International](https://www.hl7.org/) — standards body
- [HL7 v2.5.1 Specification (free download)](https://www.hl7.org/implement/standards/product_brief.cfm?product_id=144)
- [Caristix HL7 Dictionary](https://hl7-definition.caristix.com/) — handy field/table browser
- [LOINC](https://loinc.org/) — observation codes used in OBX.3
