import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, MODULES, SOURCE_LINKS } from '../scripts/content.mjs';
import { execFileSync } from 'node:child_process';

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
