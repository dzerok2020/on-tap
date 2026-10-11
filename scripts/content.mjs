import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MODULES = ['math', 'engineering', 'ai', 'ethics'];
export const SOURCE_LINKS = {
  math: ['https://github.com/mml-book/mml-book.github.io', 'https://github.com/scikit-learn/scikit-learn'],
  engineering: ['https://github.com/donnemartin/system-design-primer', 'https://github.com/google/eng-practices', 'https://github.com/ryanmcdermott/clean-code-javascript'],
  ai: ['https://github.com/d2l-ai/d2l-en', 'https://github.com/GokuMohandas/Made-With-ML', 'https://github.com/PAIR-code/interpretability'],
  ethics: ['https://github.com/brandonhimpfen/awesome-ai-ethics', 'https://github.com/OWASP/www-project-top-10-for-large-language-model-applications', 'https://github.com/ethicalml/awesome-artificial-intelligence-guidelines']
};
const ROOT = resolve(import.meta.dirname, '..');
const DRAFT = resolve(ROOT, 'content/drafts/catalog.json');
const REVIEWED = resolve(ROOT, 'content/reviewed/catalog.json');
const PUBLISHED = resolve(ROOT, 'public/content/catalog.json');
const letters = ['A', 'B', 'C', 'D'];
const present = value => typeof value === 'string' && value.trim().length >= 12;

export function validate(catalog) {
  const errors = [];
  if (!catalog || typeof catalog !== 'object') return ['Catalog không phải object'];
  if (!Array.isArray(catalog.lessons) || !Array.isArray(catalog.exams)) return ['Thiếu lessons hoặc exams'];
  if (!catalog.lessons.length) errors.push('Thiếu bài học');
  if (!catalog.exams.length) errors.push('Thiếu đề');
  const ids = new Set();
  for (const lesson of catalog.lessons) {
    if (!lesson || !MODULES.includes(lesson.module) || !present(lesson.title) || !present(lesson.summary) || !Array.isArray(lesson.sections) || lesson.sections.length < 2) errors.push('Bài học thiếu module/title/summary hoặc ít hơn 2 mục');
    else {
      if (!lesson.sections.every(s => present(s.heading) && present(s.body))) errors.push(`Mục bài học không hợp lệ: ${lesson.id}`);
      if (!Array.isArray(lesson.sources) || !lesson.sources.length || !lesson.sources.every(link => SOURCE_LINKS[lesson.module].includes(link))) errors.push(`Thiếu nguồn tham khảo: ${lesson.id}`);
    }
    if (!lesson?.id || ids.has(lesson.id)) errors.push(`ID trùng/thiếu: ${lesson?.id}`);
    ids.add(lesson?.id);
  }
  for (const exam of catalog.exams) {
    if (!exam || !present(exam.title) || exam.durationMinutes !== 90 || !Array.isArray(exam.questions) || exam.questions.length < 8 || exam.questions.length % 4) {
      errors.push(`Đề thiếu title/90 phút hoặc số câu không chia đều 4 module: ${exam?.id}`); continue;
    }
    if (!exam.id || ids.has(exam.id)) errors.push(`ID trùng/thiếu: ${exam.id}`);
    ids.add(exam.id);
    const counts = Object.fromEntries(MODULES.map(module => [module, 0]));
    let scenarios = 0;
    for (const q of exam.questions) {
      if (!q || !MODULES.includes(q.module)) { errors.push('Câu hỏi thiếu module'); continue; }
      counts[q.module]++;
      if (q.scenario === true) scenarios++;
      if (!q.id || ids.has(q.id)) errors.push(`ID trùng/thiếu: ${q.id}`);
      ids.add(q.id);
      if (!present(q.context) || !present(q.prompt) || !['L3', 'L4'].includes(q.level)) errors.push(`Câu hỏi thiếu ngữ cảnh, yêu cầu hoặc cấp độ: ${q.id}`);
      if (!q.options || letters.some(key => !present(q.options[key])) || !letters.includes(q.correct) || !q.explanations || letters.some(key => !present(q.explanations[key]))) errors.push(`Phương án/lời giải không đầy đủ: ${q.id}`);
      if (!Array.isArray(q.sources) || !q.sources.length || !q.sources.every(link => SOURCE_LINKS[q.module].includes(link))) errors.push(`Nguồn tham khảo không hợp lệ: ${q.id}`);
    }
    if (Object.values(counts).some(count => count !== exam.questions.length / 4)) errors.push(`Bốn module chưa cân bằng: ${exam.id}`);
    if (scenarios / exam.questions.length < .7) errors.push(`Tỷ lệ câu tình huống < 70%: ${exam.id}`);
  }
  if (catalog.lessons.length && MODULES.some(module => !catalog.lessons.some(lesson => lesson.module === module))) errors.push('Thiếu bài học cho một module');
  return errors;
}

