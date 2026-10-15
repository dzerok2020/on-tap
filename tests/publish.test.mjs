import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { publishCatalog } from '../scripts/publish.mjs';
const run = (cwd, name, args) => execFileSync(name, args, { cwd, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
async function repository(scripts = {}) {
  const root = await mkdtemp(join(tmpdir(), 'on-tap-git-test-'));
  const remote = join(root, 'remote.git');
  const repo = join(root, 'local');
  await mkdir(repo);
  run(root, 'git', ['init','--bare',remote]);
  run(repo, 'git', ['init','-b','main']);
  run(repo, 'git', ['config','user.email','test@example.invalid']);
  run(repo, 'git', ['config','user.name','Test']);
  await writeFile(join(repo,'package.json'), JSON.stringify({ name:'publish-fixture', version:'1.0.0', scripts:{validate:'node -e "process.exit(0)"',test:'node -e "process.exit(0)"',build:'node -e "process.exit(0)"',...scripts} }));
  run(repo,'npm',['install','--package-lock-only','--ignore-scripts']);
  await writeFile(join(repo,'notes.txt'),'original');
  run(repo,'git',['add','.']);
  run(repo,'git',['commit','-m','baseline']);
  run(repo,'git',['remote','add','origin',remote]);
  run(repo,'git',['push','-u','origin','main']);
  return {repo,remote};
}
test('publish isolates dirty staged/unstaged/untracked files; repeated updates and retry are safe', async () => {
  const {repo,remote} = await repository();
  await writeFile(join(repo,'notes.txt'),'staged work');
  run(repo,'git',['add','notes.txt']);
  await writeFile(join(repo,'notes.txt'),'unstaged work');
  await writeFile(join(repo,'private.txt'),'do not publish');
  const statusBefore = run(repo,'git',['status','--porcelain=v1','-uall']);
  const indexBefore = run(repo,'git',['diff','--cached']);
  const headBefore = run(repo,'git',['rev-parse','HEAD']);
  const options = {allowedRemote:/remote\.git$/};
  const first = await publishCatalog(repo,{version:2,marker:'reviewed-one'},options);
  assert.equal(run(repo,'git',['show',`${first.commit}:public/content/catalog.json`]),JSON.stringify({version:2,marker:'reviewed-one'},null,2));
  assert.equal(run(repo,'git',['diff-tree','--no-commit-id','--name-only','-r',first.commit]),'public/content/catalog.json');
  assert.equal(run(repo,'git',['status','--porcelain=v1','-uall']),statusBefore);
  assert.equal(run(repo,'git',['diff','--cached']),indexBefore);
  assert.equal(run(repo,'git',['rev-parse','HEAD']),headBefore);
  assert.equal(await readFile(join(repo,'notes.txt'),'utf8'),'unstaged work');
  const second = await publishCatalog(repo,{version:2,marker:'reviewed-two'},options);
  assert.notEqual(first.commit,second.commit);
  assert.equal(run(remote,'git',['rev-parse','main']),second.commit);
  const retry = await publishCatalog(repo,{version:2,marker:'reviewed-two'},options);
  assert.equal(retry.commit,second.commit);
  assert.equal(retry.unchanged,true);
  const prior = run(remote,'git',['rev-parse','main']);
  await assert.rejects(publishCatalog(repo,{marker:'changed'}, {...options,assertVersion:async()=>{throw new Error('stale approval');}}),/stale approval/);
  assert.equal(run(remote,'git',['rev-parse','main']),prior);
  assert.equal(run(repo,'git',['worktree','list','--porcelain']).match(/^worktree /gm).length,1);
});

test('publish refuses to overwrite a remote that advances during verification', async () => {
  const {repo,remote} = await repository();
  const headBefore = run(repo,'git',['rev-parse','HEAD']);
  let concurrentCommit;
  let publishWorktree;
  await assert.rejects(publishCatalog(repo,{version:2,marker:'reviewed'}, {
    allowedRemote:/remote\.git$/,
    onProgress(message) {
      if (!message.includes('kiểm thử')) return;
      publishWorktree = run(repo,'git',['worktree','list','--porcelain']).split('\n')
        .filter(line => line.startsWith('worktree '))[1].slice('worktree '.length);
    },
    async assertVersion() {
      assert.equal(concurrentCommit,undefined,'remote should advance only once');
      const writer = join(remote,'..','concurrent');
      run(repo,'git',['clone','--branch','main',remote,writer]);
      run(writer,'git',['config','user.email','test@example.invalid']);
      run(writer,'git',['config','user.name','Concurrent publisher']);
      await mkdir(join(writer,'public/content'),{recursive:true});
      await writeFile(join(writer,'public/content/catalog.json'),JSON.stringify({version:2,marker:'concurrent'}));
      run(writer,'git',['add','.']);
      run(writer,'git',['commit','-m','concurrent reviewed catalog']);
      concurrentCommit = run(writer,'git',['rev-parse','HEAD']);
      run(writer,'git',['push','origin','main']);
    },
  }),/Web vừa có bản cập nhật khác/);
  assert.ok(concurrentCommit);
  assert.equal(run(remote,'git',['rev-parse','main']),concurrentCommit);
  assert.equal(run(remote,'git',['show','main:public/content/catalog.json']),JSON.stringify({version:2,marker:'concurrent'}));
  assert.equal(run(repo,'git',['rev-parse','HEAD']),headBefore);
  assert.equal(run(repo,'git',['status','--porcelain=v1','-uall']),'');
  assert.equal(run(repo,'git',['worktree','list','--porcelain']).match(/^worktree /gm).length,1);
  assert.ok(publishWorktree);
  await assert.rejects(access(publishWorktree),{code:'ENOENT'});
});

for (const stage of ['test','build']) {
  test(`publish ${stage} failure prevents push and cleans up its worktree`, async () => {
    const {repo,remote} = await repository({
      [stage]:`node -e "console.error('fixture ${stage} failed'); process.exit(1)"`,
    });
    const remoteBefore = run(remote,'git',['rev-parse','main']);
    const headBefore = run(repo,'git',['rev-parse','HEAD']);
    const progress = [];
    let publishWorktree;
    let approvalChecks = 0;
    await assert.rejects(publishCatalog(repo,{version:2,marker:'must not publish'}, {
      allowedRemote:/remote\.git$/,
      onProgress(message) {
        progress.push(message);
        if (message.includes('kiểm thử')) {
          publishWorktree = run(repo,'git',['worktree','list','--porcelain']).split('\n')
            .filter(line => line.startsWith('worktree '))[1].slice('worktree '.length);
        }
      },
      async assertVersion() { approvalChecks++; },
    }),error => {
      assert.match(error.stderr,new RegExp(`fixture ${stage} failed`));
      return true;
    });
    assert.equal(approvalChecks,0);
    assert.equal(progress.some(message => message.includes('Đang push')),false);
    assert.equal(run(remote,'git',['rev-parse','main']),remoteBefore);
    assert.equal(run(repo,'git',['rev-parse','HEAD']),headBefore);
    assert.equal(run(repo,'git',['status','--porcelain=v1','-uall']),'');
    assert.equal(run(repo,'git',['worktree','list','--porcelain']).match(/^worktree /gm).length,1);
    assert.ok(publishWorktree);
    await assert.rejects(access(publishWorktree),{code:'ENOENT'});
  });
}
