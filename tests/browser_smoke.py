from playwright.sync_api import sync_playwright

SOURCE = 'https://github.com/mml-book/mml-book.github.io'
MODULES = ['math', 'engineering', 'ai', 'ethics']

def catalog():
    lessons = [{'id': f'lesson-{m}', 'module': m, 'title': f'Bài học {m} ứng dụng', 'summary': 'Một bài học về những quyết định kỹ thuật.', 'sections': [{'heading': 'Tình huống triển khai', 'body': 'Kiểm tra giả định bằng số liệu.'}, {'heading': 'Đánh đổi và kiểm chứng', 'body': 'Cân nhắc chi phí trước khi triển khai.'}], 'sources': [SOURCE]} for m in MODULES]
    questions = []
    for m in MODULES:
        for i in range(5):
            questions.append({'id': f'{m}-{i}', 'module': m, 'level': 'L3', 'scenario': True, 'context': f'Một đội {m} đang triển khai sản phẩm AI và cần so sánh phương án.', 'prompt': f'Câu hỏi {m} số {i + 1}: nên kiểm tra gì?', 'options': {k: f'Phương án {k} với một kiểm chứng riêng biệt.' for k in 'ABCD'}, 'correct': 'A', 'explanations': {k: f'Giải thích lựa chọn {k} theo bối cảnh.' for k in 'ABCD'}, 'sources': [SOURCE]})
    return {'lessons': lessons, 'exams': [{'id': 'exam-1', 'title': 'Đề mô phỏng kiểm thử', 'durationMinutes': 90, 'questions': questions}]}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium')
    for label, width, height in [('desktop', 1440, 900), ('mobile', 390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:5173/')
        page.wait_for_load_state('networkidle')
        print(label, page.locator('html').evaluate('(el) => [el.scrollWidth, el.scrollHeight]'))
        page.screenshot(path=f'/tmp/on-tap-{label}.png', full_page=False)
        assert page.get_by_text('Phòng học đang chờ bài giảng đầu tiên.').count() == 1
        assert page.locator('html').evaluate('(el) => el.scrollWidth <= window.innerWidth'), f'horizontal overflow on {label}'
        if label == 'mobile':
            page.get_by_role('button', name='Mở menu').click()
            assert page.get_by_role('navigation', name='Điều hướng chính').is_visible()
            page.get_by_role('button', name='Đóng menu').click()
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
        page.once('dialog', lambda dialog: dialog.accept())
        page.get_by_role('button', name='Nộp bài & xem kết quả').click()
        print('result screen:', page.locator('main').inner_text()[:220])
        assert page.get_by_text('Bạn đã chọn: A · Đáp án đúng: A').first.is_visible()
        assert page.get_by_text('Giải thích lựa chọn B theo bối cảnh.').first.is_visible()
        assert not errors, f'{label} browser errors: {errors}'
        print(f'{label}: empty-state, lessons, timer, answer hiding, submit/review passed')
        page.close()
    browser.close()
