# Method API OpenAPI Specification

Machine-readable [OpenAPI 3.1.0](https://spec.openapis.org/oas/v3.1.0) specification for the [Method API](https://docs.methodfi.com). Targets API version `2025-12-01`.

## Directory Structure

| Directory | Description |
|---|---|
| `/openapi/` | Modular source OpenAPI files (entry point: `openapi/openapi.yaml`) |
| `/latest/` | Bundled single-file specs in JSON and YAML |
| `/manifests/` | Generated route and operation-ID manifests |
| `/scripts/` | Build and validation tooling |

## Quick Start

```bash
pnpm install
pnpm check          # lint + bundle + generate manifests
pnpm validate       # check + SDK smoke test
```

## Bundled Specs

After running `pnpm bundle`, find the fully-resolved single-file specifications in `/latest/`:

- `latest/openapi.bundled.yaml`
- `latest/openapi.bundled.json`

These are suitable for SDK generation, documentation rendering, and tooling integration.

## Available Scripts

| Script | Description |
|---|---|
| `pnpm lint` | Redocly structural and style linting |
| `pnpm bundle` | Bundle modular spec into single-file YAML and JSON |
| `pnpm routes` | Generate route manifests and validate operationId uniqueness |
| `pnpm sdk:smoke` | Generate TypeScript types and compile with `tsc --noEmit` |
| `pnpm check` | Run lint + bundle + routes |
| `pnpm validate` | Run all checks including SDK smoke test |

## Servers

| Environment | URL |
|---|---|
| Production | `https://production.methodfi.com` |
| Sandbox | `https://sandbox.methodfi.com` |
| Development | `https://dev.methodfi.com` |

## License

Proprietary. See [LICENSE](LICENSE).
