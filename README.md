# travelbyllm

软件开发实践课程项目。

## 项目简介
本项目旨在实现一个基于大语言模型的智能旅游规划系统，支持根据用户需求生成个性化旅游方案。

## 技术栈
- 前端：React + Vite + TypeScript
- 前端样式：Tailwind CSS
- 后端：Node.js + Express
- 数据库：SQLite + Prisma

## 当前进度
- [x] 初始化项目结构
- [x] 配置前端项目
- [x] 配置后端项目
- [x] 接入 Prisma + SQLite
- [x] 提供 `/api/health` 健康检查接口
- [x] 前端首页完成前后端连通性验证
- [x] 完成用户、偏好卡片、历史记录和规划模块基础链路
- [x] 完成高德互动地图、地点收藏和路线查询模块

## 本阶段骨架

### frontend
- `React + TypeScript + Vite`
- 最小接入 `Tailwind CSS`
- 首页为极简状态页，用于验证后端接口和数据库连通性

### backend
- `Express + TypeScript`
- 最小 `cors` 白名单配置，允许本地前端开发地址访问
- 提供 `GET /api/health`
- 通过 Prisma 执行最小数据库探测，验证 SQLite 可用

## 启动方式

### 1. 启动后端
```bash
cd backend
npm install
npm run prisma:generate
npm run dev
```

后端默认运行在 `http://localhost:3001`。

后端 `.env` 需要配置基础数据库、JWT、可选大模型参数，以及地图和 SMTP 相关参数：

```bash
DASHSCOPE_API_KEY="阿里云百炼 API Key"
LLM_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
LLM_MODEL="qwen3.7-max"
LLM_ENABLE_THINKING="true"
LLM_TIMEOUT_MS="120000"
PLAN_LLM_TIMEOUT_MS="90000"
AMAP_WEB_SERVICE_KEY="高德 Web 服务 Key"
AMAP_JS_SECURITY_CODE="高德 JS API 安全密钥"
SMTP_HOST="smtp.qq.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="QQ 邮箱地址"
SMTP_PASS="QQ 邮箱新生成的 SMTP 授权码"
MAIL_FROM="TravelByLLM <QQ 邮箱地址>"
PUBLIC_WEB_URL="http://localhost:5173"
AUTH_CHALLENGE_SECRET="一段足够长的随机字符串"
```

`LLM_ENABLE_THINKING` 用于控制 Qwen3.7-Max 的思考模式；需要降低响应时间或成本时可以改成 `"false"`。`PLAN_LLM_TIMEOUT_MS` 限制行程生成等待时间，超时后会返回可展示的兜底方案，避免页面持续等待。修改后重启后端服务，前端规划页面会通过 `/api/plan/llm-status` 自动显示当前模型名。

邮箱绑定、密码找回和安全通知使用 SMTP 发送邮件。QQ 邮箱授权码等同于密码，已暴露的授权码需要在 QQ 邮箱中撤销并重新生成，只写入本机 `.env`。

### 2. 启动前端
```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`，开发阶段通过 Vite proxy 将 `/api` 转发到后端。

前端 `.env.local` 需要配置可公开的高德 JS API Key：

```bash
VITE_AMAP_JS_KEY="高德 JS API Key"
```

高德 JS API 安全密钥不再放在前端环境变量中，浏览器请求会经由后端 `/_AMapService` 代理补齐安全参数。

## 健康检查接口

后端提供：

```http
GET /api/health
```

成功时返回：

```json
{
  "status": "ok",
  "service": "backend",
  "database": "ok",
  "timestamp": "2026-03-31T12:34:56.789Z"
}
```

## Prisma 工作流

本项目当前已经接入 Prisma 和 SQLite，但还没有创建正式业务表。本阶段遵循标准 migration 流程：

### 当前阶段
1. 配置 `prisma/schema.prisma`
2. 配置 `prisma.config.ts`
3. 执行 `npm run prisma:generate`

### 下一步开始建模时
1. 在 `backend/prisma/schema.prisma` 中新增业务模型，例如 `User`、`PreferenceCard`、`TravelRecord`
2. 执行：

```bash
npm run prisma:migrate:dev -- --name init
```

3. 后续 schema 变更继续使用：

```bash
npm run prisma:migrate:dev -- --name <change-name>
```

4. 部署环境使用：

```bash
npm run prisma:migrate:deploy
```

### 说明
- `prisma generate`：生成 Prisma Client，供后端代码调用数据库
- `prisma migrate dev`：生成并应用本地 migration，同时更新 SQLite 数据库
- `prisma migrate deploy`：在部署环境执行已存在的 migration

## 下一步建议
1. 设计首批 Prisma 模型：`User`、`PreferenceCard`、`TravelRecord`
2. 搭建注册/登录接口骨架和密码摘要存储
3. 建立前端基础页面路由和公共布局，为后续业务页面预留入口
