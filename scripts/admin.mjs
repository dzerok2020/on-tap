import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { confirmDeployment } from './deployment.mjs';
import { publishCatalog } from './publish.mjs';
import { MODULES, MODULE_META, validate, summarize, expectedCounts, modulePrompt, EXAM_STRUCTURE } from './content.mjs';

const exec = promisify(execFile);
const ROOT = resolve(import.meta.dirname, '..');
const DRAFT = resolve(ROOT, 'content/drafts/catalog.json');
const PAGE = resolve(ROOT, 'admin/index.html');
const CSS = resolve(ROOT, 'admin/style.css');
const JS = resolve(ROOT, 'admin/app.js');
const GSAP = resolve(ROOT, 'admin/gsap.min.js');
const moduleNames = Object.fromEntries(MODULES.map(module => [module, MODULE_META[module].label]));
const token = randomBytes(32).toString('hex');
const hash = text => createHash('sha256').update(text).digest('hex');
const normalized = data => JSON.stringify(data, null, 2) + '\n';
let job = { phase: 'idle', steps: [], message: 'Sẵn sàng tạo nội dung.', deployment: null };
let busy = false;
const safeError = error => {
  const message = String(error?.message || error);
  // Do not echo upstream bodies or environment values into the browser.
  return message.replaceAll(process.env.OMNIROUTE_API_KEY || '\u0000', '[ẩn]');
};
const fail = (res, status, message) => json(res, status, { error: message });
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}
async function command(name, args, timeout = 120000) {
  const { stdout } = await exec(name, args, { cwd: ROOT, timeout, maxBuffer: 1024 * 1024 });
  return stdout.trim();
}
async function atomicWrite(path, text) {
  await mkdir(resolve(path, '..'), { recursive: true });
  const temp = `${path}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(temp, text, { mode: 0o600 });
  await rename(temp, path);
}
async function currentDraft() {
  try {
    const text = await readFile(DRAFT, 'utf8');
    const catalog = JSON.parse(text);
    return { catalog, version: hash(text), errors: validate(catalog), summary: summarize(catalog) };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
async function model(messages) {
  const key = process.env.OMNIROUTE_API_KEY;
  if (!key) throw new Error('Thiếu OMNIROUTE_API_KEY trong .env.local hoặc môi trường local.');
  const endpoint = process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1';
  const target = new URL(`${endpoint.replace(/\/$/, '')}/chat/completions`);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('OMNIROUTE_BASE_URL phải dùng HTTP(S).');
  const response = await fetch(target, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OMNIROUTE_MODEL || 'cx/gpt-6-sol', temperature: 0.6, messages }),
    signal: AbortSignal.timeout(180000)
  });
  if (!response.ok) throw new Error(`OmniRoute trả HTTP ${response.status}; kiểm tra dịch vụ/model và thử lại.`);
  const result = await response.json();
  const raw = result.choices?.[0]?.message?.content;
  if (typeof raw !== 'string') throw new Error('Model không trả về text; thử tạo lại.');
  try { return JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
  catch { throw new Error('Model trả JSON không hợp lệ; thử tạo lại.'); }
}
async function generate() {
  const steps = MODULES.map(module => ({ module, label: moduleNames[module], state: 'pending' }));
  job = { phase: 'generating', steps, message: 'Đang tạo từng module; chưa có nội dung nào được đăng.', deployment: null };
  const lessons = [], questions = [];
  try {
    for (const module of MODULES) {
      const step = steps.find(item => item.module === module);
      step.state = 'working';
      job.message = `Đang tạo ${step.label}…`;
      const result = await model([
        { role: 'system', content: 'Chỉ trả một JSON object hợp lệ, không markdown. Viết tiếng Việt. Không nhận là đề VinUni chính thức.' },
        { role: 'user', content: modulePrompt(module) }
      ]);
      const expected = expectedCounts(module);
      if (!result.lesson || !Array.isArray(result.questions) || result.questions.length !== expected.total) throw new Error(`Module ${step.label} cần một bài học và ${expected.total} câu; thử lại.`);
      lessons.push(result.lesson);
      questions.push(...result.questions);
      step.state = 'done';
    }
    job.phase = 'validating';
    job.message = 'Đã tạo 4 module. Đang ghép và kiểm tra cấu trúc…';
    const catalog = { version: 2, lessons, exams: [{ id: `exam-${Date.now()}`, title: 'Bài kiểm tra ôn tập AI thực chiến', description: '60 câu theo 4 module: toán định lượng, Python/NumPy/Pandas, AI/product AI, logic & responsible AI.', durationMinutes: EXAM_STRUCTURE.durationMinutes, totalPoints: EXAM_STRUCTURE.totalPoints, disclaimer: 'Đây chỉ là đề cương ôn tập cộng đồng, không phải đề thi chính thức của VinUni, không cố gắng mô phỏng đề thi thật và không cam kết giống đề thật.', questions }] };
    const text = normalized(catalog);
    await atomicWrite(DRAFT, text);
    const errors = validate(catalog);
    job = { phase: errors.length ? 'invalid' : 'review', steps, message: errors.length ? 'Đã lưu nháp; cần sửa lỗi cấu trúc trước khi đăng.' : 'Đã lưu nháp hợp lệ. Hãy đọc, sửa và duyệt chuyên môn.', errors, version: hash(text), deployment: null };
  } catch (error) {
    const step = steps.find(item => item.state === 'working');
    if (step) step.state = 'failed';
    job = { phase: 'failed', steps, message: safeError(error), deployment: null };
  } finally { busy = false; }
}
async function publish(version) {
  try {
    job = { ...job, phase: 'publishing', message: 'Kiểm tra bản duyệt và chuẩn bị Git cách ly…', deployment: null };
    const assertVersion = async () => {
      const current = await currentDraft();
      if (!current || current.version !== version || current.errors.length) throw new Error('Nháp đã đổi hoặc chưa hợp lệ; tải lại và duyệt lại trước khi đăng.');
    };
    await assertVersion();
    const draft = await currentDraft();
    const { commit, unchanged, catalog: published } = await publishCatalog(ROOT, draft.catalog, {
      assertVersion,
      onProgress: message => { job = { ...job, message }; }
    });
    job = { ...job, phase: 'deploying', message: 'Đã gửi bản duyệt. Đang xác nhận GitHub Actions…', commit };
    await confirmDeployment(commit, { command, retry: unchanged });
    const publicUrl = 'https://dzerok2020.github.io/on-tap/content/catalog.json';
    const response = await fetch(`${publicUrl}?v=${commit}`, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (!response.ok || hash(normalized(await response.json())) !== hash(normalized(published))) throw new Error('Actions thành công nhưng site chưa khớp bản duyệt; kiểm tra lại trước khi chia sẻ.');
    job = { ...job, phase: 'deployed', message: 'Đã xác nhận bản được duyệt hiển thị trên GitHub Pages.', deployment: 'https://dzerok2020.github.io/on-tap/', commit };
  } catch (error) {
    job = { ...job, phase: 'publish-failed', message: safeError(error), deployment: null };
  } finally { busy = false; }
}
async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 2_000_000) throw new Error('Nội dung quá lớn (tối đa 2 MB).');
  }
  return JSON.parse(text);
}
export function startAdmin({ port = Number(process.env.ADMIN_PORT || 4174) } = {}) {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host;
      if (!allowedHosts.has(host)) return fail(res, 403, 'Host không hợp lệ.');
      const origin = req.headers.origin;
      if (origin && (new URL(origin).protocol !== 'http:' || !allowedHosts.has(new URL(origin).host))) return fail(res, 403, 'Origin không hợp lệ.');
      const url = new URL(req.url, `http://${host}`);
      if (req.method === 'GET' && url.pathname === '/') {
        const html = (await readFile(PAGE, 'utf8')).replace('__LOCAL_TOKEN__', token);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'", 'X-Content-Type-Options': 'nosniff' });
        return res.end(html);
      }
      if (req.method === 'GET' && ['/style.css', '/app.js', '/gsap.min.js'].includes(url.pathname)) {
        const isCss = url.pathname === '/style.css';
        res.writeHead(200, { 'Content-Type': isCss ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
        return res.end(await readFile(isCss ? CSS : url.pathname === '/app.js' ? JS : GSAP));
      }
      if (req.method === 'GET' && url.pathname === '/api/state') {
        const draft = await currentDraft();
        return json(res, 200, { job, draft: draft && { catalog: draft.catalog, version: draft.version, errors: draft.errors, summary: draft.summary } });
      }
      if (req.method !== 'POST' || !['/api/generate', '/api/draft', '/api/publish'].includes(url.pathname)) return fail(res, 404, 'Không tìm thấy.');
      if (!origin || new URL(origin).protocol !== 'http:' || !allowedHosts.has(new URL(origin).host) || req.headers['x-local-token'] !== token) return fail(res, 403, 'Yêu cầu không được xác thực từ trang local.');
      if (busy) return fail(res, 409, 'Đang xử lý một tác vụ; hãy đợi.');
      if (url.pathname === '/api/generate') {
        busy = true; void generate();
        return json(res, 202, { message: 'Bắt đầu tạo từng module.' });
      }
      const data = await body(req);
      if (url.pathname === '/api/draft') {
        const old = await currentDraft();
        if (!old || data.version !== old.version) return fail(res, 409, 'Nháp đã thay đổi; tải lại trước khi lưu.');
        const catalog = data.catalog;
        if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) return fail(res, 400, 'Catalog phải là object.');
        const text = normalized(catalog);
        if (text.length > 2_000_000) return fail(res, 413, 'Nháp quá lớn.');
        await atomicWrite(DRAFT, text);
        const errors = validate(catalog);
        job = { ...job, phase: errors.length ? 'invalid' : 'review', errors, version: hash(text), message: errors.length ? 'Đã lưu nháp; sửa lỗi cấu trúc trước khi duyệt.' : 'Đã lưu; cần kiểm tra chuyên môn trước khi đăng.', deployment: null };
        return json(res, 200, { version: hash(text), errors });
      }
      if (!data.confirm || typeof data.version !== 'string') return fail(res, 400, 'Cần xác nhận rõ phiên bản nháp.');
      busy = true; void publish(data.version);
      return json(res, 202, { message: 'Đang kiểm tra bản duyệt và xuất bản.' });
    } catch (error) { return fail(res, 400, safeError(error)); }
  });
  server.listen(port, '127.0.0.1', () => console.log(`Quản trị local: http://127.0.0.1:${port}`));
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startAdmin();
