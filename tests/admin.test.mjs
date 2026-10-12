import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { MODULES, SOURCE_LINKS } from '../scripts/content.mjs';

function content(module) {
  return {lesson:{id:`lesson-${module}`,module,title:'Bài học áp dụng thực tế',summary:'Một bài học về lựa chọn kỹ thuật.',sections:[{heading:'Tình huống triển khai',body:'Nêu bối cảnh và mục tiêu trước khi chọn phương án.'},{heading:'Đánh đổi và kiểm chứng',body:'So sánh giả định với chỉ số thực nghiệm đáng tin cậy.'}],sources:[SOURCE_LINKS[module][0]]},questions:Array.from({length:5},(_,i)=>({id:`${module}-${i}`,module,level:'L3',scenario:i!==4,context:'Một đội đang triển khai dự án có dữ liệu lệch phân phối.',prompt:'Lựa chọn nào tốt nhất để kiểm chứng nguyên nhân?',options:Object.fromEntries('ABCD'.split('').map(key=>[key,`Phương án ${key}: kiểm tra bằng thử nghiệm có đối chứng.`])),correct:'A',explanations:Object.fromEntries('ABCD'.split('').map(key=>[key,`Giải thích lựa chọn ${key} trong điều kiện thực tế.`])),sources:[SOURCE_LINKS[module][0]]}))};
}

async function setup() {
  const temp=await mkdtemp(join(tmpdir(),'on-tap-admin-'));
  await mkdir(join(temp,'scripts'),{recursive:true});
  await mkdir(join(temp,'admin'),{recursive:true});
  await copyFile(resolve('scripts/admin.mjs'),join(temp,'scripts/admin.mjs'));
  await copyFile(resolve('scripts/content.mjs'),join(temp,'scripts/content.mjs'));
  for(const filename of ['index.html','style.css','app.js','gsap.min.js']) await copyFile(resolve('admin',filename),join(temp,'admin',filename));
  await writeFile(join(temp,'package.json'),' {"type":"module"}');
  return temp;
}

test('admin: four real steps, private draft, hash editing gate, localhost protections',async()=>{
  const temp=await setup();
  const port=48000+Math.floor(Math.random()*10000);
  let requests=0;
  const api=createServer(async(req,res)=>{
    requests++;
    const data=await new Promise(done=>{let text='';req.on('data',part=>text+=part);req.on('end',()=>done(JSON.parse(text)));});
    assert.equal(req.headers.authorization,'Bearer test-only-token');
    const match=data.messages[1].content.match(/module (math|engineering|ai|ethics) \(/);
    const module=match?.[1];
    assert.equal(module,MODULES[requests-1]);
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(content(module))}}]}));
  });
  await new Promise(done=>api.listen(0,'127.0.0.1',done));
  const child=spawn(process.execPath,['scripts/admin.mjs'],{cwd:temp,env:{...process.env,OMNIROUTE_API_KEY:'test-only-token',OMNIROUTE_BASE_URL:`http://127.0.0.1:${api.address().port}/v1`,ADMIN_PORT:String(port)},stdio:'ignore'});
  const base=`http://127.0.0.1:${port}`;
  const request=(path,options)=>fetch(`${base}${path}`,options);
  try {
    let ready=false;
    for(let i=0;i<60;i++){try{await request('/');ready=true;break;}catch{await new Promise(done=>setTimeout(done,50));}}
    assert.equal(ready,true);
    const home=await (await request('/')).text();
    const token=home.match(/data-token="([a-f0-9]+)"/)?.[1];
    assert.ok(token);
    assert.doesNotMatch(home,/test-only-token/);
    assert.equal((await request('/api/generate',{method:'POST'})).status,403);
    const badHostStatus=await new Promise((done,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port,path:'/api/state',headers:{Host:'attacker.test'}},res=>{res.resume();done(res.statusCode);});req.on('error',reject);req.end();});
    assert.equal(badHostStatus,403);
    assert.equal((await request('/api/generate',{method:'POST',headers:{Origin:'http://evil.test','X-Local-Token':token}})).status,403);
    const post=(path,payload)=>request(path,{method:'POST',headers:{Origin:base,'X-Local-Token':token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    assert.equal((await post('/api/generate',{})).status,202);
    assert.equal((await post('/api/generate',{})).status,409);
    let state;
    for(let i=0;i<100;i++){state=await (await request('/api/state')).json();if(state.job.phase==='review')break;await new Promise(done=>setTimeout(done,50));}
    assert.equal(state.job.phase,'review',state.job.message);
    assert.deepEqual(state.job.steps.map(s=>s.state),['done','done','done','done']);
    assert.equal(requests,4);
    assert.equal(state.draft.catalog.exams[0].questions.length,20);
    await assert.rejects(access(join(temp,'public/content/catalog.json')));
    assert.equal((await post('/api/draft',{version:'stale',catalog:state.draft.catalog})).status,409);
    state.draft.catalog.lessons[0].title='Bài học đã được biên tập và duyệt';
    const saved=await (await post('/api/draft',{version:state.draft.version,catalog:state.draft.catalog})).json();
    assert.deepEqual(saved.errors,[]);
    assert.notEqual(saved.version,state.draft.version);
    const draft=JSON.parse(await readFile(join(temp,'content/drafts/catalog.json'),'utf8'));
    assert.equal(draft.lessons[0].title,'Bài học đã được biên tập và duyệt');
    const broken=structuredClone(draft);
    broken.exams[0].questions[0].explanations.D='';
    const invalid=await (await post('/api/draft',{version:saved.version,catalog:broken})).json();
    assert.ok(invalid.errors.length>0);
    assert.equal((await post('/api/publish',{version:invalid.version,confirm:true})).status,202);
    for(let i=0;i<80;i++){state=await (await request('/api/state')).json();if(state.job.phase==='publish-failed')break;await new Promise(done=>setTimeout(done,50));}
    assert.equal(state.job.phase,'publish-failed');
    await assert.rejects(access(join(temp,'public/content/catalog.json')));
    const repaired=await (await post('/api/draft',{version:invalid.version,catalog:draft})).json();
    assert.deepEqual(repaired.errors,[]);
    assert.equal((await post('/api/publish',{version:repaired.version,confirm:false})).status,400);
    assert.equal((await post('/api/publish',{version:repaired.version,confirm:true})).status,202);
    for(let i=0;i<80;i++){state=await (await request('/api/state')).json();if(state.job.phase==='publish-failed')break;await new Promise(done=>setTimeout(done,50));}
    assert.equal(state.job.phase,'publish-failed'); // no git remote exists in isolated fixture
    await assert.rejects(access(join(temp,'public/content/catalog.json')));
  }finally{child.kill();api.close();await rm(temp,{recursive:true,force:true});}
});
