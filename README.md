# Cognix — 智能题库练习平台

Cognix 是一个现代化的多用户智能题库练习平台。你可以在这里创建题库、刷题练习、追踪学习数据、借助 AI 批量导入或生成题目，还能在题库广场发现社区小伙伴分享的优质题库，一键导入即用。

> 🚀 在线体验：[https://cognix.liveling.top](https://cognix.liveling.top)

![Cognix 首页](docs/images/home.png)

---

## ✨ 功能特性

### 📚 题库与题目管理

在 Cognix 中，所有题目都归属到「题库」下管理，一个题库可以容纳任意数量的题目。

- **创建与管理** — 新建题库时填写标题和简介，支持随时编辑。列表页展示每个题库的题目数量，一目了然。
- **手动录入** — 逐题编写题干、选项（最多 6 个）、正确答案和解析，设置难度等级（简单 / 中等 / 困难）和自定义标签。
- **批量操作** — 支持全选、批量删除题目，以及一键清空整个题库。
- **搜索与筛选** — 在题库详情页按关键词搜索题目，按题型（单选 / 多选 / 判断）和难度快速过滤。
- **题库共享** — 可将题库设为「公开共享」，共享后的题库会出现在广场中供其他用户导入。

![题库管理](docs/images/banks.png)

### 🌐 题库广场

题库广场是 Cognix 的社区共享空间。用户可以把优质题库公开分享，其他人可以搜索、浏览并一键导入到自己的题库列表中。

- **搜索浏览** — 按题库名称模糊搜索，卡片式布局展示题库标题、简介、题目数量和作者。
- **一键导入** — 点击按钮即可将共享题库复制到自己的账户，自动去重，已导入的题库会标记为「已导入」状态。
- **溯源追踪** — 导入的题库会记录来源，方便回溯原作者。

![题库广场](docs/images/square.png)

### 🤖 AI 智能导入与生成

Cognix 内置强大的 AI 辅助功能，大幅降低题目录入成本。支持 OpenAI、DeepSeek、智谱 GLM、Moonshot 以及任意兼容 OpenAI 协议的自定义服务商。

- **导入已有题目** — 直接粘贴题目文本或上传文件（支持 txt/md/docx/pdf），AI 自动解析题型、提取选项和答案，输出标准格式供你审核。
- **从材料生成题目** — 上传学习资料，分别指定单选、多选、判断三种题型的生成数量，AI 会根据材料内容智能出题。
- **逐题审核** — 生成完成后进入审核步骤，可逐题编辑题干、选项、答案和解析，也可以删除不满意的题目。确认无误后一次性保存入库。
- **连接测试** — 在 Profile 页配置 AI 后，可一键测试连接是否正常，通过后才允许使用 AI 功能。

![AI 智能导入](docs/images/ai-import.png)

### 🎯 多模式练习

- **顺序练习** — 按题库中题目的原始顺序逐题作答，适合第一轮系统学习。
- **随机练习** — 从题库中随机抽取题目，打乱顺序，模拟真实考试的不确定性。
- **错题复习** — 针对历史错题进行强化训练。每道错题连续答对 3 次后自动标记为「已掌握」，从错题本中归档。

![错题本](docs/images/mistakes.png)
- **灵活设置** — 每次练习前可选择题库、模式、题目数量，随时调整练习策略。
- **答题反馈** — 提交答案后即时显示对错、正确答案和解析。单选题和判断题点击即提交，多选题确认后提交。
- **计时统计** — 每道题独立计时 + 整场练习总计时，练习结束时展示正确率、总用时和逐题详情。

![练习答题](docs/images/practice.png)

![练习结果](docs/images/practice-result.png)

### 📊 学习追踪与统计

Cognix 有一整套学习数据追踪体系，让你的进步看得见。

- **个人仪表盘** — Profile 页集中展示今日答题数、正确率、连续学习天数、累计题库和题目总数。
- **学习热力图** — GitHub 风格的 6 个月学习热力图，每天练习量以颜色深浅呈现，学习节奏一目了然。
- **练习记录** — 列出最近练习日期、模式、正确率和用时，点击可展开查看详情。
- **等级系统** — 四档等级称号：
  - 🟢 **初学者** — 正确率 < 60%
  - 🔵 **勤奋学员** — 正确率 ≥ 60%
  - 🟣 **进阶学者** — 正确率 ≥ 80%
  - 🏆 **刷题大师** — 正确率 ≥ 95%
- **AI 用量统计** — 独立加载的 AI 调用统计卡片，展示今日 / 本周 / 本月 / 总计的 Token 消耗和调用次数。
- **全站统计** — 首页可切换查看「全站」或「个人」统计，全站模式展示平台总题库数、总题目数、今日总答题量、注册用户数。

![学习统计](docs/images/profile.png)

### 👤 用户系统

- **邮箱注册** — 注册时需填写邮箱和密码，系统会发送 6 位 OTP 验证码到邮箱，验证通过后完成注册。
- **密码登录** — 支持「记住我」（自动填充邮箱和头像）和「记住密码」（加密存储于 Cookie）。
- **忘记密码** — 输入邮箱获取 OTP 验证码 → 设置新密码，无需管理员介入。
- **第三方登录** — 支持 **Gitee OAuth**（EdgeOne Functions 后端）和 **GitHub OAuth**（Supabase 内置）两种快捷登录方式。

![登录页](docs/images/login.png)
- **个人资料编辑** — 修改昵称、个人简介、QQ 号。头像支持本地上传裁剪或自动获取 QQ 头像。
- **密码修改** — 在 Profile 页通过模态框修改密码，输入旧密码 + 新密码即可完成。
- **独立 AI 配置** — 每个用户拥有独立的 AI 服务商、API Key 和模型设置。配置保存在数据库中，仅自己可见。连接测试通过后才保存启用。
- **DeepSeek 余额查询** — 配置 DeepSeek API Key 后自动拉取账户余额，一键刷新，随时掌握额度。

![AI 配置](docs/images/ai-config.png)

### 🎨 界面与体验

- **暗色模式** — 亮色 / 暗色主题一键切换，自动记忆偏好。
- **响应式布局** — 桌面端宽屏布局 + 移动端自适应，手机刷题体验流畅。
- **滚动入场动画** — 首页功能卡片等元素在滚动进入视口时播放精致的入场动画（堆叠展开、淡入上浮、缩放淡入等），提升浏览质感。
- **一言** — 首页 Hero Banner 和登录页左下角展示随机「一言」语录，调用一言 API 并缓存 5 分钟。
- **骨架屏加载** — 数据加载时展示骨架屏占位，避免页面跳动，体验更流畅。
- **懒加载路由** — 所有页面组件基于 React.lazy 按需加载，首屏体积更小、加载更快。

![暗色模式](docs/images/dark-mode.png)

---

## 🛠 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端框架 | React 19 + TypeScript 6 | 函数组件 + Hooks，严格类型约束 |
| 编译优化 | React Compiler（Babel 插件） | 自动 memoization，减少不必要的重渲染 |
| 构建工具 | Vite 8 | 极速 HMR，ESBuild 预构建 |
| 样式方案 | Tailwind CSS 3 | 原子化 CSS，暗色模式开箱即用 |
| 路由 | React Router v7 | 组件式路由，懒加载 Suspense |
| 状态管理 | Zustand 5 | 轻量级全局状态，按需订阅 |
| 图标库 | Lucide React + Font Awesome + React Icons | 三套图标互补覆盖 |
| 图像裁剪 | react-easy-crop | 头像上传交互式裁剪 |
| 后端服务 | Supabase | 数据库 + 认证 + RLS 权限 |
| 数据库 | PostgreSQL（Supabase 托管） | 关系型存储，函数 + 触发器 |
| 认证 | Supabase Auth | 邮箱 OTP + OAuth 2.0 |
| 服务端逻辑 | EdgeOne Pages Functions | 边缘函数，Gitee OAuth 回调处理 |
| AI 协议 | OpenAI-compatible chat/completions | 多服务商统一接口 |
| 托管部署 | 腾讯云 EdgeOne Pages | 全球 CDN 加速，边缘函数支持 |

---

## 🚀 快速开始

### 前置要求

- Node.js ≥ 20
- Supabase 项目（[免费创建](https://supabase.com)）
- （可选）EdgeOne Pages 项目（用于 Gitee OAuth 和部署）

### 本地运行

```bash
# 克隆仓库
git clone https://gitee.com/whpa24soft/cognix.git
cd cognix

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 `http://localhost:5173`

### 环境变量

在项目根目录创建 `.env` 文件：

```env
# Supabase（必填）
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Gitee OAuth（可选，用于 Gitee 第三方登录）
VITE_GITEE_CLIENT_ID=your-gitee-client-id
VITE_GITEE_CLIENT_SECRET=your-gitee-client-secret
```

### 数据库初始化

1. 打开 Supabase 项目 Dashboard → SQL Editor
2. 将 `supabase/schema.sql` 的内容粘贴并执行
3. 该脚本会自动创建所有表、索引、RLS 策略、存储函数和触发器

### EdgeOne Functions 部署

项目使用 EdgeOne Pages Functions 处理 Gitee OAuth 回调。部署到 EdgeOne Pages 时，`edge-functions/` 目录下的函数会自动生效。

EdgeOne Pages 环境变量需与本地 `.env` 保持一致。

---

## 📁 项目结构

```
cognix/
├── src/                              # 前端源码
│   ├── components/
│   │   ├── layout/
│   │   │   ├── layout.tsx            # 页面布局（Header + 内容 + Footer）
│   │   │   ├── header.tsx            # 顶部导航栏（Logo、导航、主题切换、用户菜单）
│   │   │   └── footer.tsx            # 底部版权信息
│   │   ├── ui/
│   │   │   ├── button.tsx            # 基础按钮（多尺寸、多变体）
│   │   │   ├── enhanced-button.tsx   # 增强按钮（动画效果、lift/glow 等交互）
│   │   │   ├── badge.tsx             # 标签徽章
│   │   │   ├── card.tsx              # 卡片容器
│   │   │   ├── input.tsx             # 输入框
│   │   │   ├── skeleton.tsx          # 骨架屏（卡片、列表、文本等多种预设）
│   │   │   ├── scroll-reveal.tsx     # 滚动驱动入场动画包装器
│   │   │   └── question-card.tsx     # 练习答题卡片（选项渲染、状态样式）
│   │   ├── protected-route.tsx       # 登录保护路由（未登录重定向到 /login）
│   │   ├── portal.tsx                # React Portal 传送门（模态框挂载到 body）
│   │   └── user-avatar.tsx           # 用户头像（支持图片 / 首字母回退）
│   ├── contexts/
│   │   ├── SupabaseAuthContext.tsx   # 认证上下文（登录、注册、OTP、OAuth、Session 管理）
│   │   └── ThemeContext.tsx          # 主题上下文（亮色 / 暗色切换、localStorage 持久化）
│   ├── hooks/
│   │   ├── use-saying.ts             # 一言 API Hook（fetch + localStorage 缓存）
│   │   └── useScrollReveal.ts        # 滚动入场 Hook（IntersectionObserver）
│   ├── lib/
│   │   ├── supabase.ts               # Supabase 客户端初始化
│   │   ├── database.types.ts         # 数据库表类型定义（TypeScript 类型生成）
│   │   ├── question-utils.ts         # 题目格式转换（DB ↔ 前端类型）
│   │   ├── ai-tracker.ts             # AI 用量追踪（fire-and-forget 写入 ai_usage_logs）
│   │   ├── cache.ts                  # 前端缓存管理（内存 + TTL）
│   │   ├── cookies.ts                # Cookie 读写工具
│   │   ├── types.ts                  # 通用 TypeScript 类型（Bank、Question、Mistake 等）
│   │   └── utils.ts                  # 通用工具函数（cn 类名合并等）
│   ├── pages/
│   │   ├── home.tsx                  # 首页（Hero Banner + 一言 + 功能卡片 + 全站/个人统计切换）
│   │   ├── login.tsx                 # 登录 / 注册 / 忘记密码（OTP 验证 + Gitee / GitHub OAuth）
│   │   ├── profile.tsx               # 个人主页（仪表盘统计 + 资料编辑 + 头像裁剪 + AI 配置 + 密码修改）
│   │   ├── bank-list.tsx             # 题库列表（创建、搜索、删除）
│   │   ├── bank-detail.tsx           # 题库详情（题目列表 + 筛选 + 批量操作 + AI 导入 + 共享）
│   │   ├── question-form.tsx         # 题目创建 / 编辑表单
│   │   ├── practice-setup.tsx        # 练习设置（选择题库、模式、数量）
│   │   ├── practice-session.tsx      # 练习答题（逐题计时 + 即时反馈 + 完成统计）
│   │   ├── mistakes.tsx              # 错题本（筛选 + 批量操作 + 展开解析 + 去练习）
│   │   └── square.tsx                # 题库广场（共享题库浏览 + 搜索 + 一键导入）
│   ├── styles/
│   │   ├── animations.css            # 入场动画关键帧（block-stack、fade-up、fade-scale、hotbar-slide）
│   │   └── index.css                 # 全局样式 + Tailwind 指令
│   └── App.tsx                       # 根组件（路由配置 + 懒加载 Suspense）
│
├── edge-functions/                   # EdgeOne Pages Functions
│   └── api/
│       └── auth-gitee.js             # Gitee OAuth 回调（code → Supabase session）
│
├── supabase/
│   └── schema.sql                    # 数据库 Schema（表 + 索引 + RLS + 函数 + 触发器）
│
├── public/                           # 静态资源
│   ├── favicon.svg                   # 网站图标
│   ├── logo.png                      # Logo 图片
│   └── cognix-profile_back.png       # Profile 页默认 Banner 背景
│
├── index.html                        # Vite 入口 HTML
├── vite.config.ts                    # Vite 构建配置
├── tailwind.config.js                # Tailwind 主题配置
├── package.json                      # 依赖与脚本
├── tsconfig.json                     # TypeScript 配置
└── README.md                         # 本文件
```

---

## 🗄 数据库设计

所有表均启用 **RLS（Row Level Security）**，用户只能访问和操作自己的数据。站点统计等公开数据通过 `SECURITY DEFINER` 函数提供。

| 表 | 说明 | 关键字段 |
|---|---|---|
| `profiles` | 用户资料（1:1 关联 `auth.users`） | name、bio、avatar_url、qq_number、ai_provider、ai_api_key、ai_model |
| `banks` | 题库 | title、description、is_shared、source_bank_id、user_id |
| `questions` | 题目 | type、stem、options、answers、analysis、difficulty、tags、bank_id |
| `practice_sessions` | 练习会话 | mode、bank_id、correct_count、total_count、duration、user_id |
| `practice_details` | 每题答题详情 | session_id、question_id、user_answer、is_correct、time_spent |
| `mistakes` | 错题记录（去重聚合） | question_id、wrong_count、last_wrong_at、is_mastered、user_id |
| `learning_logs` | 每日学习日志 | date、answered_count、user_id |
| `ai_usage_logs` | AI 调用用量记录 | action、model、prompt_tokens、completion_tokens、total_tokens、user_id |

核心 RPC 函数：

| 函数 | 说明 |
|---|---|
| `get_dashboard_stats()` | 当前用户的仪表盘统计（今日答题、正确率、连续天数等） |
| `get_site_stats()` | 全站公开统计（题库数、题目数、用户数、今日答题数） |
| `get_ai_usage_stats()` | 当前用户的 AI 用量统计（今日/本周/本月/总计） |
| `get_email_by_name(name)` | 通过用户名查找邮箱（用户名登录支持） |
| `copy_shared_bank(p_bank_id)` | 导入共享题库（复制题目 + 去重检测） |

---

## 🤖 AI 服务商配置

在 Profile 页 → AI 配置中设置。支持以下预设服务商，也可填写自定义 API 地址和模型。

| 服务商 | API 地址 | 推荐模型 |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | gpt-4o、gpt-4o-mini、gpt-4.1、gpt-4.1-mini、o4-mini |
| DeepSeek | `https://api.deepseek.com` | deepseek-v4-flash、deepseek-v4-pro |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | glm-4-plus、glm-4-flash |
| Moonshot | `https://api.moonshot.cn/v1` | moonshot-v1-8k、moonshot-v1-32k、moonshot-v1-128k |
| 自定义 | 自行填写 | 自行填写（兼容 OpenAI 协议即可） |

配置流程：选择服务商 → 填入 API Key → （可选）自定义模型 → 点击「测试连接」→ 测试通过后保存。配置 DeepSeek 后会自动显示账户余额，支持一键刷新。

---

## 🚢 部署

### EdgeOne Pages（推荐）

项目已在腾讯云 EdgeOne Pages 上运行，享受全球 CDN 加速和边缘函数支持。

| 配置项 | 值 |
|---|---|
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| Node 版本 | 20 |
| SPA 回退 | 404 → `/index.html`（状态码 200） |

**环境变量：**

| 变量 | 必填 | 说明 |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase 匿名 Key |
| `VITE_GITEE_CLIENT_ID` | ❌ | Gitee OAuth Client ID |
| `VITE_GITEE_CLIENT_SECRET` | ❌ | Gitee OAuth Client Secret |

**EdgeOne Functions 路由：**

| 路径 | 函数文件 | 说明 |
|---|---|---|
| `/api/auth-gitee` | `edge-functions/api/auth-gitee.js` | 处理 Gitee OAuth 回调，交换 code 获取 token |

### 其他平台

项目构建产物为纯静态文件（`dist/`），可部署到任意静态托管服务（Vercel、Netlify、Cloudflare Pages、Nginx 等）。注意需配置 SPA 回退规则，确保前端路由正常工作。Gitee OAuth 功能需要 EdgeOne Functions 或等效的 Serverless 函数支持。

---

## 📄 License

MIT
