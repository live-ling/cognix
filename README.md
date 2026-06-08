# Cognix — 智能题库练习平台

Cognix 是一个支持多用户的智能题库练习平台，提供多种题型练习、AI 智能题目导入与生成、学习数据追踪、错题管理和题库广场社区共享。

> 🚀 在线演示：[https://cognix.liveling.top](https://cognix.liveling.top)

## 功能特性

### 题库与题目

- 📚 **题库管理** — 创建、编辑、删除题库，支持搜索、筛选（题型/难度）
- 📝 **三种题型** — 单选题、多选题、判断题，支持手动创建和编辑
- 🏷️ **标签与难度** — 每道题目支持标签分类和 easy/medium/hard 难度标记
- 🌐 **题库广场** — 社区共享题库浏览，一键导入他人分享的题库，支持搜索

### AI 智能导入

- 🤖 **导入题目** — 粘贴或上传已有题目和答案，AI 自动识别并转换为标准格式
- ✨ **生成题目** — 上传学习材料，按单选/多选/判断分别指定数量生成
- ✅ **检查确认** — 生成后可逐题编辑、删除，确认无误后一键保存
- 🔌 **多服务商** — 内置 OpenAI、DeepSeek、智谱 GLM、Moonshot 预设，支持自定义
- 📊 **AI 用量追踪** — 自动记录每次 AI 调用的 Token 消耗，支持统计查看

### 练习模式

- 🎯 **顺序练习** — 按题库顺序依次答题
- 🎲 **随机练习** — 随机抽取题目
- ❌ **错题复习** — 针对错题强化训练，连续答对 3 次自动标记已掌握

### 学习追踪

- 📊 **统计面板** — 今日答题数、正确率、连续学习天数、题库总数
- 🔥 **学习热力图** — GitHub 风格热力图，直观看 6 个月学习记录
- 📋 **练习记录** — 最近练习日期、模式、正确率、用时
- 🏆 **等级系统** — 初学者 → 勤奋学员 → 进阶学者 → 刷题大师
- 🤖 **AI 用量统计** — 独立加载的 AI 调用统计卡片，Token 消耗一目了然

### 用户系统

- 👤 **注册/登录** — 邮箱注册（OTP 验证码），支持记住我、记住密码
- 🔑 **修改密码** — Profile 页模态框修改，无需跳转
- 🔐 **忘记密码** — OTP 验证码重置密码，安全便捷
- 🔗 **第三方登录** — 支持 Gitee OAuth、GitHub OAuth 登录
- 🤖 **独立 AI 配置** — 每用户独立 API Key + 模型，测试通过后保存
- 💰 **DeepSeek 余额** — 配置 DeepSeek API Key 后自动查询并展示余额

### 界面

- 🌙 **暗色模式** — 亮色/暗色主题一键切换
- 📱 **响应式布局** — 桌面端 + 移动端适配
- ✨ **滚动动画** — 滚动驱动的入场动画，提升浏览体验
- 💬 **一言** — 首页 Banner 和登录页左下角展示随机一言

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 19 + TypeScript |
| 编译优化 | React Compiler（Babel 插件） |
| 构建工具 | Vite 8 |
| 样式 | Tailwind CSS 3 |
| 路由 | React Router v7（懒加载） |
| 状态管理 | Zustand 5 |
| 图标 | Lucide React + Font Awesome + React Icons |
| 后端服务 | Supabase |
| 数据库 | PostgreSQL（Supabase 托管） |
| 认证 | Supabase Auth |
| 服务端逻辑 | EdgeOne Pages Functions |
| AI 协议 | OpenAI-compatible chat/completions API |
| 托管 | 腾讯云 EdgeOne Pages |

## 快速开始

```bash
npm install
npm run dev
```

访问 `http://localhost:5173`

### 环境变量

创建 `.env`：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 可选：第三方登录
VITE_GITEE_CLIENT_ID=your-gitee-client-id
VITE_GITEE_CLIENT_SECRET=your-gitee-client-secret
```

### Supabase 初始化

将 `supabase/schema.sql` 在 Supabase SQL Editor 中执行。

### EdgeOne Functions

项目使用 EdgeOne Pages Functions 处理服务端逻辑（如 Gitee OAuth）。部署到 EdgeOne Pages 时自动生效。

## 项目结构

```
├── src/                          # 前端源码
│   ├── components/
│   │   ├── layout/               # 布局组件（Header, Footer, Layout）
│   │   ├── ui/                   # UI 基础组件
│   │   │   ├── button.tsx        # 按钮
│   │   │   ├── badge.tsx         # 标签
│   │   │   ├── card.tsx          # 卡片
│   │   │   ├── input.tsx         # 输入框
│   │   │   ├── skeleton.tsx      # 骨架屏加载
│   │   │   ├── scroll-reveal.tsx # 滚动入场动画
│   │   │   ├── enhanced-button.tsx # 增强按钮
│   │   │   └── question-card.tsx # 题目卡片
│   │   ├── protected-route.tsx   # 登录保护路由
│   │   ├── portal.tsx            # Portal 传送门
│   │   └── user-avatar.tsx       # 用户头像（含裁剪）
│   ├── contexts/                 # React Context
│   │   ├── SupabaseAuthContext.tsx # 认证状态（Supabase Auth）
│   │   └── ThemeContext.tsx       # 主题状态
│   ├── hooks/                    # 自定义 Hooks
│   │   ├── use-saying.ts         # 一言 API Hook
│   │   └── useScrollReveal.ts    # 滚动入场动画 Hook
│   ├── lib/                      # 工具库
│   │   ├── supabase.ts           # Supabase 客户端
│   │   ├── database.types.ts     # 数据库 TypeScript 类型
│   │   ├── question-utils.ts     # 题目格式转换工具
│   │   ├── ai-tracker.ts         # AI 用量追踪
│   │   ├── cache.ts              # 前端缓存管理
│   │   ├── cookies.ts            # Cookie 工具
│   │   ├── types.ts              # 通用类型定义
│   │   └── utils.ts              # 通用工具函数
│   ├── pages/                    # 页面
│   │   ├── home.tsx              # 首页（平台介绍 + 站点统计）
│   │   ├── login.tsx             # 登录/注册/忘记密码（OTP + OAuth）
│   │   ├── profile.tsx           # 个人主页（仪表盘 + 密码 + AI 配置 + 头像裁剪）
│   │   ├── bank-list.tsx         # 题库列表
│   │   ├── bank-detail.tsx       # 题库详情（含 AI 导入）
│   │   ├── question-form.tsx     # 题目创建/编辑
│   │   ├── practice-setup.tsx    # 练习设置
│   │   ├── practice-session.tsx  # 练习答题
│   │   ├── mistakes.tsx          # 错题本
│   │   └── square.tsx            # 题库广场（社区共享）
│   ├── styles/                   # 样式
│   │   ├── animations.css        # 入场动画
│   │   └── index.css             # 全局样式
│   └── App.tsx                   # 路由配置（懒加载）
│
├── edge-functions/               # EdgeOne Pages Functions
│   └── api/
│       └── auth-gitee.js         # Gitee OAuth 登录
│
├── supabase/                     # Supabase 配置
│   └── schema.sql                # 数据库 Schema（表 + RLS + 函数）
│
└── README.md
```

## 数据库设计

所有表启用 RLS（Row Level Security），用户只能访问自己的数据。

| 表 | 说明 |
|----|------|
| `profiles` | 用户资料（关联 auth.users） |
| `banks` | 题库（支持 is_shared 广场共享、source_bank_id 导入溯源） |
| `questions` | 题目 |
| `practice_sessions` | 练习会话 |
| `practice_details` | 练习答题详情 |
| `mistakes` | 错题记录 |
| `learning_logs` | 每日学习日志 |
| `ai_usage_logs` | AI 调用用量日志 |

## AI 服务商配置

| 服务商 | API 地址 | 可用模型 |
|--------|----------|----------|
| OpenAI | `https://api.openai.com/v1` | gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, o4-mini |
| DeepSeek | `https://api.deepseek.com` | deepseek-v4-flash, deepseek-v4-pro |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | glm-4-plus, glm-4-flash |
| Moonshot | `https://api.moonshot.cn/v1` | moonshot-v1-8k/32k/128k |
| 自定义 | 自行填写 | 自行填写 |

在 Profile 页选择服务商 → 填入 API Key → 测试连接 → 通过后保存。配置 DeepSeek 后自动显示账户余额。

## 部署

### EdgeOne Pages

构建配置：

| 配置项 | 值 |
|--------|-----|
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| Node 版本 | 20 |

环境变量：

| 变量 | 说明 |
|------|------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名 Key |
| `VITE_GITEE_CLIENT_ID` | Gitee OAuth Client ID（可选） |
| `VITE_GITEE_CLIENT_SECRET` | Gitee OAuth Client Secret（可选） |

SPA 回退：配置 404 → `/index.html`（状态码 200）。

EdgeOne Functions 路由：

| 路径 | 函数 | 说明 |
|------|------|------|
| `/api/auth-gitee` | `edge-functions/api/auth-gitee.js` | Gitee OAuth 回调 |

## License

MIT