function prompt() {
  return `Bạn là tác giả nội dung tự học tiếng Việt mức SFIA L3/L4; KHÔNG tự nhận đề thi chính thức VinUni. Trả về DUY NHẤT JSON object (không markdown) đúng cấu trúc:\n{"lessons":[{"id":"lesson-math-1","module":"math","title":"...","summary":"...","sections":[{"heading":"...","body":"..."},{"heading":"...","body":"..."}],"sources":["URL"]}],"exams":[{"id":"exam-1","title":"Đề mô phỏng ...","durationMinutes":90,"questions":[{"id":"q-1","module":"math","level":"L3","scenario":true,"context":"Bối cảnh công việc chi tiết...","prompt":"Quyết định nào tối ưu và vì sao?","options":{"A":"...","B":"...","C":"...","D":"..."},"correct":"A","explanations":{"A":"Tại sao tối ưu trong bối cảnh...","B":"Sai lầm/đánh đổi...","C":"Sai lầm/đánh đổi...","D":"Sai lầm/đánh đổi..."},"sources":["URL"]}]}]}.\nTạo 4 bài học (mỗi module một bài với >=2 mục lý thuyết và ví dụ ứng dụng), 1 đề 20 câu/90 phút: 5 câu mỗi module, ít nhất 15 câu tình huống thực tế với 4 lựa chọn gây nhiễu hợp lý, phân tích đúng và cả ba sai; tránh câu hỏi định nghĩa đơn thuần. Mỗi câu và bài dẫn tối thiểu một URL đúng của module trong danh sách: ${JSON.stringify(SOURCE_LINKS)}. Không sao chép nguyên văn kho nguồn, không bịa trích dẫn trang cụ thể. Nội dung đầu ra là bản nháp cần kiểm duyệt. Explanations phân tích gắn với tình huống.`;
}

async function generate() {
  const key = process.env.OMNIROUTE_API_KEY;
  if (!key) throw new Error('Thiếu OMNIROUTE_API_KEY trong môi trường local');
  const endpoint = process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1';
  if (!/^https?:\/\//.test(endpoint)) throw new Error('OMNIROUTE_BASE_URL phải là URL http(s)');
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OMNIROUTE_MODEL || 'cx/gpt-6-sol', temperature: 0.6, messages: [{role:'system',content:'Chỉ trả JSON hợp lệ; không thêm markdown.'},{role:'user',content:prompt()}] }), signal: AbortSignal.timeout(180000)
  });
  if (!response.ok) throw new Error(`OmniRoute trả HTTP ${response.status} (không in nội dung phản hồi vì có thể chứa thông tin nhạy cảm)`);
  const result = await response.json();
  const raw = result.choices?.[0]?.message?.content;
  if (typeof raw !== 'string') throw new Error('Model không trả về nội dung dạng text');
  const catalog = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  await mkdir(resolve(ROOT, 'content/drafts'), { recursive: true });
  await writeFile(DRAFT, JSON.stringify(catalog, null, 2) + '\n');
  const errors = validate(catalog);
  console.log(errors.length ? `Đã lưu nháp nhưng CHƯA hợp lệ:\n${errors.join('\n')}` : 'Đã lưu nháp hợp lệ. Hãy kiểm tra kỹ nội dung rồi chạy npm run publish -- --approve-reviewed.');
  if (errors.length) process.exitCode = 1;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'generate') return generate();
  if (!['validate', 'publish'].includes(command)) throw new Error('Sử dụng: npm run generate | npm run validate | npm run publish -- --approve-reviewed');
  if (command === 'publish' && !args.includes('--approve-reviewed')) throw new Error('Cần --approve-reviewed sau khi đã rà soát bản nháp và sao chép thủ công vào content/reviewed/catalog.json');
  const path = command === 'publish' ? REVIEWED : (args[0] || DRAFT);
  const catalog = JSON.parse(await readFile(path, 'utf8'));
  const errors = validate(catalog);
  if (errors.length) throw new Error(`Chưa hợp lệ:\n${errors.join('\n')}`);
  if (command === 'publish') { await mkdir(resolve(ROOT, 'public/content'), {recursive:true}); await copyFile(REVIEWED, PUBLISHED); console.log('Đã xuất bản bản được duyệt vào public/content/catalog.json; hãy kiểm tra diff trước khi push.'); }
  else console.log('Nội dung hợp lệ về cấu trúc; chưa bảo đảm đúng chuyên môn, cần người duyệt.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
