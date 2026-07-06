from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 800})
        
        # Capture Login
        page.goto('http://localhost:3002/auth/login.html')
        page.wait_for_load_state('networkidle')
        page.screenshot(path='demo-video/public/captures/scene4-login.png')

        # Capture Client Portal (from showcase)
        page.goto('http://localhost:3002/showcase.html')
        page.wait_for_load_state('networkidle')
        page.evaluate("document.querySelector('.tab-btn:nth-child(3)').click()")
        page.wait_for_timeout(1000)
        # Capture just the preview container
        clip = page.locator('.preview-container').bounding_box()
        if clip:
            page.screenshot(path='demo-video/public/captures/scene2-calc.png', clip=clip)
        else:
            page.screenshot(path='demo-video/public/captures/scene2-calc.png')

        # Capture Admin Dashboard (from showcase)
        page.evaluate("document.querySelector('.tab-btn:nth-child(1)').click()")
        page.wait_for_timeout(1000)
        clip = page.locator('.preview-container').bounding_box()
        if clip:
            page.screenshot(path='demo-video/public/captures/scene3-dashboard.png', clip=clip)
        else:
            page.screenshot(path='demo-video/public/captures/scene3-dashboard.png')

        browser.close()

if __name__ == '__main__':
    run()
