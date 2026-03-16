import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CWD = resolve(new URL('.', import.meta.url).pathname, '..');
const BUNDLED_SPEC = join(CWD, 'latest', 'openapi.bundled.json');
const TSC_BIN = join(CWD, 'node_modules', '.bin', 'tsc');

let tmp_dir: string | null = null;

try {
  tmp_dir = mkdtempSync(join(tmpdir(), 'sdk-smoke-test-'));

  const types_file = join(tmp_dir, 'openapi.d.ts');

  const OPENAPI_TS_BIN = join(CWD, 'node_modules', '.bin', 'openapi-typescript');

  console.log('Generating TypeScript types from bundled OpenAPI spec...');
  execSync(`${OPENAPI_TS_BIN} ${BUNDLED_SPEC} -o ${types_file}`, {
    stdio: 'inherit',
    cwd: tmp_dir,
  });

  const tsconfig_path = join(tmp_dir, 'tsconfig.json');
  writeFileSync(
    tsconfig_path,
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          target: 'ES2020',
          module: 'ES2020',
          moduleResolution: 'node',
        },
        include: ['openapi.d.ts'],
      },
      null,
      2,
    ),
  );

  console.log('Compiling generated types with tsc --noEmit...');
  execSync(`${TSC_BIN} --project ${tsconfig_path} --noEmit`, {
    stdio: 'inherit',
    cwd: tmp_dir,
  });

  console.log('SDK smoke test passed.');
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('SDK smoke test failed:', message);
  process.exit(1);
} finally {
  if (tmp_dir) {
    rmSync(tmp_dir, { recursive: true, force: true });
  }
}
