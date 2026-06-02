# Cognix - 智能题库练习平台

Cognix 是一个支持多用户的智能题库练习平台，支持多种题型、AI 智能导入、错题分析、学习数据追踪。

## 功能特性

- 📚 **题库管理** — 创建、编辑、删除题库和题目
- 🤖 **AI 智能导入** — 上传 txt/docx 文件，AI 自动生成题目
- ✍️ **多种练习模式** — 顺序练习、随机练习、错题练习
- 📊 **学习统计** — 热力图、正确率趋势、连续学习天数
- ❌ **错题本** — 自动记录错题，支持批量删除/掌握
- 👤 **多用户支持** — 注册/登录、个人主页、独立 AI 配置
- 🌙 **暗色模式** — 支持亮色/暗色主题切换

## 技术栈

### 前端
- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn/ui 风格组件
- React Router v7
- Font Awesome 图标

### 后端
- FastAPI (Python)
- SQLAlchemy 2.0 (async) + MySQL 8.0
- Redis 7 (缓存)
- JWT 认证

## 快速开始

### 前端

```bash
npm install
npm run dev
```

访问 http://localhost:5173

### 后端

```bash
cd "Cognix backend"
pip install -r requirements.txt
python -m seed.seed_data   # 初始化数据库
python app.py               # 启动服务
```

后端运行在 http://localhost:8000

### 环境配置

在 `Cognix backend/.env` 中配置：

```env
DATABASE_URL=mysql+aiomysql://user:pass@host:3306/cognix
REDIS_HOST=localhost
REDIS_PORT=6379
SECRET_KEY=your-secret-key
```

AI 功能需要用户在个人主页中配置自己的 API Key。

## 默认账号

| 字段 | 值 |
|------|-----|
| 邮箱 | 1149356389@qq.com |
| 密码 | admin123 |

## 项目结构

```
├── src/                    # 前端源码
│   ├── components/         # UI 组件
│   ├── contexts/           # React Context
│   ├── lib/                # 工具函数
│   ├── pages/              # 页面组件
│   └── styles/             # 样式文件
├── Cognix backend/         # 后端源码
│   ├── app/
│   │   ├── api/            # API 路由
│   │   ├── models/         # 数据库模型
│   │   ├── schemas/        # Pydantic Schema
│   │   ├── services/       # 业务逻辑
│   │   └── utils/          # 工具模块
│   └── seed/               # 数据库种子脚本
└── README.md
```

## License

MIT
