# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   │   ├── api/            # API 路由
│   │   │   └── supabase-config/  # Supabase 配置接口
│   │   ├── login/          # 登录页面
│   │   ├── register/       # 注册页面
│   │   ├── layout.tsx      # 根布局（注入 Auth Provider）
│   │   └── page.tsx        # 首页（认证后 Dashboard）
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   ├── auth-context.tsx       # Auth 上下文（用户状态管理）
│   │   ├── supabase-browser.ts    # 浏览器端 Supabase 客户端
│   │   ├── supabase-config-inject.tsx  # Supabase 配置注入
│   │   └── utils.ts        # 通用工具函数 (cn)
│   ├── middleware.ts        # 路由中间件
│   ├── server.ts           # 自定义服务端入口
│   └── storage/database/   # 数据库层
│       ├── supabase-client.ts     # 服务端 Supabase 客户端
│       └── shared/schema.ts       # Drizzle Schema 定义
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata，详见文档：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
   1. 三方 CSS、字体等资源可在 `globals.css` 中顶部通过 `@import` 引入或使用 next/font
   2. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入
   3. json-ld 可阅读 https://nextjs.org/docs/app/guides/json-ld

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**

## 认证系统

- 使用 Supabase Auth 实现用户认证
- 支持邮箱密码登录/注册（手机号登录未启用）
- 邮箱注册自动确认（mailer_auto_confirm: true）
- 认证状态通过 `useAuth()` hook 获取
- 前端 Supabase 客户端通过 `/api/supabase-config` 动态获取配置
- 用户角色存储在 `profiles` 表中（role: admin/enterprise）

## 业务功能规划

### Admin（管理员）端
- 首页：园区地图，显示企业和排污口
- 企业管理：审批企业、污染物、排污口
- 实时监测：预警中心

### User（企业）端
- 首页：污染物管理 + 地图
- 排污点监测：实时监测、历史曲线
- CDC 分析
