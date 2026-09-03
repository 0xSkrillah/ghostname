/**
 * `ghostname` binary entry point.
 */
import { runCli } from './ghostname';

runCli(process.argv.slice(2), {
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
  env: process.env,
}).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`ghostname: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(3);
  },
);
