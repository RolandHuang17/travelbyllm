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
- [ ] 完成单城市规划功能原型

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

### 2. 启动前端
```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`，开发阶段通过 Vite proxy 将 `/api` 转发到后端。

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
