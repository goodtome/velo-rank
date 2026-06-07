#!/usr/bin/env python3
"""
正确解析 Antwerp Port Epic 2026 成绩表格
表格结构（10列）：
  td[0]  = Rank
  td[1]  = GC rank
  td[2]  = Timelag（空）
  td[3]  = Specialty（Classic/Hills/TT）
  td[4]  = BIB number
  td[5]  = Rider name（有 <a> 标签）
  td[6]  = Team（有 <a> 标签）
  td[7]  = UCI points
  td[8]  = Pnt points
  td[9]  = Time
"""
import json
import re
from bs4 import BeautifulSoup

HTML_FILE = 'pcs_antwerp_2026.html'

def clean(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def parse_rider_name(td):
    """
    正确解析车手名：只提取 <a> 标签内的文本，不包括后面的车队名 <div>。
    HTML结构：
    <td class="ridername">
      <div class="cont">
        <a href="rider/xxx"><span class="uppercase">SURNAME</span> Firstname</a>
        <div class="showIfMobile">车队名</div>
      </div>
    </td>
    """
    a_tag = td.find('a', href=lambda x: x and 'rider/' in x)
    if not a_tag:
        return clean(td.get_text())
    
    # 方法：只获取 <a> 标签内的文本，不包含后面的 div
    # 使用 .children 或者 .contents 来分离
    # 简单方法：获取 <a> 的文本内容，然后清理
    a_text = a_tag.get_text(strip=True)
    
    # 如果包含姓氏（uppercase span），则格式化
    span_upper = a_tag.find('span', class_='uppercase')
    if span_upper:
        surname = span_upper.get_text(strip=True)
        # 移除姓氏，剩下的就是名字
        firstname = a_text.replace(surname, '').strip()
        return f"{firstname} {surname}"
    else:
        return a_text

def parse_team_name(td):
    """解析车队名：从 <a> 标签中提取。"""
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

def extract_stage_results(soup):
    """提取赛段成绩。"""
    results = []
    tables = soup.find_all('table')
    if not tables:
        return results
    
    table = tables[0]
    rows = table.find_all('tr')
    
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
    
    return results

def main():
    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 调试：打印前3行的解析结果
    tables = soup.find_all('table')
    if tables:
        table = tables[0]
        rows = table.find_all('tr')
        print("=== 调试：前3行解析结果 ===", file=__import__('sys').stderr)
        for i, row in enumerate(rows[:3]):
            tds = row.find_all(['td', 'th'])
            if len(tds) >= 10:
                rank = tds[0].get_text(strip=True)
                if rank and rank.isdigit():
                    rider_name = parse_rider_name(tds[5])
                    team = parse_team_name(tds[6])
                    stage_time = parse_time(tds[9])
                    print(f"Row {i}: rank={rank}, rider={rider_name}, team={team}, time={stage_time}", file=__import__('sys').stderr)
    
    data = {
        'results': extract_stage_results(soup),
    }
    
    # 保存到 JSON 文件
    output_file = 'stage_data.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"数据已保存到: {output_file}", file=__import__('sys').stderr)
    print(output_file)

if __name__ == '__main__':
    main()
