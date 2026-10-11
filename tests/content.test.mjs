import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, MODULES, SOURCE_LINKS } from '../scripts/content.mjs';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, access, rm, mkdtemp, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

function fixture() {
  const lessons = MODULES.map(module => ({id:`lesson-${module}`, module, title:'Bài học áp dụng thực tế', summary:'Một bài học về lựa chọn kỹ thuật.', sections:[{heading:'Tình huống triển khai',body:'Nêu bối cảnh và mục tiêu trước khi chọn phương án.'},{heading:'Đánh đổi và kiểm chứng',body:'So sánh giả định với chỉ số thực nghiệm đáng tin cậy.'}], sources:[SOURCE_LINKS[module][0]]}));
  const questions = MODULES.flatMap(module => Array.from({length:5}, (_, i) => ({id:`${module}-${i}`,module,level:'L3',scenario:i!==4,context:'Một đội đang triển khai dự án có dữ liệu lệch phân phối.',prompt:'Lựa chọn nào tốt nhất để kiểm chứng nguyên nhân?',options:Object.fromEntries('ABCD'.split('').map(key => [key,`Phương án ${key}: kiểm tra bằng thử nghiệm có đối chứng.`])),correct:'A',explanations:Object.fromEntries('ABCD'.split('').map(key => [key,`Giải thích lựa chọn ${key} trong điều kiện thực tế.`])),sources:[SOURCE_LINKS[module][0]]})));
  return {lessons, exams:[{id:'exam-test',title:'Đề thi mô phỏng năng lực',durationMinutes:90,questions}]};
}

test('valid balanced 90 minute exam passes', () => assert.deepEqual(validate(fixture()), []));
test('scenario threshold rejects 13 of 20', () => { const data = fixture(); data.exams[0].questions.slice(0,3).forEach(q => q.scenario=false); assert.match(validate(data).join(' '),/70%/); });
test('module imbalance rejects distribution change', () => { const data = fixture(); data.exams[0].questions[0].module='ai'; assert.match(validate(data).join(' '),/cân bằng/); });
test('incorrect choices and missing explanations reject', () => { const data = fixture(); delete data.exams[0].questions[0].explanations.D; assert.match(validate(data).join(' '),/Phương án\/lời giải/); });
test('duplicate IDs reject', () => { const data = fixture(); data.exams[0].questions[1].id=data.exams[0].questions[0].id; assert.match(validate(data).join(' '),/ID trùng/); });
test('invalid reference rejects', () => { const data = fixture(); data.lessons[0].sources=['https://example.com']; assert.match(validate(data).join(' '),/nguồn tham khảo/); });
test('empty catalog cannot be published', () => assert.match(validate({lessons:[],exams:[]}).join(' '), /Thiếu bài học|Thiếu đề/));
test('mixed valid and invalid source links reject', () => { const data=fixture(); data.lessons[0].sources.push('https://example.com'); assert.match(validate(data).join(' '),/nguồn tham khảo/); });
test('all lessons must include valid module', () => { const data=fixture(); data.lessons[0].module='bad'; assert.match(validate(data).join(' '), /module/); });
test('publish refuses without explicit approval flag', () => {
  assert.throws(() => execFileSync(process.execPath, ['scripts/content.mjs','publish'], {stdio:'pipe'}), /Cần --approve-reviewed/);
});

test('generate via local API writes only a private draft until human approval', async () => {
  const temp = await mkdtemp(join(tmpdir(),'on-tap-integration-'));
  const draft = join(temp,'content/drafts/catalog.json');
  const published = join(temp,'public/content/catalog.json');
  await mkdir(join(temp,'scripts'),{recursive:true});
  await copyFile(resolve('scripts/content.mjs'),join(temp,'scripts/content.mjs'));
  await writeFile(join(temp,'package.json'),'{"type":"module"}');
  const api = createServer(async (req,res) => {
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.headers.authorization, 'Bearer test-only-token');
    const body = await new Promise(done => { let text=''; req.on('data',chunk=>text+=chunk); req.on('end',()=>done(JSON.parse(text))); });
    assert.equal(body.model, 'cx/gpt-6-sol');
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(fixture())}}]}));
  });
  await new Promise(done=>api.listen(0,'127.0.0.1',done));
  try {
    const env = {...process.env,OMNIROUTE_API_KEY:'test-only-token',OMNIROUTE_BASE_URL:`http://127.0.0.1:${api.address().port}/v1`};
    const run = await new Promise(done=>{ const child=spawn(process.execPath,['scripts/content.mjs','generate'],{env,cwd:temp});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);child.on('exit',code=>done({code,output})); });
    assert.equal(run.code,0,run.output);
    assert.doesNotMatch(run.output,/test-only-token/);
    assert.deepEqual(validate(JSON.parse(await readFile(draft,'utf8'))),[]);
    await assert.rejects(access(published));
  } finally { api.close(); await rm(temp,{recursive:true,force:true}); }
});
