#!/usr/bin/env python3
"""
正确解析 Antwerp Port Epic 2026 成绩表格
手动解析 HTML，避免列索引混淆
"""
import json, re
from bs4 import BeautifulSoup

HTML_FILE = 'pcs_antwerp_2026.html'

def clean(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def parse_rider_name(td):
    """正确解析车手名：只提取 <a> 标签内的文本，不包括后面的车队名。"""
    a_tag = td.find('a', href=lambda x: x and 'rider/' in x)
    if not a_tag:
        return clean(td.get_text())
    
    # 提取 <a> 标签内的文本（不包括后面的 div）
    # 方法：获取 <a> 标签的文本内容
    a_text = a_tag.get_text(strip=True)
    
    # 如果有 <span class="uppercase">，则分离姓氏和名字
    span_upper = a_tag.find('span', class_='uppercase')
    if span_upper:
        surname = span_upper.get_text(strip=True)  # "Hagenes"
        firstname = a_text.replace(surname, '').strip()  # "Per Strand"
        return f"{firstname} {surname}"  # "Per Strand Hagenes"
    else:
        return a_text

def parse_team_name(td):
    """正确解析车队名：从 <a> 标签中提取。"""
    a_tag = td.find('a', href=lambda x: x and 'team/' in x)
    if a_tag:
        return a_tag.get_text(strip=True)
    return clean(td.get_text())

def parse_time(td):
    """解析时间：处理 <font> 标签。"""
    font = td.find('font')
    if font:
        time_text = font.get_text(strip=True)
        if time_text and time_text != ',,':
            return time_text
    text = td.get_text(strip=True)
    if ',,' in text:
        return "s.t."
    return text

def main():
    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    soup = BeautifulSoup(html_content, 'html.parser')
    tables = soup.find_all('table')
    
    if not tables:
        print("No tables found!")
        return
    
    table = tables[0]
    rows = table.find_all('tr')
    
    results = []
    for row in rows:
        tds = row.find_all(['td', 'th'])
        if len(tds) < 10:
            continue
        
        rank = clean(tds[0].get_text())
        if not rank or not rank.isdigit():
            continue
        
        # 使用正确的列索引
        rider_name = parse_rider_name(tds[5])
        team = parse_team_name(tds[6])
        gc_rank = clean(tds[1].get_text())
        timelag = clean(tds[2].get_text())
        bib = clean(tds[4].get_text())
        specialty = clean(tds[3].get_text())
        uci_points = clean(tds[7].get_text())
        pnt_points = clean(tds[8].get_text())
        stage_time = parse_time(tds[9])
        
        if rider_name:
            results.append({
                'rank': rank,
                'rider_name': rider_name,
                'team': team,
                'gc_rank': gc_rank,
                'timelag': timelag,
                'bib': bib,
                'specialty': specialty,
                'uci_points': uci_points,
                'pnt_points': pnt_points,
                'stage_time': stage_time,
            })
    
    # 保存为 JSON
    data = {'results': results}
    output_file = 'stage_data.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"成功解析 {len(results)} 条成绩数据，已保存到 {output_file}")
    print(f"前3名：")
    for r in results[:3]:
        print(f"  {r['rank']}. {r['rider_name']} ({r['team']}) - {r['stage_time']}")

if __name__ == '__main__':
    main()
