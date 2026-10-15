import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const exec = promisify(execFile);
const REMOTE = /^(https:\/\/github\.com\/dzerok2020\/on-tap(?:\.git)?|git@github\.com:dzerok2020\/on-tap(?:\.git)?)$/;

// Never stage, stash, reset, or commit the user's working directory/index.
export async function publishCatalog(root, catalog, { onProgress = () => {}, assertVersion = async () => {}, allowedRemote = REMOTE } = {}) {
  const run = async (cwd, name, args, timeout = 180000) => {
    const { stdout } = await exec(name, args, { cwd, timeout, maxBuffer: 4 * 1024 * 1024 });
    return stdout.trim();
  };
  const git = (...args) => run(root, 'git', args);
  const remote = await git('remote', 'get-url', 'origin');
  if (!allowedRemote.test(remote)) throw new Error('Remote origin không phải repository dự kiến.');
  onProgress('Đang đồng bộ Git; giữ nguyên mọi thay đổi local không liên quan…');
  await git('fetch', 'origin', 'main');
  const base = await git('rev-parse', 'origin/main');
  const holder = await mkdtemp(join(tmpdir(), 'on-tap-publish-'));
  const worktree = join(holder, 'checkout');
  let added = false;
  try {
    await git('worktree', 'add', '--detach', worktree, base);
    added = true;
    const text = JSON.stringify(catalog, null, 2) + '\n';
    const target = join(worktree, 'public/content/catalog.json');
    let unchanged = false;
    try { unchanged = await readFile(target, 'utf8') === text; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await mkdir(join(worktree, 'public/content'), { recursive: true });
    await writeFile(target, text);
    onProgress('Đang kiểm thử và build bản duyệt trong thư mục Git cách ly…');
    await run(worktree, 'npm', ['ci', '--ignore-scripts']);
    await run(worktree, 'npm', ['run', 'validate', '--', 'public/content/catalog.json']);
    await run(worktree, 'npm', ['test']);
    await run(worktree, 'npm', ['run', 'build']);
    await assertVersion();
    if (!unchanged) {
      await run(worktree, 'git', ['add', '--', 'public/content/catalog.json']);
      const staged = await run(worktree, 'git', ['diff', '--cached', '--name-only']);
      if (staged !== 'public/content/catalog.json') throw new Error('File staged không đúng bản duyệt.');
      await run(worktree, 'git', ['commit', '-m', 'content: publish human-reviewed catalog']);
    }
    const commit = await run(worktree, 'git', ['rev-parse', 'HEAD']);
    // A concurrent publish must fail safely rather than overwrite newer content.
    await git('fetch', 'origin', 'main');
    if (await git('rev-parse', 'origin/main') !== base) throw new Error('Web vừa có bản cập nhật khác. Bấm đăng lại để ghép bản duyệt trên phiên bản mới nhất.');
    await assertVersion();
    onProgress('Đang push riêng nội dung đã duyệt; không đưa thay đổi local khác lên GitHub…');
    if (!unchanged) await run(worktree, 'git', ['push', 'origin', 'HEAD:refs/heads/main']);
    return { commit, unchanged };
  } finally {
    // Remove only the exact disposable worktree we created, never the user's checkout.
    if (added && resolve(await realpath(worktree)) === resolve(worktree) && worktree.startsWith(holder + '/')) {
      await git('worktree', 'remove', '--force', worktree);
    }
  }
}
