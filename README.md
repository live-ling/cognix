# Cognix — 智能题库练习平台

Cognix 是一个支持多用户的智能题库练习平台，提供多种题型练习、AI 智能题目导入、学习数据追踪和错题管理。

> 🚀 在线演示：[https://cognix.liveling.top](https://cognix.liveling.top)

## 功能特性

### 题库与题目

- 📚 **题库管理** — 创建、编辑、删除题库，支持搜索、筛选（题型/难度）
- 📝 **三种题型** — 单选题、多选题、判断题，支持手动创建和编辑
- 🏷️ **标签与难度** — 每道题目支持标签分类和 easy/medium/hard 难度标记

### AI 智能导入

- 🤖 **粘贴文本导入** — 直接粘贴包含题目和答案的文本，AI 自动识别并转换为标准格式
- 📄 **文件上传导入** — 支持 .txt / .docx 文件，AI 从学习材料生成或从已有题目转换
- ✅ **检查确认** — AI 生成后可逐题编辑、删除，确认无误后一键保存到题库
- 🔌 **多服务商支持** — 内置 OpenAI、DeepSeek、智谱 GLM、Moonshot 预设，支持自定义 API

### 练习模式

- 🎯 **顺序练习** — 按题库顺序依次答题
- 🎲 **随机练习** — 随机抽取题目
- ❌ **错题复习** — 针对错题强化训练，连续答对 3 次自动标记为已掌握

### 学习追踪

- 📊 **统计面板** — 今日答题数、正确率、连续学习天数、题库总数
- 🔥 **学习热力图** — GitHub 风格热力图，直观展示 6 个月学习记录
- 📋 **练习记录** — 最近练习日期、模式、正确率、用时
- 🏆 **等级系统** — 初学者 → 勤奋学员 → 进阶学者 → 刷题大师

### 用户系统

- 👤 **注册/登录** — 邮箱注册，支持记住我、记住密码
- 🔑 **修改密码** — Profile 页内模态框修改，无需跳转
- 🤖 **独立 AI 配置** — 每用户独立的 API Key + 模型配置，测试连接通过后方可保存

### 界面

- 🌙 **暗色模式** — 亮色/暗色主题一键切换
- 📱 **响应式布局** — 桌面端 + 移动端适配

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite (Rolldown) |
| 样式 | Tailwind CSS + 自定义组件 |
| 路由 | React Router v7 |
| 图标 | Lucide React + Font Awesome |
| 后端框架 | FastAPI (Python 3.11+) |
| ORM | SQLAlchemy 2.0 (async) |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis 7 |
| 认证 | JWT (python-jose + passlib bcrypt) |
| AI 协议 | OpenAI-compatible chat/completions API |

## 快速开始

### 环境要求

- Node.js 20+
- Python 3.11+
- MySQL 8.0
- Redis 7

### 1. 后端

```bash
cd "Cognix backend"

# 安装依赖
pip install -r requirements.txt

# 配置环境变量（复制并修改 .env.example 或直接创建 .env）
cat > .env << EOF
DATABASE_URL=mysql+aiomysql://root:password@localhost:3306/cognix
REDIS_HOST=localhost
REDIS_PORT=6379
SECRET_KEY=your-secret-key-change-me
DEBUG=true
EOF

# 初始化数据库（创建表 + 种子数据）
python -m seed.seed_data

# 启动后端
python app.py
```

后端运行在 http://localhost:8000，API 文档在 http://localhost:8000/docs

### 2. 前端

```bash
# 在项目根目录
npm install
npm run dev
```

前端运行在 http://localhost:5173

### 环境变量

**后端** (`Cognix backend/.env`)：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | MySQL 连接字符串 | 必填 |
| `REDIS_HOST` | Redis 主机 | `localhost` |
| `REDIS_PORT` | Redis 端口 | `6379` |
| `SECRET_KEY` | JWT 签名密钥 | 必填 |
| `DEBUG` | SQL 日志输出 | `false` |
| `OPENAI_API_KEY` | 全局 AI Key（可选，用户可自行配置） | — |
| `OPENAI_BASE_URL` | 全局 AI 地址 | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 全局 AI 模型 | `gpt-4o-mini` |
| `MAX_UPLOAD_SIZE_MB` | 上传文件大小限制 | `10` |

**前端** (`.env`)：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_BASE_URL` | 后端 API 地址 | `/api` |

### 默认账号

| 字段 | 值 |
|------|-----|
| 邮箱 | `admin@example.com` |
| 密码 | `admin123` |

## 项目结构

```
Cognix WebUI/
├── src/                          # 前端源码
│   ├── components/
│   │   ├── layout/               # 布局组件（Header, Footer, Layout）
│   │   ├── ui/                   # UI 基础组件（Card, Button, Badge, Input 等）
│   │   ├── protected-route.tsx   # 登录保护路由
│   │   └── user-avatar.tsx       # 用户头像组件
│   ├── contexts/                 # React Context
│   │   ├── AuthContext.tsx        # 认证状态
│   │   └── ThemeContext.tsx       # 主题状态
│   ├── lib/                      # 工具函数
│   │   ├── api.ts                # API 请求封装（JWT 自动注入）
│   │   ├── cache.ts              # 前端缓存管理
│   │   ├── cookies.ts            # Cookie 工具
│   │   ├── types.ts              # TypeScript 类型定义
│   │   └── utils.ts              # 通用工具
│   ├── pages/                    # 页面组件
│   │   ├── home.tsx              # 首页
│   │   ├── login.tsx             # 登录/注册
│   │   ├── profile.tsx           # 个人主页（仪表盘 + 密码修改 + AI 配置）
│   │   ├── bank-list.tsx         # 题库列表
│   │   ├── bank-detail.tsx       # 题库详情（含 AI 导入）
│   │   ├── question-form.tsx     # 题目创建/编辑
│   │   ├── practice-setup.tsx    # 练习设置
│   │   ├── practice-session.tsx  # 练习答题
│   │   └── mistakes.tsx          # 错题本
│   ├── styles/
│   │   └── animations.css        # 动画样式
│   ├── index.css                 # 全局样式 + Tailwind
│   └── App.tsx                   # 路由配置
│
├── Cognix backend/               # 后端源码
│   ├── app/
│   │   ├── api/                  # API 路由
│   │   │   ├── auth.py           # 注册/登录/AI 配置/修改密码
│   │   │   ├── banks.py           # 题库 CRUD
│   │   │   ├── questions.py       # 题目 CRUD
│   │   │   ├── practice.py        # 练习（开始/提交/完成）
│   │   │   ├── import_router.py   # AI 导入（上传/生成/保存）
│   │   │   ├── stats.py           # 学习统计
│   │   │   └── mistakes.py        # 错题管理
│   │   ├── models/               # SQLAlchemy 模型
│   │   ├── schemas/              # Pydantic Schema
│   │   ├── services/             # 业务逻辑层
│   │   │   ├── ai_service.py     # AI 题目生成
│   │   │   └── practice_service.py
│   │   ├── utils/                # 工具模块
│   │   │   ├── auth.py           # JWT + 密码哈希
│   │   │   └── file_parser.py    # 文件解析（txt/docx）
│   │   ├── config.py             # 应用配置
│   │   └── database.py           # 数据库连接
│   ├── seed/
│   │   └── seed_data.py          # 数据库初始化 + 种子数据
│   ├── tests/                    # 测试用例
│   └── requirements.txt
│
└── README.md
```

## API 概览

所有 API 以 `/api` 为前缀，需要认证的在 Header 中携带 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/register` | 注册 | — |
| POST | `/auth/login` | 登录 | — |
| GET | `/auth/me` | 当前用户信息 | ✓ |
| PUT | `/auth/me` | 更新个人资料 | ✓ |
| PUT | `/auth/ai-settings` | 保存 AI 配置 | ✓ |
| POST | `/auth/ai-test-credentials` | 测试 AI 连接 | ✓ |
| POST | `/auth/change-password` | 修改密码 | ✓ |
| GET | `/banks` | 题库列表 | ✓ |
| POST | `/banks` | 创建题库 | ✓ |
| GET | `/banks/:id` | 题库详情 | ✓ |
| GET | `/banks/:id/questions` | 题目列表 | ✓ |
| POST | `/banks/:id/questions` | 创建题目 | ✓ |
| PUT | `/banks/:id/questions/:qid` | 编辑题目 | ✓ |
| DELETE | `/banks/:id/questions/:qid` | 删除题目 | ✓ |
| POST | `/import/upload` | 上传文件 | ✓ |
| POST | `/import/generate` | AI 生成题目（不保存） | ✓ |
| POST | `/import/save` | 保存确认后的题目 | ✓ |
| POST | `/practice/start` | 开始练习 | ✓ |
| POST | `/practice/submit` | 提交答案 | ✓ |
| POST | `/practice/finish` | 完成练习 | ✓ |
| GET | `/stats/dashboard` | 仪表盘数据 | ✓ |
| GET | `/mistakes` | 错题列表 | ✓ |

## AI 服务商配置

| 服务商 | API 地址 | 可用模型 |
|--------|----------|----------|
| OpenAI | `https://api.openai.com/v1` | gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, o4-mini |
| DeepSeek | `https://api.deepseek.com` | deepseek-v4-flash, deepseek-v4-pro, deepseek-chat, deepseek-reasoner |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | glm-4-plus, glm-4-flash |
| Moonshot | `https://api.moonshot.cn/v1` | moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k |
| 自定义 | 自行填写 | 自行填写 |

用户在 Profile 页选择服务商 → 填入 API Key → 测试连接 → 通过后保存。

## 部署

### 前端部署（腾讯云 EdgeOne Pages）

本项目前端为纯静态 SPA，托管于腾讯云 EdgeOne Pages。

#### 1. 构建配置

| 配置项 | 值 |
|--------|-----|
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| Node 版本 | 20 |

#### 2. 环境变量

在 EdgeOne 控制台 → 站点 → 环境变量中配置：

| 变量 | 说明 | 示例 |
|------|------|------|
| `VITE_API_BASE_URL` | 后端 API 地址 | `https://api.your-domain.com/api` |

> ⚠️ 环境变量必须以 `VITE_` 为前缀，构建时会被注入到代码中。

#### 3. SPA 路由配置

EdgeOne Pages 需要配置回退规则，使所有路由请求指向 `index.html`：

- 在站点设置中添加**自定义错误页面**或**重写规则**，将 `404` 指向 `/index.html`（状态码 200）

### 后端部署（VPS）

**环境要求：** Python 3.11+ / MySQL 8.0 / Redis 7

#### 1. 克隆代码

```bash
git clone https://gitee.com/whpa24soft/cognix.git
cd cognix/"Cognix backend"
```

#### 2. 安装依赖

```bash
pip install -r requirements.txt
```

#### 3. 配置环境变量

```bash
cp .env.example .env   # 或直接创建 .env
```

编辑 `.env`：

```env
DATABASE_URL=mysql+aiomysql://user:password@localhost:3306/cognix
REDIS_HOST=localhost
REDIS_PORT=6379
SECRET_KEY=生成一个随机字符串
DEBUG=false
```

#### 4. 初始化数据库

```bash
python -m seed.seed_data
```

#### 5. 启动服务

使用 systemd 管理（推荐）：

```ini
# /etc/systemd/system/cognix.service
[Unit]
Description=Cognix API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/cognix/Cognix backend
ExecStart=/usr/bin/python3 app.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cognix
```

或使用 nohup 临时运行：

```bash
nohup python app.py > app.log 2>&1 &
```

后端默认运行在 `http://0.0.0.0:8000`，生产环境建议前置 Nginx 反向代理并配置 HTTPS。

#### 6. Nginx 反向代理（可选）（可选）

```nginx
server {
    listen 443 ssl;
    server_name api.your-domain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 7. 前端 API 地址配置

后端部署完成后，将前端的 `VITE_API_BASE_URL` 设置为后端域名（如 `https://api.your-domain.com/api`），重新构建部署即可。

## License

MIT
