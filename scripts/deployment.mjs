// Retry an already-pushed reviewed commit without republishing or changing its content.
export async function confirmDeployment(commit, { command, retry = false, pause = () => new Promise(done => setTimeout(done, 5000)) }) {
  let rerun = false;
  for (let i = 0; i < 60; i++) {
    const list = JSON.parse(await command('gh', ['run', 'list', '--workflow', 'deploy.yml', '--commit', commit, '--json', 'databaseId,status,conclusion,url', '--limit', '2']));
    const run = list[0];
    if (run?.status === 'completed') {
      if (run.conclusion === 'success') return run;
      if (retry && !rerun) {
        await command('gh', ['run', 'rerun', String(run.databaseId)]);
        rerun = true;
        await pause();
        continue;
      }
      if (!rerun) throw new Error(`GitHub Actions không thành công. Xem ${run.url}`);
      // GitHub may briefly return the old conclusion immediately after a rerun.
    } else if (!run && retry && !rerun) {
      await command('gh', ['workflow', 'run', 'deploy.yml', '--ref', 'main']);
      rerun = true;
    }
    await pause();
  }
  throw new Error('Chưa xác nhận được GitHub Actions hoàn tất. Bấm đăng lại để kiểm tra/triển khai lại đúng bản duyệt.');
}
