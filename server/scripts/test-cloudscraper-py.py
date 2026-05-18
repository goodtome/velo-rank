"""
测试 cloudscraper 绕过 Cloudflare 获取 PCS 数据
"""
import cloudscraper
import json
import sys

BASE_URL = 'https://www.procyclingstats.com'

def fetch_page(url):
    """使用 cloudscraper 获取页面"""
    print(f"\n🔍 请求: {url}")
    scraper = cloudscraper.create_scraper(
        browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True}
    )
    try:
        resp = scraper.get(url, timeout=30)
        print(f"✅ 状态码: {resp.status_code}")
        print(f"📄 内容长度: {len(resp.text)}")
        if resp.status_code == 200:
            return resp.text
        else:
            print(f"❌ 响应内容: {resp.text[:500]}")
            return None
    except Exception as e:
        print(f"❌ 请求失败: {e}")
        return None

def scrape_stage_result(race_code, stage_number):
    """爬取单赛段成绩"""
    url = f"{BASE_URL}/race/{race_code}/stage-{stage_number}/result"
    html = fetch_page(url)
    
    if not html:
        return []
    
    # 简单检查是否被 Cloudflare 拦截
    if 'Just a moment' in html or 'cloudflare' in html.lower():
        print('⚠️ 检测到 Cloudflare 拦截页面')
        return []
    
    print(f"✅ 页面获取成功，开始解析...")
    return []  # 简化测试，只检查页面是否能获取

def main():
    race_code = 'giro-ditalia-2026'
    
    print('🚴 开始测试 cloudscraper 爬取 PCS 数据')
    print('=' * 60)
    
    # 测试 1: 赛段列表
    url = f"{BASE_URL}/race/{race_code}"
    html = fetch_page(url)
    
    if html and 'Just a moment' not in html:
        print('✅ 成功获取页面！')
        print(f"预览: {html[:500]}")
    else:
        print('❌ 被 Cloudflare 拦截')
    
    print('\n' + '=' * 60)
    
    # 测试 2: Stage 5
    print('\n📊 测试 Stage 5 成绩:')
    results = scrape_stage_result(race_code, 5)
    
    print('\n' + '=' * 60)
    print('🎉 测试完成！')

if __name__ == '__main__':
    main()
