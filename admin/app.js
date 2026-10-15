const root = document.querySelector('#app');
const token = root.dataset.token;
const el = id => document.getElementById(id);
const labels = { math:'Toán & định lượng',engineering:'Python / NumPy / pandas',ai:'AI & sản phẩm',ethics:'Logic & đạo đức' };
let version = null;
let dirty = false;
let lastPhase = '';
function escape(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function step(label, note, state, number) { return `<li class="${state}"><span class="step-dot">${number}</span><b>${label}</b>${note}</li>`; }
function preview(catalog) {
  if (!catalog) return '';
  const lessons = catalog.lessons || [];
  const questions = catalog.exams?.[0]?.questions || [];
  return `<details><summary>${lessons.length} bài học · mở xem nội dung</summary>${lessons.map(lesson => `<h3>${escape(lesson.title)}</h3><p>${escape(lesson.summary)}</p>${(lesson.sections || []).map(section => `<h4>${escape(section.heading)}</h4><p>${escape(section.body)}</p>`).join('')}<p>Nguồn: ${(lesson.sources || []).map(escape).join(', ')}</p>`).join('')}</details><details><summary>${questions.length} câu hỏi · mở xem đáp án & lời giải</summary><ol>${questions.map(q => `<li><strong>${escape(labels[q.module] || q.module)} · ${escape(q.level)} · ${escape(({mcq:'Trắc nghiệm',code:'Code tay',essay:'Tự luận'})[q.type] || q.type)} · ${escape(q.points)} điểm</strong><p>${escape(q.context)}</p><p>${escape(q.prompt)}</p>${q.type === 'mcq' ? `<ul>${['A','B','C','D'].map(k => `<li><b>${k}${q.correct === k ? ' ✓' : ''}:</b> ${escape(q.options?.[k])}<br>${escape(q.explanations?.[k])}</li>`).join('')}</ul>` : `<h4>Đáp án mẫu</h4><pre>${escape(q.modelAnswer)}</pre><h4>Rubric · tiêu chí chấm</h4><ul>${(Array.isArray(q.rubric) ? q.rubric : []).map(item => `<li>${escape(item)}</li>`).join('')}</ul>`}<p>Nguồn: ${(q.sources || []).map(escape).join(', ')}</p></li>`).join('')}</ol></details>`;
}
function update(state) {
  const {job,draft} = state;
  const active = ['generating','validating','publishing','deploying'].includes(job.phase);
  el('generate').disabled = active;
  el('save').disabled = active || !draft;
  el('job-message').textContent = job.message;
  el('job-message').classList.toggle('status-error',['failed','invalid','publish-failed'].includes(job.phase));
  el('status-pill').textContent = ({idle:'Sẵn sàng',generating:'Đang tạo',validating:'Đang kiểm tra',review:'Chờ duyệt',invalid:'Cần sửa',failed:'Tạo thất bại',publishing:'Đang xuất bản',deploying:'Chờ triển khai',deployed:'Đã đăng', 'publish-failed':'Đăng thất bại'})[job.phase] || job.phase;
  el('modules').innerHTML = (job.steps || []).map(s => `<div class="module-step ${s.state}"><strong>${escape(s.label)}</strong><small>${({pending:'Chưa bắt đầu',working:'Đang tạo…',done:'Hoàn thành',failed:'Thất bại'})[s.state]}</small></div>`).join('');
  const hasDraft = !!draft;
  if (hasDraft && !dirty && version !== draft.version) {
    version = draft.version;
    el('editor').value = JSON.stringify(draft.catalog,null,2);
    el('approve').checked = false;
    el('preview').innerHTML = preview(draft.catalog);
    el('version-label').textContent = `Phiên bản ${version.slice(0,10)}`;
  }
  el('review-summary').textContent = hasDraft ? `${draft.catalog.lessons?.length || 0} bài học · ${draft.catalog.exams?.[0]?.questions?.length || 0} câu hỏi · ${draft.errors.length ? `${draft.errors.length} lỗi cấu trúc` : 'Cấu trúc đạt'}${dirty ? ' · thay đổi chưa lưu' : ''}` : 'Chưa có bản nháp. Bắt đầu tạo để xem, sửa và duyệt.';
  el('validation').textContent = hasDraft ? draft.errors.length ? draft.errors.join(' · ') : 'Cấu trúc hợp lệ; bạn vẫn cần duyệt chuyên môn.' : '';
  el('validation').className = hasDraft && draft.errors.length ? 'status-error' : 'status-success';
  el('publish').disabled = active || !hasDraft || !!draft.errors.length || dirty || !el('approve').checked;
  el('steps').innerHTML = [
    step('Tạo nội dung','60 câu · 90 phút · 100 điểm',active && job.phase === 'generating' ? 'active' : job.steps?.every(s=>s.state === 'done') ? 'complete' : job.phase === 'failed' ? 'failed' : '',1),
    step('Xem & sửa nháp','Đọc bài học và đáp án',hasDraft ? 'complete' : '',2),
    step('Duyệt bản cụ thể','Xác nhận trước khi gửi',job.phase === 'publishing' ? 'active' : '',3),
    step('Kiểm tra web thật','Chờ GitHub Actions và URL',job.phase === 'deployed' ? 'complete' : job.phase === 'deploying' ? 'active' : job.phase === 'publish-failed' ? 'failed' : '',4)
  ].join('');
  if (job.phase === 'deployed') el('deploy-status').innerHTML = `Đã xác nhận trên <a href="${escape(job.deployment)}" target="_blank" rel="noopener noreferrer">web công khai ↗</a>. Commit ${escape(job.commit?.slice(0,10))}.`;
  else el('deploy-status').textContent = ['publishing','deploying','publish-failed'].includes(job.phase) ? job.message : 'Chưa có phiên xuất bản nào trong lượt này.';
  if (lastPhase === 'generating' && job.phase === 'review') el('review-heading').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  lastPhase = job.phase;
}
async function api(path, data) {
  const response = await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':token},body:JSON.stringify(data || {})});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}
async function refresh() {
  try { const response = await fetch('/api/state',{cache:'no-store'}); if (!response.ok) throw new Error('Không kết nối được server local.'); update(await response.json()); }
  catch(error) { el('job-message').textContent = error.message; el('job-message').classList.add('status-error'); }
}
el('generate').addEventListener('click',async () => {
  if (dirty && !confirm('Có sửa đổi chưa lưu. Tạo mới sẽ thay thế bản nháp hiện tại sau khi hoàn tất. Tiếp tục?')) return;
  if (version && !confirm('Tạo bộ mới sẽ thay thế bản nháp local hiện tại sau khi hoàn tất. Tiếp tục?')) return;
  try { await api('/api/generate'); dirty = false; el('approve').checked = false; await refresh(); } catch(error) { alert(error.message); }
});
el('editor').addEventListener('input',() => { dirty = true; el('approve').checked = false; el('publish').disabled = true; el('review-summary').textContent = 'Bạn có sửa đổi chưa lưu. Lưu & kiểm tra trước khi đăng.'; });
el('save').addEventListener('click',async () => {
  try {
    const catalog = JSON.parse(el('editor').value);
    const result = await api('/api/draft',{version,catalog});
    version = result.version;
    el('version-label').textContent = `Phiên bản ${version.slice(0,10)}`;
    dirty = false;
    el('approve').checked = false;
    await refresh();
    el('preview').innerHTML = preview(catalog);
  } catch(error) { el('validation').textContent = `Không lưu: ${error.message}`; el('validation').className = 'status-error'; }
});
el('approve').addEventListener('change',() => { el('publish').disabled = !el('approve').checked || dirty || !version || !!el('validation').classList.contains('status-error'); });
el('publish').addEventListener('click',async () => {
  if (!version || dirty || !el('approve').checked) return;
  if (!confirm(`Bạn xác nhận đã duyệt bản ${version.slice(0,10)} và muốn đăng công khai? Hành động sẽ commit/push nội dung lên GitHub.`)) return;
  try { await api('/api/publish',{version,confirm:true}); el('approve').checked = false; await refresh(); } catch(error) { alert(error.message); }
});
if (window.gsap) {
  const mm = window.gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const intro = window.gsap.timeline({ defaults: { duration: .65, ease: 'power2.out' } });
    intro.from('.masthead', { y: -16, opacity: 0 })
      .from('.intro h1, .scope-label, .intro-copy', { y: 18, opacity: 0, stagger: .12 }, '-=.35')
      .from('.orbit', { scale: .88, opacity: 0 }, '-=.5')
      .from('.rail, .generate-panel', { y: 16, opacity: 0, stagger: .1 }, '-=.35');
    return () => intro.kill();
  });
}
refresh();setInterval(refresh,1800);
