#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
上传文档到飞书
"""

import json
import urllib.request
import urllib.error
import sys
import os

FEISHU_API_BASE = "https://open.feishu.cn/open-apis"

# 需要用户提供的信息
# 1. 应用凭证（自建应用）
APP_ID = ""  # 请填写您的飞书应用 App ID
APP_SECRET = ""  # 请填写您的飞书应用 App Secret

# 或者 2. 用户访问令牌
USER_ACCESS_TOKEN = ""  # 请填写您的 user_access_token

def get_tenant_access_token(app_id, app_secret):
    """获取 tenant_access_token"""
    url = f"{FEISHU_API_BASE}/auth/v3/tenant_access_token/internal"
    headers = {
        "Content-Type": "application/json"
    }
    data = json.dumps({
        "app_id": app_id,
        "app_secret": app_secret
    }).encode('utf-8')

    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            if result.get('code') == 0:
                return result['tenant_access_token']
            else:
                print(f"获取 token 失败: {result}")
                return None
    except Exception as e:
        print(f"请求失败: {e}")
        return None

def create_document(token, title, content, folder_token=None):
    """创建飞书文档"""
    url = f"{FEISHU_API_BASE}/docx/v1/documents"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }

    data = {
        "title": title
    }
    if folder_token:
        data["folder_token"] = folder_token

    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers=headers,
        method='POST'
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            if result.get('code') == 0:
                return result['data']['document']['document_id']
            else:
                print(f"创建文档失败: {result}")
                return None
    except Exception as e:
        print(f"请求失败: {e}")
        return None

def add_document_blocks(token, document_id, blocks):
    """向文档添加内容块"""
    url = f"{FEISHU_API_BASE}/docx/v1/documents/{document_id}/blocks/{document_id}/children"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }

    data = {
        "children": blocks
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers=headers,
        method='POST'
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            if result.get('code') == 0:
                return True
            else:
                print(f"添加内容失败: {result}")
                return False
    except Exception as e:
        print(f"请求失败: {e}")
        return False

def parse_markdown_to_blocks(markdown_content):
    """将 Markdown 内容解析为飞书文档块"""
    blocks = []
    lines = markdown_content.split('\n')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # 标题
        if line.startswith('# '):
            blocks.append({
                "block_type": 1,  # heading1
                "heading1": {
                    "elements": [{"text_run": {"content": line[2:]}}]
                }
            })
        elif line.startswith('## '):
            blocks.append({
                "block_type": 2,  # heading2
                "heading2": {
                    "elements": [{"text_run": {"content": line[3:]}}]
                }
            })
        elif line.startswith('### '):
            blocks.append({
                "block_type": 3,  # heading3
                "heading3": {
                    "elements": [{"text_run": {"content": line[4:]}}]
                }
            })
        elif line.startswith('- ') or line.startswith('* '):
            blocks.append({
                "block_type": 12,  # bullet
                "bullet": {
                    "elements": [{"text_run": {"content": line[2:]}}]
                }
            })
        elif line.startswith('|') and line.endswith('|'):
            # 表格行，跳过表头分隔行
            if not line.replace('|', '').replace('-', '').replace(':', '').strip():
                continue
            # 简化处理：将表格行作为文本
            blocks.append({
                "block_type": 4,  # text
                "text": {
                    "elements": [{"text_run": {"content": line}}]
                }
            })
        else:
            blocks.append({
                "block_type": 4,  # text
                "text": {
                    "elements": [{"text_run": {"content": line}}]
                }
            })

    return blocks

def main():
    # 检查是否有凭证
    if not APP_ID and not APP_SECRET and not USER_ACCESS_TOKEN:
        print("错误: 请提供飞书应用凭证或用户访问令牌")
        print("请编辑此脚本，填写 APP_ID 和 APP_SECRET 或 USER_ACCESS_TOKEN")
        sys.exit(1)

    # 获取 token
    if USER_ACCESS_TOKEN:
        token = USER_ACCESS_TOKEN
    else:
        token = get_tenant_access_token(APP_ID, APP_SECRET)
        if not token:
            sys.exit(1)

    # 读取文档内容
    doc_path = 'D:\\codes\\velo-rank\\docs\\小程序功能点与BUG记录.md'
    with open(doc_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 创建文档
    title = "「领骑/Jersey」小程序开发功能点与BUG记录"
    document_id = create_document(token, title)
    if not document_id:
        sys.exit(1)

    print(f"文档创建成功: {document_id}")
    print(f"文档链接: https://www.feishu.cn/docx/{document_id}")

    # 解析并添加内容
    blocks = parse_markdown_to_blocks(content)

    # 分批添加（每批最多 50 个块）
    batch_size = 50
    for i in range(0, len(blocks), batch_size):
        batch = blocks[i:i+batch_size]
        if add_document_blocks(token, document_id, batch):
            print(f"已添加 {i+1} 到 {min(i+batch_size, len(blocks))} 个块")
        else:
            print(f"添加块失败: {i+1} 到 {min(i+batch_size, len(blocks))}")

    print("\n文档上传完成！")
    print(f"文档链接: https://www.feishu.cn/docx/{document_id}")

if __name__ == '__main__':
    main()
