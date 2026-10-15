import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, MODULES, SOURCE_LINKS, summarize, expectedPoints, modulePrompt } from '../scripts/content.mjs';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, access, rm, mkdtemp, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

import { content, fixture } from './fixtures.mjs';

test('valid typed 60 question 100 point 90 minute exam passes', () => assert.deepEqual(validate(fixture()), []));
test('reserved object property IDs cannot reach the browser answer map', () => {
  for (const id of ['constructor', '__proto__', 'toString']) {
    const data = fixture(); data.exams[0].questions[0].id = id;
    assert.match(validate(data).join(' '), /ID trùng\/thiếu/);
  }
});
test('scenario threshold rejects 41 of 60', () => { const data = fixture(); data.exams[0].questions.slice(0,19).forEach(q => q.scenario=false); assert.match(validate(data).join(' '),/70%/); });
test('module imbalance rejects distribution change', () => { const data = fixture(); data.exams[0].questions[0].module='ai'; assert.match(validate(data).join(' '),/Module A cần 10 câu/); });
test('incorrect choices and missing explanations reject', () => { const data = fixture(); delete data.exams[0].questions[0].explanations.D; assert.match(validate(data).join(' '),/Phương án hoặc lời giải/); });
test('duplicate IDs reject', () => { const data = fixture(); data.exams[0].questions[1].id=data.exams[0].questions[0].id; assert.match(validate(data).join(' '),/ID trùng/); });
test('invalid reference rejects', () => { const data = fixture(); data.lessons[0].sources=['https://example.com']; assert.match(validate(data).join(' '),/nguồn tham khảo/); });
test('malformed nested section returns validation errors instead of crashing', () => {
  const catalog = fixture();
  catalog.lessons[0].sections[0] = null;
  assert.ok(validate(catalog).some(message => message.includes('Mục bài học không hợp lệ')));
});

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
  let requests = 0;
  const api = createServer(async (req,res) => {
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.headers.authorization, 'Bearer test-only-token');
    const body = await new Promise(done => { let text=''; req.on('data',chunk=>text+=chunk); req.on('end',()=>done(JSON.parse(text))); });
    assert.equal(body.model, 'cx/gpt-6-sol');
    const module = body.messages[1].content.match(/module (math|engineering|ai|ethics) \(/)?.[1];
    assert.equal(module, MODULES[requests++]);
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(content(module))}}]}));
  });
  await new Promise(done=>api.listen(0,'127.0.0.1',done));
  try {
    const env = {...process.env,OMNIROUTE_API_KEY:'test-only-token',OMNIROUTE_BASE_URL:`http://127.0.0.1:${api.address().port}/v1`};
    const run = await new Promise(done=>{ const child=spawn(process.execPath,['scripts/content.mjs','generate'],{env,cwd:temp});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);child.on('exit',code=>done({code,output})); });
    assert.equal(run.code,0,run.output);
    assert.equal(requests,4);
    assert.doesNotMatch(run.output,/test-only-token/);
    assert.deepEqual(validate(JSON.parse(await readFile(draft,'utf8'))),[]);
    await assert.rejects(access(published));
  } finally { api.close(); await rm(temp,{recursive:true,force:true}); }
});

test('scenario boundary accepts 42 of 60 but rejects non-booleans', () => {
  const data=fixture(); data.exams[0].questions.slice(0,18).forEach(q=>q.scenario=false);
  assert.deepEqual(validate(data),[]);
  data.exams[0].questions[18].scenario='true';
  assert.match(validate(data).join(' '),/boolean/);
});
test('open questions require model answer and rubric, not A–D', () => {
  const data=fixture(); const q=data.exams[0].questions.find(q=>q.type==='code');
  q.modelAnswer='short'; q.rubric=['short'];
  assert.match(validate(data).join(' '),/Đáp án mẫu quá ngắn/);
  assert.match(validate(data).join(' '),/Rubric/);
});
test('non-finite and wrong question points reject', () => {
  for (const points of [NaN,Infinity,-Infinity,'1',0,2]) {
    const data=fixture(); data.exams[0].questions[0].points=points;
    assert.match(validate(data).join(' '),/Điểm câu/);
  }
});
test('null and prototype-shaped payloads do not crash validation or summary', () => {
  for(const bad of [null, [], 'text', Object.create({lessons:[],exams:[]})]) assert.ok(validate(bad).length);
  for(const bad of [null, {module:'__proto__'}, {module:'constructor'}, Object.create({module:'math'})]) {
    const data=fixture(); data.exams[0].questions[0]=bad;
    assert.ok(validate(data).length); assert.doesNotThrow(()=>summarize(data));
  }
  assert.ok(Number.isNaN(expectedPoints('__proto__','mcq')));
  const data=fixture(); data.exams[0].questions[0].options=Object.create({A:'Inherited answer',B:'Inherited answer',C:'Inherited answer',D:'Inherited answer'});
  assert.match(validate(data).join(' '),/Phương án/);
});
test('summary reports exact distribution and points; prompts cover topics and official docs', () => {
  const summary=summarize(fixture());
  assert.equal(summary.questions,60); assert.equal(summary.points,100);
  assert.deepEqual(MODULES.map(module=>summary.modules[module].total),[10,22,20,8]);
  assert.deepEqual(MODULES.map(module=>summary.modules[module].points),[10,35,35,20]);
  for(const module of MODULES) assert.ok(modulePrompt(module).includes(`module ${module} (`));
  for(const topic of ['Python','NumPy','pandas','broadcasting','groupby','42/60']) assert.ok(modulePrompt('engineering').includes(topic));
  assert.ok(SOURCE_LINKS.engineering.some(url=>url.startsWith('https://docs.python.org/')));
  assert.ok(SOURCE_LINKS.engineering.some(url=>url.startsWith('https://numpy.org/')));
  assert.ok(SOURCE_LINKS.engineering.some(url=>url.startsWith('https://pandas.pydata.org/')));
});
