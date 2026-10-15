import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmDeployment } from '../scripts/deployment.mjs';
test('retry failed/cancelled workflow reruns existing commit without republishing',async()=>{
 for(const conclusion of ['failure','cancelled']) {
  const calls=[];let polls=0;
  const command=async(name,args)=>{calls.push(args);if(args[1]==='list'){polls++;return JSON.stringify([{databaseId:12,status:polls<3?'completed':'completed',conclusion:polls<3?conclusion:'success',url:'https://example.invalid/run'}]);}return '';};
  const run=await confirmDeployment('abc',{command,retry:true,pause:async()=>{}});
  assert.equal(run.conclusion,'success');assert.equal(calls.filter(args=>args[1]==='rerun').length,1);
 }
});
test('first publish failed workflow reports failure; missing retry workflow dispatches once',async()=>{
 await assert.rejects(confirmDeployment('abc',{command:async()=>JSON.stringify([{status:'completed',conclusion:'failure',url:'run'}]),pause:async()=>{}}),/không thành công/);
 let polls=0;const calls=[];
 await confirmDeployment('abc',{retry:true,pause:async()=>{},command:async(name,args)=>{calls.push(args);if(args[1]==='list')return JSON.stringify(++polls===1?[]:[{status:'completed',conclusion:'success'}]);return '';}});
 assert.equal(calls.filter(args=>args[0]==='workflow').length,1);
});
