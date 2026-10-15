import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MODULES = ['math', 'engineering', 'ai', 'ethics'];
export const MODULE_META = {
  math: { letter: 'A', label: 'Toán & định lượng' },
  engineering: { letter: 'B', label: 'Python / NumPy / Pandas' },
  ai: { letter: 'C', label: 'AI & tư duy sản phẩm' },
  ethics: { letter: 'D', label: 'Logic & đạo đức' }
};
export const SOURCE_LINKS = {
  math: ['https://github.com/mml-book/mml-book.github.io', 'https://github.com/scikit-learn/scikit-learn'],
  engineering: ['https://docs.python.org/3/tutorial/', 'https://numpy.org/doc/stable/user/absolute_beginners.html', 'https://pandas.pydata.org/docs/user_guide/10min.html', 'https://github.com/donnemartin/system-design-primer', 'https://github.com/google/eng-practices', 'https://github.com/ryanmcdermott/clean-code-javascript'],
  ai: ['https://github.com/d2l-ai/d2l-en', 'https://github.com/GokuMohandas/Made-With-ML', 'https://github.com/PAIR-code/interpretability'],
  ethics: ['https://github.com/brandonhimpfen/awesome-ai-ethics', 'https://github.com/OWASP/www-project-top-10-for-large-language-model-applications', 'https://github.com/ethicalml/awesome-artificial-intelligence-guidelines']
};

// Cấu trúc 60 câu / 100 điểm / 90 phút theo bốn module A–D.
// 55 trắc nghiệm + 2 câu code tay (module B) + 3 tự luận (2 ở C, 1 ở D).
export const EXAM_STRUCTURE = {
  durationMinutes: 90,
  totalPoints: 100,
  modules: {
    math: { total: 10, mcq: 10, code: 0, essay: 0, mcqPoints: 1 },
    engineering: { total: 22, mcq: 20, code: 2, essay: 0, mcqPoints: 1.5, codePoints: 2.5 },
    ai: { total: 20, mcq: 18, code: 0, essay: 2, mcqPoints: 1.5, essayPoints: 4 },
    ethics: { total: 8, mcq: 7, code: 0, essay: 1, mcqPoints: 2, essayPoints: 6 }
  }
};
export const QUESTION_TYPES = ['mcq', 'code', 'essay'];
export const EXAM_QUESTION_COUNT = Object.values(EXAM_STRUCTURE.modules).reduce((total, spec) => total + spec.total, 0);

