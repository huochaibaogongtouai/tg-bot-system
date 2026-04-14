# 🤖 TG 多机器人转发系统

> 基于 Cloudflare Workers + D1 SQLite 的 Telegram 多机器人集群管理平台

## 系统概述

全域私有化部署的 Telegram 多机器人管理系统，依托 Cloudflare Workers 无服务器架构和 D1 轻量化 SQLite 数据库，实现全程零本地部署、零服务器依赖。

### 核心特性

- **多机器人集群管理**：支持无限新增、解绑、下架 TG 机器人，各机器人数据完全隔离
- **频道延时转发**：多源频道到多目标群的内容转发，支持自定义延时和关键词过滤
- **智能自动回复**：精确匹配 / 模糊匹配双模式，独立绑定单机器人
- **群管控系统**：入群欢迎、违禁词拦截、成员变动记录
- **私聊客服回复**：管理员直接回复转发消息即可回复用户，无需命令
- **定时任务**：个人提醒、循环群发、一次性任务
- **数据采集与导出**：全量消息日志、成员变动日志、CSV 一键导出
- **可视化后台**：现代化 Web 管理面板，全中文界面

---

## 部署指南

### 前置要求

1. [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费版即可）
2. [Node.js](https://nodejs.org/) >= 18
3. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### 第一步：安装依赖

```bash
cd tg-bot-system
npm install
```

### 第二步：登录 Cloudflare

```bash
npx wrangler login
```

### 第三步：创建 D1 数据库

```bash
npx wrangler d1 create tg-bot-db
```

执行后会输出类似以下内容：

```
✅ Successfully created DB 'tg-bot-db'
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**将 `database_id` 填入 `wrangler.toml`：**

```toml
[[d1_databases]]
binding = "DB"
database_name = "tg-bot-db"
database_id = "你的数据库ID"
```

### 第四步：初始化数据库

```bash
npx wrangler d1 execute tg-bot-db --file=./schema.sql
```

### 第五步：部署到 Cloudflare Workers

```bash
npx wrangler deploy
```

部署成功后会输出 Worker URL，例如：`https://tg-bot-system.your-subdomain.workers.dev`

### 第六步：首次登录

1. 访问 Worker URL，系统自动跳转登录页
2. 首次部署会自动生成随机默认密码
3. 查看默认密码：
   ```bash
   npx wrangler d1 execute tg-bot-db --command="SELECT value FROM system_config WHERE key='admin_password'"
   ```
4. 使用默认密码登录后，立即在「系统设置」中修改密码

---

## 使用说明

### 添加机器人

1. 在 Telegram 中找到 [@BotFather](https://t.me/BotFather)，创建新机器人获取 Token
2. 登录后台 → 点击「新增机器人」
3. 填写机器人名称、Token，可选填管理员 Chat ID
4. 系统自动验证 Token 有效性并设置 Webhook

### 配置频道转发

1. 进入机器人配置页 → 「转发规则」标签
2. 填写源频道 ID、目标群 ID（多个用逗号分隔）
3. 设置转发延时（1-60秒）和过滤关键词
4. **注意**：需要将机器人添加为源频道和目标群的管理员

### 配置自动回复

1. 进入机器人配置页 → 「自动回复」标签
2. 添加关键词和回复内容
3. 选择匹配模式：精确匹配（完全一致）或模糊匹配（包含即触发）

### 配置群管控

1. 进入机器人配置页 → 「群管控」标签
2. 填写群 ID，设置欢迎语和违禁词
3. 欢迎语支持变量：`{name}` 姓名、`{username}` 用户名、`{group}` 群名

### 私聊客服功能

1. 在机器人基本配置中填写管理员 Chat ID
2. 用户私聊机器人的消息会自动转发给管理员
3. 管理员直接回复转发的消息，系统自动发送给原用户

### 定时任务

1. 进入机器人配置页 → 「定时任务」标签
2. 支持一次性、每小时、每天三种循环模式
3. 用户也可在聊天中使用 `/remind [分钟] [内容]` 设置提醒

### 数据导出

1. 进入机器人配置页 → 「消息日志」或「成员变动」标签
2. 点击「导出CSV」按钮下载数据文件

---

## 机器人指令

| 指令 | 说明 |
|------|------|
| `/start` | 开始使用机器人 |
| `/help` | 查看帮助信息 |
| `/id` | 获取当前会话 ID 和用户 ID |
| `/remind [分钟] [内容]` | 设置定时提醒 |

---

## 项目结构

```
tg-bot-system/
├── wrangler.toml          # Cloudflare Workers 配置
├── schema.sql             # D1 数据库建表语句
├── package.json           # 项目依赖
├── README.md              # 部署说明文档
└── src/
    ├── index.js           # 主入口（路由分发）
    ├── auth.js            # 认证/会话管理
    ├── db.js              # 数据库初始化与工具函数
    ├── telegram.js        # Telegram Bot API 封装
    ├── webhook.js         # Webhook 消息处理
    ├── api.js             # 后台管理 API
    ├── cron.js            # 定时任务处理
    └── pages/
        ├── login.js       # 登录页面
        └── dashboard.js   # 管理面板（SPA）
```

---

## 数据库表结构

| 表名 | 说明 |
|------|------|
| `system_config` | 系统配置（管理员密码等） |
| `sessions` | 登录会话 |
| `bots` | 机器人主表 |
| `forward_rules` | 转发规则 |
| `auto_replies` | 自动回复规则 |
| `group_configs` | 群配置（欢迎语、违禁词） |
| `message_logs` | 消息日志 |
| `member_events` | 成员变动记录 |
| `scheduled_tasks` | 定时任务 |
| `customer_messages` | 客服消息映射 |
| `forward_queue` | 转发队列 |

---

## API 接口一览

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| PUT | `/api/config/password` | 修改管理员密码 |
| GET | `/api/stats` | 全局统计数据 |

### 机器人管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/bots` | 获取机器人列表 |
| POST | `/api/bots` | 新增机器人 |
| GET | `/api/bots/:id` | 获取单个机器人 |
| PUT | `/api/bots/:id` | 更新机器人配置 |
| DELETE | `/api/bots/:id` | 删除机器人 |

### 转发规则

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/bots/:id/forward-rules` | 获取转发规则 |
| POST | `/api/bots/:id/forward-rules` | 新增转发规则 |
| PUT | `/api/forward-rules/:id` | 更新转发规则 |
| DELETE | `/api/forward-rules/:id` | 删除转发规则 |

### 自动回复

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/bots/:id/auto-replies` | 获取自动回复规则 |
| POST | `/api/bots/:id/auto-replies` | 新增自动回复规则 |
| PUT | `/api/auto-replies/:id` | 更新规则 |
| DELETE | `/api/auto-replies/:id` | 删除规则 |

### 群配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/bots/:id/group-configs` | 获取群配置 |
| POST | `/api/bots/:id/group-configs` | 新增/更新群配置 |
| PUT | `/api/group-configs/:id` | 更新群配置 |
| DELETE | `/api/group-configs/:id` | 删除群配置 |

### 定时任务

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/bots/:id/tasks` | 获取定时任务 |
| POST | `/api/bots/:id/tasks` | 新增定时任务 |
| PUT | `/api/tasks/:id` | 更新任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |

### 日志与导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/bots/:id/logs` | 获取消息日志（分页） |
| GET | `/api/bots/:id/logs/export` | 导出消息日志 CSV |
| DELETE | `/api/bots/:id/logs/clear` | 清空消息日志 |
| GET | `/api/bots/:id/events` | 获取成员变动（分页） |
| GET | `/api/bots/:id/events/export` | 导出成员变动 CSV |
| DELETE | `/api/bots/:id/events/clear` | 清空成员变动 |
| GET | `/api/bots/:id/stats` | 机器人统计数据 |

---

## 本地开发

```bash
# 初始化本地数据库
npx wrangler d1 execute tg-bot-db --local --file=./schema.sql

# 启动本地开发服务器
npx wrangler dev
```

访问 `http://localhost:8787` 即可进入管理面板。

---

## 注意事项

1. **Webhook 地址**：系统会自动为每个机器人设置 Webhook，格式为 `https://your-worker.workers.dev/webhook/{bot_id}`
2. **管理员权限**：机器人需要在源频道和目标群中拥有管理员权限才能正常转发
3. **频率限制**：Telegram API 有频率限制，建议转发延时不低于 3 秒
4. **D1 限制**：Cloudflare D1 免费版有每日读写次数限制，大规模使用请关注用量
5. **安全建议**：首次登录后务必修改默认密码

---

## 后续扩展方向

- 多账号分权管理（子管理员、只读账号）
- 转发高级规则（黑白名单、定时启停）
- 多媒体增强（图片/视频压缩、链接去重）
- 风控升级（频率限制、重复拦截、异常预警）
- 数据统计面板（可视化图表）
- 配置备份还原

---

## License

MIT
