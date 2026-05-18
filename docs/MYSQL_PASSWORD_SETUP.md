# MySQL 密码配置指南

## 当前状态

MySQL 服务正在运行（端口 13306），但 root 用户需要密码才能连接。

## 查找 MySQL 密码

### 方法1：使用 MySQL Installer 查看
1. 打开 "MySQL Installer"（在开始菜单搜索）
2. 找到已安装的 MySQL Server 8.0
3. 点击 "Reconfigure" → 在 "Authentication Method" 页面查看密码

### 方法2：重置 root 密码（需要管理员权限）

以管理员身份打开命令提示符：

```cmd
net stop MySQL80
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --skip-grant-tables --shared-memory
```

然后打开新的命令提示符窗口：

```cmd
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root
```

在 MySQL 中执行：

```sql
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED BY 'your_password';
FLUSH PRIVILEGES;
EXIT;
```

停止跳过权限表的 MySQL 进程，然后正常启动：

```cmd
net start MySQL80
```

### 方法3：使用 MySQL Workbench 重置密码

如果安装了 MySQL Workbench：
1. 打开 MySQL Workbench
2. 连接到本地 MySQL（使用记住的密码或尝试空密码）
3. 进入 Users and Privileges → 选择 root 用户
4. 设置新密码

## 配置项目

找到密码后，更新 `server/config/.env` 文件：

```env
DB_PASSWORD=你的密码
```

然后运行测试：

```bash
node server/scripts/test-connection.js
```

## 快速设置空密码（仅限开发环境）

如果你确定要在本地开发环境使用空密码：

```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';
FLUSH PRIVILEGES;
```