const ROOT = resolve(import.meta.dirname, '..');
const DRAFT = resolve(ROOT, 'content/drafts/catalog.json');
const REVIEWED = resolve(ROOT, 'content/reviewed/catalog.json');
const PUBLISHED = resolve(ROOT, 'public/content/catalog.json');
const letters = ['A', 'B', 'C', 'D'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const own = (value, key) => record(value) && Object.hasOwn(value, key);
const present = value => typeof value === 'string' && value.trim().length >= 12;
const presentShort = value => typeof value === 'string' && value.trim().length >= 8;
const validId = value => typeof value === 'string' && Boolean(value.trim()) && !(value in Object.prototype);

export function expectedPoints(module, type) {
  const spec = MODULES.includes(module) ? EXAM_STRUCTURE.modules[module] : undefined;
  if (!spec) return NaN;
  if (type === 'mcq') return spec.mcqPoints;
  if (type === 'code') return spec.codePoints;
  if (type === 'essay') return spec.essayPoints;
  return NaN;
}

export function expectedCounts(module) {
  const spec = MODULES.includes(module) ? EXAM_STRUCTURE.modules[module] : undefined;
  return spec ? { total: spec.total, mcq: spec.mcq, code: spec.code, essay: spec.essay } : { total: 0, mcq: 0, code: 0, essay: 0 };
}

export function summarize(catalog) {
  const questions = Array.isArray(catalog?.exams?.[0]?.questions) ? catalog.exams[0].questions : [];
  const modules = {};
  for (const module of MODULES) modules[module] = { letter: MODULE_META[module].letter, label: MODULE_META[module].label, total: 0, mcq: 0, code: 0, essay: 0, points: 0, expected: expectedCounts(module) };
  let points = 0;
  let scenarios = 0;
  for (const q of questions) {
    if (Number.isFinite(q?.points)) points += q.points;
    if (q?.scenario === true) scenarios++;
    const bucket = MODULES.includes(q?.module) ? modules[q.module] : undefined;
    if (!bucket) continue;
    bucket.total += 1;
    if (QUESTION_TYPES.includes(q?.type)) bucket[q.type] += 1;
    if (Number.isFinite(q?.points)) bucket.points += q.points;
  }
  return {
    lessons: Array.isArray(catalog?.lessons) ? catalog.lessons.length : 0,
    questions: questions.length,
    points: Math.round(points * 100) / 100,
    modules,
    scenarios: { count: scenarios, ratio: questions.length ? scenarios / questions.length : 0 }
  };
}

export function validate(catalog) {
  const errors = [];
  if (!record(catalog)) return ['Catalog không phải object'];
  if (!Array.isArray(catalog.lessons) || !Array.isArray(catalog.exams)) return ['Thiếu lessons hoặc exams'];
  if (!catalog.lessons.length) errors.push('Thiếu bài học');
  if (!catalog.exams.length) errors.push('Thiếu đề');
  const ids = new Set();
  for (const lesson of catalog.lessons) {
    if (!record(lesson) || !MODULES.includes(lesson.module) || !present(lesson.title) || !present(lesson.summary) || !Array.isArray(lesson.sections) || lesson.sections.length < 2) {
      errors.push(`Bài học thiếu trường bắt buộc: ${lesson?.id}`);
    } else {
      if (!Array.from(lesson.sections).every(section => record(section) && present(section.heading) && present(section.body))) errors.push(`Mục bài học không hợp lệ: ${lesson.id}`);
      if (!Array.isArray(lesson.sources) || !lesson.sources.length || !Array.from(lesson.sources).every(link => SOURCE_LINKS[lesson.module].includes(link))) errors.push(`Thiếu nguồn tham khảo: ${lesson.id}`);
    }
    if (typeof lesson?.id !== 'string' || !lesson.id.trim() || ids.has(lesson.id)) errors.push(`ID trùng/thiếu: ${lesson?.id}`);
    ids.add(lesson?.id);
  }
  for (const exam of catalog.exams) {
    if (!record(exam) || !present(exam.title) || exam.durationMinutes !== EXAM_STRUCTURE.durationMinutes || !Array.isArray(exam.questions)) {
      errors.push(`Đề thiếu tiêu đề hoặc sai thời lượng ${EXAM_STRUCTURE.durationMinutes} phút: ${exam?.id}`);
      continue;
    }
    if (typeof exam.id !== 'string' || !exam.id.trim() || ids.has(exam.id)) errors.push(`ID trùng/thiếu: ${exam.id}`);
    ids.add(exam.id);
    if (exam.questions.length !== EXAM_QUESTION_COUNT) {
      errors.push(`Đề phải có đúng ${EXAM_QUESTION_COUNT} câu, đang có ${exam.questions.length}: ${exam.id}`);
      continue;
    }
    if (exam.totalPoints !== EXAM_STRUCTURE.totalPoints) errors.push(`Đề phải khai tổng ${EXAM_STRUCTURE.totalPoints} điểm: ${exam.id}`);
    const counts = Object.fromEntries(MODULES.map(module => [module, { total: 0, mcq: 0, code: 0, essay: 0 }]));
    let points = 0;
    let scenarios = 0;
    for (const q of exam.questions) {
      if (!record(q) || !MODULES.includes(q.module)) { errors.push(`Câu hỏi thiếu module hợp lệ: ${q?.id}`); continue; }
      if (!validId(q.id) || ids.has(q.id)) errors.push(`ID trùng/thiếu: ${q.id}`);
      ids.add(q.id);
      if (typeof q.scenario !== 'boolean') errors.push(`scenario phải là boolean: ${q.id}`);
      if (q.scenario === true) scenarios++;
      const letter = MODULE_META[q.module].letter;
      if (!QUESTION_TYPES.includes(q.type)) { errors.push(`Loại câu hỏi phải là mcq/code/essay: ${q.id}`); continue; }
      counts[q.module].total += 1;
      counts[q.module][q.type] += 1;
      if (!present(q.context) || !present(q.prompt) || !['L3', 'L4'].includes(q.level)) errors.push(`Câu hỏi thiếu ngữ cảnh, yêu cầu hoặc cấp độ L3/L4: ${q.id}`);
      const expected = expectedPoints(q.module, q.type);
      if (!Number.isFinite(expected)) errors.push(`Module ${letter} không có câu loại ${q.type}: ${q.id}`);
      else if (!Number.isFinite(q.points) || Math.abs(q.points - expected) > 1e-9) errors.push(`Điểm câu ${q.id} phải là ${expected} (module ${letter}, ${q.type})`);
      else points += q.points;
      if (q.type === 'mcq') {
        if (!record(q.options) || letters.some(key => !own(q.options, key) || !present(q.options[key])) || !letters.includes(q.correct) || !record(q.explanations) || letters.some(key => !own(q.explanations, key) || !present(q.explanations[key]))) errors.push(`Phương án hoặc lời giải A–D không đầy đủ: ${q.id}`);
      } else {
        if (!present(q.modelAnswer) || q.modelAnswer.trim().length < 40) errors.push(`Đáp án mẫu quá ngắn: ${q.id}`);
        if (!Array.isArray(q.rubric) || q.rubric.length < 3 || !Array.from(q.rubric).every(item => presentShort(item))) errors.push(`Rubric cần ít nhất 3 tiêu chí rõ ràng: ${q.id}`);
      }
      if (!Array.isArray(q.sources) || !q.sources.length || !Array.from(q.sources).every(link => SOURCE_LINKS[q.module].includes(link))) errors.push(`Nguồn tham khảo không hợp lệ: ${q.id}`);
    }
    if (scenarios < Math.ceil(EXAM_QUESTION_COUNT * 0.7)) errors.push(`Đề cần ít nhất 70% câu tình huống (42/60), đang có ${scenarios}: ${exam.id}`);
    for (const module of MODULES) {
      const actual = counts[module];
      const expect = expectedCounts(module);
      const letter = MODULE_META[module].letter;
      if (actual.total !== expect.total) errors.push(`Module ${letter} cần ${expect.total} câu, đang có ${actual.total}`);
      if (actual.mcq !== expect.mcq) errors.push(`Module ${letter} cần ${expect.mcq} câu trắc nghiệm, đang có ${actual.mcq}`);
      if (actual.code !== expect.code) errors.push(`Module ${letter} cần ${expect.code} câu code tay, đang có ${actual.code}`);
      if (actual.essay !== expect.essay) errors.push(`Module ${letter} cần ${expect.essay} câu tự luận, đang có ${actual.essay}`);
    }
    if (Math.abs(points - EXAM_STRUCTURE.totalPoints) > 1e-9) errors.push(`Tổng điểm câu hỏi phải là ${EXAM_STRUCTURE.totalPoints}, đang có ${Math.round(points * 100) / 100}: ${exam.id}`);
  }
  if (catalog.lessons.length && MODULES.some(module => !catalog.lessons.some(lesson => lesson?.module === module))) errors.push('Thiếu bài học cho một module');
  return errors;
}

export function modulePrompt(module) {
  if (!MODULES.includes(module)) throw new Error('Module không hợp lệ');
  const meta = MODULE_META[module];
  const spec = MODULES.includes(module) ? EXAM_STRUCTURE.modules[module] : undefined;
  const mix = [
    `${spec.mcq} câu trắc nghiệm (${spec.mcqPoints} điểm/câu)`,
    spec.code ? `${spec.code} câu code tay (${spec.codePoints} điểm/câu)` : null,
    spec.essay ? `${spec.essay} câu tự luận (${spec.essayPoints} điểm/câu)` : null
  ].filter(Boolean).join(', ');
  const mcqShape = `{"id":"${module}-mcq-1","module":"${module}","type":"mcq","level":"L3","scenario":true,"points":${spec.mcqPoints},"context":"Bối cảnh công việc cụ thể...","prompt":"Chọn quyết định tốt nhất và giải thích...","options":{"A":"...","B":"...","C":"...","D":"..."},"correct":"A","explanations":{"A":"Vì sao đúng trong bối cảnh","B":"Sai ở đâu","C":"Sai ở đâu","D":"Sai ở đâu"},"sources":["URL"]}`;
  const openShape = (type, points) => `{"id":"${module}-${type}-1","module":"${module}","type":"${type}","level":"L4","scenario":true,"points":${points},"context":"Bối cảnh công việc cụ thể...","prompt":"...","modelAnswer":"Đáp án mẫu đầy đủ, nêu cách làm từng bước để người học tự đối chiếu...","rubric":["Tiêu chí chấm thứ nhất","Tiêu chí chấm thứ hai","Tiêu chí chấm thứ ba"],"sources":["URL"]}`;
  return [
    'Bạn là tác giả nội dung tự học tiếng Việt mức SFIA L3/L4; KHÔNG tự nhận đề thi chính thức VinUni. Chỉ trả DUY NHẤT một JSON object, không markdown.',
    `module ${module} (${meta.label}), module ${meta.letter}, cần đúng ${spec.total} câu: ${mix}.`,
    `Trả JSON {"lesson":{...},"questions":[...]} với lesson dạng {"id":"lesson-${module}-1","module":"${module}","title":"...","summary":"...","sections":[{"heading":"...","body":"..."},{"heading":"...","body":"..."}],"sources":["URL"]}.`,
    `Câu trắc nghiệm dạng ${mcqShape}`,
    spec.code ? `Câu code tay dạng ${openShape('code', spec.codePoints)}` : '',
    spec.essay ? `Câu tự luận dạng ${openShape('essay', spec.essayPoints)}` : '',
    'Câu trắc nghiệm phải có đủ A/B/C/D với phương án nhiễu hợp lý và lời giải riêng cho từng phương án (vì sao đúng hoặc sai trong bối cảnh), không dùng một câu giải thích chung.',
    'Câu code tay yêu cầu viết hàm/pseudo-code cụ thể; câu tự luận yêu cầu trình bày quyết định, đánh đổi và rủi ro. Rubric mỗi câu mở có ít nhất 3 tiêu chí ngắn, chấm được; modelAnswer đủ để người học tự đối chiếu.',
    'Mỗi câu bắt buộc có scenario kiểu boolean. Ít nhất 70% câu trong mỗi module là tình huống thực tế (scenario: true), để toàn đề đạt ít nhất 42/60 câu; hạn chế câu hỏi định nghĩa thuần.',
    module === 'math' ? 'Bao phủ đại số tuyến tính, xác suất, thống kê, đạo hàm và diễn giải định lượng trong bài toán dữ liệu.' : '',
    module === 'engineering' ? 'Bao phủ Python (hàm, cấu trúc dữ liệu, xử lý lỗi), NumPy (array, shape, broadcasting, vectorization) và pandas (DataFrame, lọc, groupby, join, missing data); hai câu code tay dùng Python/NumPy/pandas.' : '',
    module === 'ai' ? 'Bao phủ machine learning, đánh giá mô hình, data leakage, LLM/prompt/RAG, lựa chọn sản phẩm AI, chỉ số và đánh đổi triển khai.' : '',
    module === 'ethics' ? 'Bao phủ suy luận logic, thiên lệch, quyền riêng tư, minh bạch, trách nhiệm và kiểm soát con người trong AI.' : '',
    `Không sao chép nguyên văn kho nguồn, không bịa vị trí trích dẫn. Chỉ dùng các URL đã cấp: ${JSON.stringify(SOURCE_LINKS[module])}`,
    'Đây là bản nháp cần người kiểm duyệt.'
  ].filter(Boolean).join('\n');
}

async function generate() {
  const key = process.env.OMNIROUTE_API_KEY;
  if (!key) throw new Error('Thiếu OMNIROUTE_API_KEY trong môi trường local');
  const endpoint = process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1';
  if (!/^https?:\/\//.test(endpoint)) throw new Error('OMNIROUTE_BASE_URL phải là URL http(s)');
  const clean = endpoint.replace(/\/$/, '');
  const model = process.env.OMNIROUTE_MODEL || 'cx/gpt-6-sol';
  const lessons = [];
  const questions = [];
  for (const module of MODULES) {
    const response = await fetch(`${clean}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0.6, messages: [{ role: 'system', content: 'Chỉ trả JSON hợp lệ; không thêm markdown.' }, { role: 'user', content: modulePrompt(module) }] }),
      signal: AbortSignal.timeout(180000)
    });
    if (!response.ok) throw new Error(`OmniRoute trả HTTP ${response.status} (không in nội dung phản hồi vì có thể chứa thông tin nhạy cảm)`);
    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content;
    if (typeof raw !== 'string') throw new Error('Model không trả về nội dung dạng text');
    let part;
    try {
      part = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    } catch {
      throw new Error(`Module ${module}: model trả JSON không hợp lệ; thử tạo lại.`);
    }
    const expected = expectedCounts(module);
    if (!part?.lesson || !Array.isArray(part.questions) || part.questions.length !== expected.total) throw new Error(`Module ${module}: cần một bài học và ${expected.total} câu hỏi, nhận được ${Array.isArray(part?.questions) ? part.questions.length : 0}.`);
    lessons.push(part.lesson);
    questions.push(...part.questions);
  }
  const catalog = {
    version: 2,
    lessons,
    exams: [{
      id: 'exam-1',
      title: 'Bài kiểm tra ôn tập AI thực chiến',
      description: '60 câu theo 4 module: toán định lượng, Python/NumPy/Pandas, AI/product AI, logic & responsible AI.',
      durationMinutes: EXAM_STRUCTURE.durationMinutes,
      totalPoints: EXAM_STRUCTURE.totalPoints,
      disclaimer: 'Đây chỉ là đề cương ôn tập cộng đồng, không phải đề thi chính thức của VinUni, không cố gắng mô phỏng đề thi thật và không cam kết giống đề thật.',
      questions
    }]
  };
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
  if (command === 'publish') {
    await mkdir(resolve(ROOT, 'public/content'), { recursive: true });
    await copyFile(REVIEWED, PUBLISHED);
    console.log('Đã xuất bản bản được duyệt vào public/content/catalog.json; hãy kiểm tra diff trước khi push.');
  } else console.log('Nội dung hợp lệ về cấu trúc; chưa bảo đảm đúng chuyên môn, cần người duyệt.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
