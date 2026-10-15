import { MODULES, SOURCE_LINKS, EXAM_STRUCTURE } from '../scripts/content.mjs';

export function content(module) {
  const spec = EXAM_STRUCTURE.modules[module];
  const lesson = { id:`lesson-${module}`, module, title:'Bài học áp dụng thực tế', summary:'Một bài học về lựa chọn kỹ thuật.', sections:[{heading:'Tình huống triển khai',body:'Nêu bối cảnh và mục tiêu trước khi chọn phương án.'},{heading:'Đánh đổi và kiểm chứng',body:'So sánh giả định với chỉ số thực nghiệm đáng tin cậy.'}], sources:[SOURCE_LINKS[module][0]] };
  const questions = ['mcq','code','essay'].flatMap(type => Array.from({length:spec[type]}, (_, i) => ({
    id:`${module}-${type}-${i}`, module, type, points:spec[`${type}Points`], level:'L3', scenario:true,
    context:'Một đội đang triển khai dự án có dữ liệu lệch phân phối.', prompt:'Lựa chọn nào tốt nhất để kiểm chứng nguyên nhân?',
    ...(type === 'mcq' ? {
      options:Object.fromEntries([... 'ABCD'].map(key => [key,`Phương án ${key}: kiểm tra bằng thử nghiệm có đối chứng.`])), correct:'A',
      explanations:Object.fromEntries([... 'ABCD'].map(key => [key,`Giải thích lựa chọn ${key} trong điều kiện thực tế.`]))
    } : {
      modelAnswer:'Kiểm tra dữ liệu đầu vào, nêu giả định và thực hiện phép kiểm chứng độc lập trước khi quyết định triển khai.',
      rubric:['Nêu giả định dữ liệu','Trình bày cách kiểm chứng','Phân tích rủi ro triển khai']
    }), sources:[SOURCE_LINKS[module][0]]
  })));
  return { lesson, questions };
}

export function fixture() {
  const parts = MODULES.map(content);
  return { version:2, lessons:parts.map(part => part.lesson), exams:[{id:'exam-test',title:'Đề thi mô phỏng năng lực',durationMinutes:90,totalPoints:100,questions:parts.flatMap(part => part.questions)}] };
}
