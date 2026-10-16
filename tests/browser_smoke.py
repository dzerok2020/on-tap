import json
import os
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get('ON_TAP_TEST_URL', 'http://127.0.0.1:5173/')

SOURCE = 'https://github.com/mml-book/mml-book.github.io'
MODULES = ['math', 'engineering', 'ai', 'ethics']

def catalog():
    lessons = [{'id': f'lesson-{m}', 'module': m, 'title': f'Bài học {m} ứng dụng', 'summary': 'Một bài học về những quyết định kỹ thuật.', 'sections': [{'heading': 'Tình huống triển khai', 'body': 'Kiểm tra giả định bằng số liệu.'}, {'heading': 'Đánh đổi và kiểm chứng', 'body': 'Cân nhắc chi phí trước khi triển khai.'}], 'sources': [SOURCE]} for m in MODULES]
    questions = []
    sources = {
        'math': SOURCE,
        'engineering': 'https://docs.python.org/3/tutorial/',
        'ai': 'https://github.com/d2l-ai/d2l-en',
        'ethics': 'https://github.com/brandonhimpfen/awesome-ai-ethics',
    }
    for lesson in lessons:
        lesson['sources'] = [sources[lesson['module']]]
    for m, count, mcq_points, open_type, open_count, open_points in [
        ('math', 10, 1, 'essay', 0, 0),
        ('engineering', 20, 1.5, 'code', 2, 2.5),
        ('ai', 18, 1.5, 'essay', 2, 4),
        ('ethics', 7, 2, 'essay', 1, 6),
    ]:
        for i in range(count + open_count):
            q = {'id': f'{m}-{i}', 'module': m, 'type': 'mcq' if i < count else open_type, 'points': mcq_points if i < count else open_points, 'level': 'L3', 'scenario': True, 'context': f'Một đội {m} đang triển khai sản phẩm AI và cần so sánh phương án.', 'prompt': f'Câu hỏi {m} số {i + 1}: nên kiểm tra gì?', 'sources': [sources[m]]}
            if q['type'] == 'mcq':
                q.update(options={k: f'Phương án {k} với một kiểm chứng riêng biệt.' for k in 'ABCD'}, correct='A', explanations={k: f'Giải thích lựa chọn {k} theo bối cảnh.' for k in 'ABCD'})
            else:
                q.update(modelAnswer='Đáp án mẫu: kiểm tra dữ liệu đầu vào, xử lý giá trị thiếu và kiểm thử kết quả trước triển khai.', rubric=['Kiểm tra dữ liệu đầu vào', 'Xử lý giá trị thiếu an toàn', 'Kiểm chứng kết quả đầu ra'])
            questions.append(q)
    return {'lessons': lessons, 'exams': [{'id': 'exam-1', 'title': 'Đề mô phỏng kiểm thử', 'durationMinutes': 90, 'totalPoints': 100, 'questions': questions}]}

