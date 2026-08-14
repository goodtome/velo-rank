# 数据录入规范文档

**版本**: v1.0  
**生效日期**: 2026-05-19  
**适用范围**: 领骑小程序 - 数据录入与导入

---

## 📋 核心原则

**所有中文数据必须使用 UTF-8 编码！**

---

## 1️⃣ 管理后台手动录入

### ✅ 正确方法

**方法A：直接使用管理后台表单**
1. 打开管理后台：`http://localhost:3390/admin`
2. 在表单中**直接输入中文**（推荐）
3. 点击"保存"

**原理**：浏览器表单提交默认使用 UTF-8 编码，无需额外设置。

---

**方法B：复制粘贴时注意**
- ✅ 从 UTF-8 编码的网页/文档复制
- ❌ 避免从 Word、WPS 直接复制（可能带隐藏格式）
- ✅ 推荐来源：
  - 浏览器网页（UTF-8）
  - Notepad++（UTF-8 without BOM）
  - VS Code（UTF-8）
  - 微信/钉钉聊天窗口

---

### ❌ 常见错误

| 错误操作 | 后果 | 正确方法 |
|---------|------|----------|
| 从 Excel 直接复制粘贴 | 可能乱码 | 先另存为 UTF-8 CSV |
| 从 Word 复制粘贴 | 带隐藏格式 | 粘贴到记事本中转一次 |
| 数据库直接执行 SQL | 编码不匹配 | 使用管理后台表单 |

---

## 2️⃣ Excel/CSV 文件导入

### ✅ 标准流程（必须遵循）

#### 步骤1：准备 Excel 文件
1. 打开 Excel，录入数据
2. **不要直接另存为 CSV**（Excel 默认用 ANSI 编码，会乱码！）

#### 步骤2：另存为 UTF-8 CSV
**Excel 2016+ 版本**：
1. 点击 **文件 → 另存为**
2. 文件类型选择 **"CSV UTF-8（逗号分隔）(*.csv)"**
3. **注意**：不是 "CSV（逗号分隔）(*.csv)"（这个不是UTF-8）
4. 保存

**Excel 旧版本/WPS**：
1. 点击 **文件 → 另存为**
2. 文件类型选择 **"CSV（逗号分隔）(*.csv)"**
3. 保存
4. 用 **Notepad++** 打开 CSV 文件
5. 菜单 **编码 → 转为 UTF-8 编码**
6. 保存

#### 步骤3：验证编码
用记事本打开 CSV 文件，输入中文，保存时选择 **"编码：UTF-8"**。

或者用命令行验证：
```bash
# Windows (Git Bash)
file your_file.csv
# 输出应包含 "UTF-8" 或 "Unicode text"

# 或者用 hexdump 检查 BOM
hexdump -n 3 -C your_file.csv
# UTF-8 with BOM: ef bb bf
# UTF-8 without BOM: 直接显示文本
```

#### 步骤4：导入数据
1. 打开管理后台
2. 找到对应页面的"导入"功能
3. 上传 CSV 文件
4. 预览数据，确认中文显示正常
5. 点击"确认导入"

---

### 🔍 导入前检查清单

- [ ] CSV 文件编码为 UTF-8（用记事本/Notepad++ 确认）
- [ ] 第一行是列名（如：rider_name_zh, team_name_zh）
- [ ] 中文内容显示正常（用 Excel 或记事本打开确认）
- [ ] 文件扩展名是 `.csv`
- [ ] 分隔符是逗号 `,`（不是分号 `;`）

---

## 3️⃣ 数据库直接操作

### ⚠️ 警告
**不推荐**直接操作数据库！如果必须操作，遵循以下规范：

#### 方法A：使用管理后台的 SQL 执行功能
1. 打开管理后台
2. 使用"数据查询"功能
3. 执行 SQL（会自动处理编码）

#### 方法B：MySQL 命令行
```sql
-- 连接时指定编码
mysql -u root -p --default-character-set=utf8mb4

-- 执行 SQL 文件时指定编码
mysql -u root -p --default-character-set=utf8mb4 database_name < your_file.sql
```

#### 方法C：编写 Node.js 脚本
```javascript
// ✅ 正确：使用参数化查询（自动处理编码）
const db = require('./config/db-pool');
await db.query(
  'UPDATE races SET race_name_zh = ? WHERE id = ?',
  ['2025环法自行车赛', '1d4e1353-...']
);

// ❌ 错误：字符串拼接（可能乱码）
await db.query(`UPDATE races SET race_name_zh = '${name}' WHERE id = '${id}'`);
```

---

## 4️⃣ 编码问题排查

### 症状：数据库中中文显示乱码

**可能原因1：CSV 文件编码不对**
- 解决：用 Notepad++ 转为 UTF-8 编码

**可能原因2：数据库连接未指定编码**
- 检查 `server/config/database.js`，确认有 `charset: 'utf8mb4'`

