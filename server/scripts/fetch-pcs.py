#!/usr/bin/env python3
"""
下载 PCS 赛段页面 HTML
使用 requests + 浏览器 User-Agent 绕过简单的 Cloudflare 检查
"""

import requests
import sys
import os

def download_pcs_stage(race_code, stage_number, output_file):
    """
    下载 PCS 赛段页面
    :param race_code: 赛事代码，如 'giro-d-italia-2026'
    :param stage_number: 赛段号，如 6
    :param output_file: 输出 HTML 文件路径
    """
    # PCS URL 格式：/race/{race_code}/stage-{stage_number}
    url = f"https://www.procyclingstats.com/race/{race_code}/stage-{stage_number}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
    
    print(f"正在下载: {url}")
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # 检查是否被 Cloudflare 拦截
        if 'Just a moment.' in response.text or 'cf-challenge' in response.text:
            print("❌ 被 Cloudflare 拦截，请使用 browser 工具或手动下载")
            return False
        
        # 保存 HTML
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(response.text)
        
        print(f"✅ 下载完成: {output_file}")
        print(f"   文件大小: {os.path.getsize(output_file)} 字节")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ 下载失败: {e}")
        return False

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("使用方式: python fetch_pcs.py <race_code> <stage_number> <output_file>")
        print("示例: python fetch_pcs.py giro-d-italia-2026 6 stage-6.html")
        sys.exit(1)
    
    race_code = sys.argv[1]
    stage_number = sys.argv[2]
    output_file = sys.argv[3]
    
    success = download_pcs_stage(race_code, stage_number, output_file)
    sys.exit(0 if success else 1)
