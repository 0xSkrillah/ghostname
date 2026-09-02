/**
 * Reviewable GitHub Pages deployment.
 *
 *   npm run deploy:pages            # build HEAD and push it to gh-pages
 *   DEPLOY_DRY_RUN=1 npm run deploy:pages
 *
 * Refuses to run from a dirty tree, builds from a clean `npm ci`, verifies the
 * bundle carries the CSP meta tag and no personal ENS name (the same digest
 * check the test suite uses), then commits dist/ to the gh-pages branch with a
 * message naming the source commit. History on gh-pages is appended, never
 * rewritten.
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts }).trim();
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });

const FORBIDDEN_NAME_DIGESTS = new Set([
  '62bbfd493f99f44bbac4f353e1aba14cd8c3fd8fa13c6660503a49455441d98d',
]);
const ALLOWED_NAMES = new Set([
  'name.eth',
  'ghostname-3c7714.eth',
  'your-name.eth',
  'your-test-name.eth',
  'ghostname-enabled-name.eth',
]);

if (run('git status --porcelain')) {
  console.error('Working tree is dirty. Commit or stash before deploying.');
  process.exit(1);
}
// The public demo is Sepolia-only. A mainnet-enabled build is never deployed here.
const envFile = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
if (/^\s*VITE_ENABLE_MAINNET\s*=\s*true/im.test(envFile) || String(process.env.VITE_ENABLE_MAINNET).toLowerCase() === 'true') {
  console.error('VITE_ENABLE_MAINNET is true; refusing to deploy a mainnet-enabled build to the public demo.');
  process.exit(1);
}
const commit = run('git rev-parse --short=12 HEAD');
const branch = run('git rev-parse --abbrev-ref HEAD');
console.log(`Deploying commit ${commit} (${branch}) to gh-pages`);

rmSync('dist', { recursive: true, force: true });
sh('npm ci --no-audit --no-fund');
sh('npm run build');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const files = walk('dist');
const html = readFileSync('dist/index.html', 'utf8');
if (!html.includes('http-equiv="Content-Security-Policy"')) {
  console.error('dist/index.html has no Content-Security-Policy meta tag; aborting.');
  process.exit(1);
}
if (!html.includes(`name="ghostname-commit" content="${commit}"`)) {
  console.error('dist/index.html does not name the source commit; aborting.');
  process.exit(1);
}
if (/VITE_ENABLE_MAINNET:"true"/.test(readFileSync(files.find((f) => /assets\/index-.*\.js$/.test(f)) ?? 'dist/index.html', 'utf8'))) {
  console.error('The built bundle enables mainnet writes; refusing to deploy it to the public demo.');
  process.exit(1);
}
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.toLowerCase().matchAll(/\b([a-z0-9-]+\.eth)\b/g)) {
    const name = m[1];
    const digest = createHash('sha256').update(name).digest('hex');
    if (FORBIDDEN_NAME_DIGESTS.has(digest) || (!ALLOWED_NAMES.has(name) && !file.endsWith('.css'))) {
      console.error(`Bundle contains a non-allowlisted ENS name in ${file}: ${name}; aborting.`);
      process.exit(1);
    }
  }
}
console.log(`Bundle verified: ${files.length} files, CSP present, no personal ENS name.`);

if (process.env.DEPLOY_DRY_RUN) {
  console.log('Dry run: not pushing.');
  process.exit(0);
}

const worktree = mkdtempSync(join(tmpdir(), 'ghostname-pages-'));
try {
  sh('git fetch origin gh-pages');
  sh(`git worktree add --force ${worktree} origin/gh-pages`);
  // Replace contents, keep history.
  for (const entry of readdirSync(worktree)) {
    if (entry === '.git') continue;
    rmSync(join(worktree, entry), { recursive: true, force: true });
  }
  sh(`cp -R dist/. ${worktree}/`);
  sh(`touch ${worktree}/.nojekyll`);
  sh('git add -A', { cwd: worktree });
  const changed = run('git status --porcelain', { cwd: worktree });
  if (!changed) {
    console.log('gh-pages already matches this build; nothing to push.');
  } else {
    sh(`git -c user.name="ghostname-deploy" -c user.email="deploy@ghostname.local" commit -q -m "deploy: ${commit} from ${branch}"`, { cwd: worktree });
    sh('git push origin HEAD:gh-pages', { cwd: worktree });
    console.log(`Pushed gh-pages <- ${commit}`);
  }
} finally {
  try {
    sh(`git worktree remove --force ${worktree}`);
  } catch {
    if (existsSync(worktree)) rmSync(worktree, { recursive: true, force: true });
  }
}