FIXTURE = catalog()
# Keep browser mocks governed by the production validator, not a parallel schema.
validation = subprocess.run(['node', '--input-type=module', '-e', "import {validate} from './scripts/content.mjs'; let text=''; for await (const chunk of process.stdin) text+=chunk; const errors=validate(JSON.parse(text)); if(errors.length){console.error(errors);process.exit(1)}"], input=json.dumps(FIXTURE), text=True, capture_output=True, cwd=Path(__file__).resolve().parents[1])
assert validation.returncode == 0, validation.stderr

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium')
    for label, width, height in [('desktop', 1440, 900), ('mobile', 390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1, reduced_motion='reduce' if label == 'mobile' else 'no-preference')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('**/content/catalog.json', lambda route: route.fulfill(status=404))
        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')
        print(label, page.locator('html').evaluate('(el) => [el.scrollWidth, el.scrollHeight]'))
        page.screenshot(path=f'/tmp/on-tap-{label}.png', full_page=False)
        assert page.get_by_text('Phòng học đang chờ bài giảng đầu tiên.').count() == 1
        assert page.locator('html').evaluate('(el) => el.scrollWidth <= window.innerWidth'), f'horizontal overflow on {label}'
        if label == 'mobile':
            page.get_by_role('button', name='Mở menu').click()
            assert page.get_by_role('navigation', name='Điều hướng chính').is_visible()
            page.get_by_role('button', name='Đóng menu').click()
        page.route('**/content/catalog.json', lambda route: route.fulfill(status=200, json={'lessons': [], 'exams': [{'questions': [{}] * 20}]}))
        page.reload(wait_until='networkidle')
        assert page.get_by_text('Phòng học đang chờ bài giảng đầu tiên.').count() == 1
        page.route('**/content/catalog.json', lambda route: route.fulfill(status=200, json=catalog()))
        page.reload()
        page.wait_for_load_state('networkidle')
        assert page.get_by_text('4 bài học · 1 đề thi đã được duyệt').count() == 1
        page.get_by_role('button', name='Khám phá bài học').click()
        assert page.get_by_text('Bài học math ứng dụng').is_visible()
        page.get_by_role('button', name='03 AI & sản phẩm').click()
        assert page.get_by_text('Bài học ai ứng dụng').is_visible()
        if label == 'mobile':
            page.get_by_role('button', name='Mở menu').click()
        page.get_by_role('button', name='Thi thử', exact=True).click()
        assert page.get_by_role('timer').inner_text().strip() == '01:30:00'
        assert page.get_by_text('Câu hỏi math số 1: nên kiểm tra gì?').is_visible()
        assert not page.get_by_text('Giải thích lựa chọn A theo bối cảnh.').is_visible()
        page.get_by_role('radio', name='A Phương án A với một kiểm chứng riêng biệt.').check()
        assert page.locator('.question-dots button').count() == 60
        page.get_by_role('button', name='Câu 31', exact=True).click()
        response = 'def validate(data):\n    return data.dropna()'
        page.get_by_role('textbox', name='Bài làm code / pseudo-code').fill(response)
        assert page.get_by_text('Đáp án mẫu:', exact=False).count() == 0
        assert page.get_by_text('Tiêu chí tự chấm', exact=True).count() == 0
        page.get_by_role('button', name='Câu 32', exact=True).click()
        page.get_by_role('textbox', name='Bài làm code / pseudo-code').fill('   ')
        page.get_by_role('button', name='Câu 51', exact=True).click()
        page.get_by_role('textbox', name='Bài làm tự luận').fill('Đối chiếu số liệu, đánh giá rủi ro và kiểm chứng kết quả.')
        page.get_by_role('button', name='Câu 60', exact=True).click()
        page.get_by_role('textbox', name='Bài làm tự luận').fill('Bảo vệ dữ liệu riêng tư và công khai giới hạn của hệ thống.')
        page.get_by_role('button', name='Câu 31, đã trả lời', exact=True).click()
        assert page.get_by_role('textbox').input_value() == response
        page.get_by_role('button', name='Câu 1, đã trả lời', exact=True).click()
        assert page.get_by_role('radio', name='A Phương án A với một kiểm chứng riêng biệt.').is_checked()
        page.screenshot(path=f'/tmp/on-tap-exam-{label}.png', full_page=True)
        for number in [11, 33, 53]:
            page.get_by_role('button', name=f'Câu {number}', exact=True).click()
            page.get_by_role('radio', name='A Phương án A với một kiểm chứng riêng biệt.').check()
        page.once('dialog', lambda dialog: dialog.accept())
        page.get_by_role('button', name='Nộp bài & xem kết quả').click()
        print('result screen:', page.locator('main').inner_text()[:220])
        assert page.get_by_text('Bạn đã chọn: A · Đáp án đúng: A').first.is_visible()
        assert page.get_by_text('Giải thích lựa chọn B theo bối cảnh.').first.is_visible()
        assert '6 / 81 điểm' in page.get_by_test_id('mcq-score').inner_text()
        assert '3 câu chờ tự chấm' in page.get_by_test_id('pending-count').inner_text()
        assert '2 câu mở bỏ trống' in page.get_by_test_id('pending-count').inner_text()
        code_review = page.locator('[data-question-id="engineering-20"]')
        assert code_review.locator('pre').first.inner_text() == response
        assert code_review.get_by_text('Tiêu chí tự chấm', exact=True).is_visible()
        code_review.get_by_role('button', name='Đạt · 2,5 điểm', exact=True).click()
        assert '2,5 / 19 điểm' in page.get_by_test_id('open-score').inner_text()
        assert '2 câu chờ tự chấm' in page.get_by_test_id('pending-count').inner_text()
        code_review.get_by_role('button', name='Chưa đạt · 0 điểm', exact=True).click()
        assert '0 / 19 điểm' in page.get_by_test_id('open-score').inner_text()
        blank_review = page.locator('[data-question-id="engineering-21"]')
        assert blank_review.get_by_role('button', name='Đạt · 2,5 điểm', exact=True).is_disabled()
        page.locator('[data-question-id="ai-18"]').get_by_role('button', name='Đạt · 4 điểm', exact=True).click()
        page.locator('[data-question-id="ethics-7"]').get_by_role('button', name='Đạt · 6 điểm', exact=True).click()
        assert '10 / 19 điểm' in page.get_by_test_id('open-score').inner_text()
        assert '0 câu chờ tự chấm' in page.get_by_test_id('pending-count').inner_text()
        assert '4 / 8' in page.get_by_role('row', name='AI & sản phẩm').inner_text()
        assert '1,5 / 30' in page.get_by_role('row', name='Python / NumPy / Pandas').inner_text()
        assert '2 / 14' in page.get_by_role('row', name='Logic & đạo đức').inner_text()
        assert page.locator('html').evaluate('(el) => el.scrollWidth <= window.innerWidth'), f'result overflow on {label}'
        page.evaluate('window.scrollTo(0, 0)')
        page.screenshot(path=f'/tmp/on-tap-result-{label}.png', full_page=False)
        page.get_by_role('button', name='Làm lại đề').click()
        page.get_by_role('button', name='Câu 31', exact=True).click()
        assert page.get_by_role('textbox').input_value() == ''
        assert page.get_by_text('Tiêu chí tự chấm', exact=True).count() == 0
        library = catalog()
        extra = catalog()
        for lesson in extra['lessons']:
            lesson['id'] = 'new-' + lesson['id']
            lesson['title'] = 'Bài học mới ' + lesson['module']
        extra['exams'][0]['id'] = 'exam-2'
        extra['exams'][0]['title'] = 'Đề mới tích lũy'
        extra['exams'][0]['questions'][0]['prompt'] = 'Câu đầu tiên của bộ mới tích lũy?'
        for q in extra['exams'][0]['questions']:
            q['id'] = 'new-' + q['id']
        library['lessons'] += extra['lessons']
        library['exams'] += extra['exams']
        page.route('**/content/catalog.json', lambda route: route.fulfill(status=200, json=library))
        page.reload(wait_until='networkidle')
        assert page.get_by_text('8 bài học · 2 đề thi đã được duyệt').count() == 1
        page.get_by_role('button', name='Đề 2: Đề mới tích lũy').click()
        assert page.get_by_text('Câu đầu tiên của bộ mới tích lũy?').is_visible()
        page.get_by_role('button', name='Về trang chủ').click()
        page.get_by_role('button', name='Đề 1: Đề mô phỏng kiểm thử').click()
        assert page.get_by_text('Câu hỏi math số 1: nên kiểm tra gì?').is_visible()
        page.get_by_role('button', name='Về trang chủ').click()
        page.get_by_role('button', name='Khám phá bài học').click()
        assert page.get_by_text('Bài học math ứng dụng', exact=True).is_visible()
        assert page.get_by_text('Bài học mới math', exact=True).is_visible()
        assert page.locator('html').evaluate('(el) => el.scrollWidth <= window.innerWidth')
        page.screenshot(path=f'/tmp/on-tap-library-{label}.png', full_page=True)
        assert not errors, f'{label} browser errors: {errors}'
        print(f'{label}: empty-state, lessons, timer, answer hiding, submit/review and cumulative library passed')
        page.close()
    browser.close()