**可能原因3：浏览器提交时编码不对**
- 检查管理后台 HTML 是否有 `<meta charset="UTF-8">`

---

### 症状：API 返回数据显示乱码

**排查步骤**：
```bash
# 1. 检查 API 响应头
curl -I http://localhost:3390/api/v1/races | grep charset
# 应该显示：Content-Type: application/json; charset=utf-8

# 2. 检查数据库中的数据
cd D:/codes/velo-rank/server
node -e "
const db = require('./config/db-pool');
db.query('SELECT race_name_zh FROM races WHERE id = ?', ['your-id'])
  .then(([rows]) => {
    console.log('数据库数据:', rows[0]);
    process.exit(0);
  });
"

# 3. 如果数据库数据正常，但 API 返回乱码
# 检查服务器响应时是否正确处理了编码
```

---

## 5️⃣ 自动化检查工具

### 工具1：CSV 编码检查脚本
```bash
# 保存为 check_csv_encoding.sh
#!/bin/bash
file="$1"

if [ ! -f "$file" ]; then
  echo "❌ 文件不存在: $file"
  exit 1
fi

# 检查 BOM
bom=$(hexdump -n 3 -e '"%_p"' "$file" 2>/dev/null)
if [[ "$bom" == "ï»¿" ]]; then
  echo "⚠️  文件有 BOM（UTF-8 with BOM）"
  echo "   建议：用 Notepad++ 转为 UTF-8 without BOM"
else
  echo "✅ 无 BOM"
fi

# 检查是否为 UTF-8
if file "$file" | grep -q "UTF-8"; then
  echo "✅ 文件编码为 UTF-8"
else
  echo "❌ 文件编码不是 UTF-8！"
  echo "   当前编码: $(file "$file")"
  echo "   解决：用记事本另存为 UTF-8，或用 Notepad++ 转换"
  exit 1
fi

# 检查是否能正常显示中文
if grep -qP '[\x{4e00}-\x{9fa5}]' "$file" 2>/dev/null; then
  echo "✅ 文件包含中文字符"
else
  echo "ℹ️  文件不包含中文字符（可能不需要 UTF-8）"
fi

echo ""
echo "文件预览（前5行）："
head -5 "$file"
```

**使用方法**：
```bash
chmod +x check_csv_encoding.sh
./check_csv_encoding.sh your_file.csv
```

---

### 工具2：数据库乱码检测 SQL
```sql
-- 检测 races 表的乱码
SELECT id, race_name_zh 
FROM races 
WHERE race_name_zh REGEXP '[^ -~\\u4e00-\\u9fa5]' 
   OR race_name_zh LIKE '%�%';

-- 检测 riders 表的乱码
SELECT id, rider_name_zh 
FROM riders 
WHERE rider_name_zh REGEXP '[^ -~\\u4e00-\\u9fa5]' 
   OR rider_name_zh LIKE '%�%';

-- 检测 teams 表的乱码
SELECT id, team_name_zh 
FROM teams 
WHERE team_name_zh REGEXP '[^ -~\\u4e00-\\u9fa5]' 
   OR team_name_zh LIKE '%�%';
```

---

## 6️⃣ 管理后台优化建议

### 建议1：添加编码检测
在文件上传时，自动检测编码并提示用户：

```javascript
// 前端：使用 FileReader 检测编码
function checkFileEncoding(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    // 简单检测：如果包含乱码字符，提示用户
    if (/�/.test(text)) {
      alert('⚠️ 文件编码可能不是 UTF-8，请另存为 UTF-8 格式后重新上传');
    }
  };
  reader.readAsText(file, 'UTF-8');
}
```

### 建议2：添加数据预览
在导入前，先显示前5行数据，让用户确认中文显示正常。

### 建议3：添加编码转换功能
允许用户上传非 UTF-8 文件，服务器端自动转换为 UTF-8。

---

## 📝 附录：常用工具编码设置

| 工具 | 正确编码设置 |
|-----|-------------|
| **Excel 2016+** | 另存为 → "CSV UTF-8（逗号分隔）" |
| **WPS** | 另存为 → 编码选择 "UTF-8" |
| **Notepad++** | 编码 → "转为 UTF-8 编码"（不要用 UTF-8 with BOM） |
| **VS Code** | 右下角 → "UTF-8" → "通过编码保存" → "UTF-8" |
| **记事本** | 另存为 → 编码选择 "UTF-8" |
| **Sublime Text** | File → Save with Encoding → UTF-8 |

---

## ✅ 快速检查表

导入数据前，问自己3个问题：
1. ✅ CSV 文件是 UTF-8 编码吗？
2. ✅ 用记事本打开，中文显示正常吗？
3. ✅ 导入预览时，中文显示正常吗？

**如果全部是 ✅，才可以导入！**

---

**文档维护**：发现新的编码问题，及时更新此文档。
