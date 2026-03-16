import fs from 'node:fs';
import path from 'node:path';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

type TOpenApiOperation = {
  operationId?: string;
  tags?: string[];
};

type TOpenApiSpec = {
  paths?: Record<string, Record<string, TOpenApiOperation | unknown>>;
};

function main(): void {
  const root = process.cwd();
  const bundled_spec_path = path.join(root, 'latest/openapi.bundled.json');
  const mounted_routes_path = path.join(root, 'manifests/mounted-routes.json');
  const operation_ids_path = path.join(root, 'manifests/operation-ids.json');

  // ── 1. Read bundled spec ──────────────────────────────────────────────
  if (!fs.existsSync(bundled_spec_path)) {
    console.error(`ERROR: Bundled spec not found at ${bundled_spec_path}`);
    console.error('Run the OpenAPI bundle step first.');
    process.exit(1);
  }

  const spec = JSON.parse(fs.readFileSync(bundled_spec_path, 'utf-8')) as TOpenApiSpec;
  const paths = spec.paths || {};

  // ── 2. Extract all operations ─────────────────────────────────────────
  const routes = [];
  const operation_ids = [];
  const operation_id_set = new Map(); // operationId -> { method, path }
  const route_key_set = new Map();    // "METHOD /path" -> operationId
  const tags_summary = new Map();     // tag -> count
  const errors = [];

  for (const [route_path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!HTTP_METHODS.has(method)) continue;
      if (typeof operation !== 'object' || operation === null) continue;

      const upper_method = method.toUpperCase();
      const route_key = `${upper_method} ${route_path}`;
      const typed_operation = operation as TOpenApiOperation;
      const operation_id = typed_operation.operationId || null;

      // Collect route
      routes.push({ method: upper_method, path: route_path });

      // Check duplicate method+path
      if (route_key_set.has(route_key)) {
        errors.push(`Duplicate route: ${route_key}`);
      } else {
        route_key_set.set(route_key, operation_id);
      }

      // Check operationId exists
      if (!operation_id) {
        errors.push(`Missing operationId: ${route_key}`);
      } else {
        // Check operationId uniqueness
        if (operation_id_set.has(operation_id)) {
          const existing = operation_id_set.get(operation_id);
          errors.push(
            `Duplicate operationId "${operation_id}": ` +
            `${existing.method} ${existing.path} and ${upper_method} ${route_path}`
          );
        } else {
          operation_id_set.set(operation_id, { method: upper_method, path: route_path });
          operation_ids.push(operation_id);
        }
      }

      // Tally tags
      const op_tags = typed_operation.tags || ['(untagged)'];
      for (const tag of op_tags) {
        tags_summary.set(tag, (tags_summary.get(tag) || 0) + 1);
      }
    }
  }

  // ── 3. Check for unresolved $ref ──────────────────────────────────────
  const unresolved_refs = [];

  function walk(obj: unknown, json_path: string): void {
    if (obj === null || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        walk(obj[i], `${json_path}[${i}]`);
      }
      return;
    }

    const typed_obj = obj as { $ref?: string } & Record<string, unknown>;

    if (typed_obj.$ref && typeof typed_obj.$ref === 'string') {
      // In a fully bundled spec, all $refs should point to #/components/...
      // External file refs (e.g., ./paths/foo.yaml) indicate unresolved refs
      if (!typed_obj.$ref.startsWith('#/')) {
        unresolved_refs.push({ ref: typed_obj.$ref, location: json_path });
      }
    }

    for (const [key, value] of Object.entries(typed_obj)) {
      walk(value, `${json_path}.${key}`);
    }
  }

  walk(spec, '$');

  if (unresolved_refs.length > 0) {
    for (const { ref, location } of unresolved_refs) {
      errors.push(`Unresolved $ref "${ref}" at ${location}`);
    }
  }

  // ── 4. Sort outputs ───────────────────────────────────────────────────
  routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  operation_ids.sort();

  // ── 5. Write manifests ────────────────────────────────────────────────
  const manifests_dir = path.dirname(mounted_routes_path);
  if (!fs.existsSync(manifests_dir)) {
    fs.mkdirSync(manifests_dir, { recursive: true });
  }

  fs.writeFileSync(mounted_routes_path, JSON.stringify(routes, null, 2) + '\n');
  fs.writeFileSync(operation_ids_path, JSON.stringify(operation_ids, null, 2) + '\n');

  // ── 6. Print summary ─────────────────────────────────────────────────
  console.log('OpenAPI Route Manifest');
  console.log('='.repeat(50));
  console.log(`Total operations: ${routes.length}`);
  console.log(`Total unique operationIds: ${operation_id_set.size}`);
  console.log('');

  console.log('Operations by tag:');
  const sorted_tags = [...tags_summary.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [tag, count] of sorted_tags) {
    console.log(`  ${tag}: ${count}`);
  }
  console.log('');

  console.log(`Manifests written:`);
  console.log(`  ${mounted_routes_path}`);
  console.log(`  ${operation_ids_path}`);
  console.log('');

  // ── 7. Report errors ─────────────────────────────────────────────────
  if (errors.length > 0) {
    console.error('ERRORS:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    console.error('');
    console.error(`Found ${errors.length} error(s). Exiting with code 1.`);
    process.exit(1);
  }

  console.log('All validations passed.');
}

main();
