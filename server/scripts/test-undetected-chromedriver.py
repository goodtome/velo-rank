"""
使用 undetected-chromedriver 绕过 Cloudflare 获取 PCS 数据
"""
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import json

BASE_URL = 'https://www.procyclingstats.com'

def fetch_page(url, wait_for_selector=None):
    """使用 undetected-chromedriver 获取页面"""
    print(f"\n🔍 请求: {url}")
    
    options = uc.ChromeOptions()
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')
    
    driver = None
    try:
        driver = uc.Chrome(options=options)
        driver.get(url)
        
        # 等待页面加载
        time.sleep(5)
        
        # 检查是否被 Cloudflare 拦截
        title = driver.title
        print(f"页面标题: {title}")
        
        if 'Just a moment' in title or 'cloudflare' in driver.page_source.lower():
            print('⚠️ 检测到 Cloudflare 拦截页面')
            # 等待更长时间看是否能通过
            time.sleep(10)
            title = driver.title
            print(f'等待后标题: {title}')
        
        # 等待指定选择器
        if wait_for_selector:
            try:
                WebDriverWait(driver, 20).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, wait_for_selector))
                )
                print(f"✅ 等待选择器成功: {wait_for_selector}")
            except Exception as e:
                print(f"⚠️ 选择器 {wait_for_selector} 未出现: {e}")
        
        # 获取页面源码
        html = driver.page_source
        print(f"✅ 内容长度: {len(html)}")
        
        # 截图
        driver.save_screenshot('/d/codes/cycling_new/debug-pcs-undetected.png')
        print("📸 截图已保存")
        
        return html
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        return None
    finally:
        if driver:
            driver.quit()

def main():
    print('🚴 开始测试 undetected-chromedriver 爬取 PCS 数据')
    print('=' * 60)
    
    # 测试赛段列表
    url = f"{BASE_URL}/race/giro-ditalia-2026"
    html = fetch_page(url, wait_for_selector='.results')
    
    if html:
        if 'Just a moment' not in html and 'cloudflare' not in html.lower():
            print('✅ 成功获取页面内容！')
            print(f"预览: {html[:500]}")
        else:
            print('❌ 仍然被 Cloudflare 拦截')
    
    print('\n' + '=' * 60)

if __name__ == '__main__':
    main()
