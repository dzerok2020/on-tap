from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium')
    for label, width, height in [('desktop', 1440, 900), ('mobile', 390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:4174/', wait_until='networkidle')
        assert page.get_by_role('heading', name='Bắt đầu với một bản nháp mới').is_visible()
        assert page.get_by_role('button', name='Tạo bộ nội dung mới').is_visible()
        assert page.get_by_role('button', name='Đăng bản đã duyệt').is_disabled()
        assert page.locator('html').evaluate('(el) => el.scrollWidth <= window.innerWidth'), f'{label}: horizontal overflow'
        page.screenshot(path=f'/tmp/on-tap-admin-{label}.png', full_page=True)
        assert not errors, f'{label}: {errors}'
        print(f'{label}: viewport, controls, no JS error passed')
        page.close()
    browser.close()
