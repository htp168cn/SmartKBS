# CLAUDE.md

本文件为 AI 助手在本仓库工作时的上下文指引。

## 项目概览

SmartKBS 是面向小学/初中/高中的 AI 智慧教学平台（FastAPI + React 19 + TypeScript + SQLite），
覆盖「教·学·练·评·管」五条主线。学科、年级、班级、题型、称号、模型与提示词全部配置驱动
（`backend/system_config.json` + 主数据表），代码中不做学科硬编码。支持完全离线部署：
数据全部落在本地 SQLite 与本地目录，后端同时托管 `frontend/dist`。

## 常用命令

```bash
# 后端（默认 0.0.0.0:8086，reload=True，启动即托管 frontend/dist）
python backend/main.py

# 前端开发（5173，/api 代理到 8086）
cd frontend && npm run dev

# 前端构建（tsc -b + vite build，产物 frontend/dist）
cd frontend && npm run build

# 前端 lint
cd frontend && npm run lint

# 安装依赖
pip install -r requirements.txt
cd frontend && npm install
```

注意：`npm run build` 含 `tsc -b`，仓库存在若干 antd 6 类型遗留错误；仅验证打包可改用
`npx vite build`。仓库整体 eslint 有存量告警，评估改动时只看本次涉及文件的报错。

## 后端架构

- 入口 [backend/main.py](backend/main.py)：`lifespan` 内完成建表、数据治理（幂等）、gzip/SSE 自检、
  实例守卫；所有路由以 `/api/<模块>` 前缀注册（见 main.py 250~340 行）；最后是前端 catch-all 静态路由
  （含路径穿越防护，务必保持在所有 API 路由之后）。
- 路由层 `backend/api/*_router.py`（49 个模块）；业务/算法层在 `backend/*.py`。
- 中间件 [backend/middleware.py](backend/middleware.py)：JWT 校验 + 按数据库真值校正角色 +
  `public_paths` 白名单；未登录访问 `/api/*` 返回 401。
- 认证 [backend/auth.py](backend/auth.py)：bcrypt 密码 + PyJWT；角色常量
  `ROLE_ADMIN=0 / ROLE_TEACHER=1 / ROLE_STUDENT=2`；Token 带 `version` 实现改密/踢下线。
- 权限 [backend/permission_service.py](backend/permission_service.py)：年级/班级/学科范围判定统一走这里，
  不要在路由里自己拼权限 SQL。

### 双数据库（重要）

| 库 | 模块 | 内容 | 行类型 |
| --- | --- | --- | --- |
| `backend/smartkb.db` | `backend.database` | 用户、班级、积分、点名、任务、通知、课程… | `execute_query` 返回**元组**；需要列名用 `execute_query_dict` |
| `backend/questions.db` | `backend.question_db` | 题库、考试 `exams`、答卷 `exam_attempts`、练习、代码题 | `execute_query` 返回 **`sqlite3.Row`（可按列名取值）** |

跨库查询不能 JOIN，只能在应用层拼装。改表结构走 `backend/migrations/`（版本化脚本）+ `init_db()`，
迁移必须幂等，失败只记日志不阻断启动。

## 前端架构

- 路由与角色守卫 [frontend/src/App.tsx](frontend/src/App.tsx)：`RequireRole` 在路由层拦截越权访问，
  不要只靠菜单隐藏；新增页面须同时处理菜单、路由守卫与移动端白名单。
- 布局菜单 [frontend/src/components/AppLayout.tsx](frontend/src/components/AppLayout.tsx)：
  按角色构建不同菜单（管理员/教师、学生）。
- 移动端适配 [frontend/src/constants/mobileNav.ts](frontend/src/constants/mobileNav.ts)：
  `isMobileAllowedPath(role, path)` 前缀白名单 + `MobileTabBar` 底部 Tab + `DesktopOnlyGuide` 拦截；
  未纳入白名单的页面在手机上显示「请用电脑端」。
- 请求层 `frontend/src/api/*.ts`，统一走 [client.ts](frontend/src/api/client.ts)（axios + token 注入 +
  401 派发 `AUTH_UNAUTHORIZED_EVENT` 统一登出）。
- 状态 Zustand：`frontend/src/stores/`（authStore、chatStore、themeStore、localeStore…）。
- 国际化：i18next + http-backend，从 `/locales/{{lng}}/{{ns}}.json` 加载，`defaultNS=common`；
  文案放 `frontend/public/locales/{zh-CN,en}/<命名空间>.json`，后端文案在 `backend/locales/`。
- UI：antd 6 + 自研组件；图表 recharts；编辑器 monaco；白板 tldraw v5。

## 环境与配置

- 运行时配置（学科、模型、API Key 等）由 `backend/api/config_router.py` 管理，落盘
  `backend/system_config.json`（含密钥，不入版本库）。改配置优先走 `/api/config`。
- 环境变量：
  - `JWT_SECRET_KEY`：生产必须设置为随机值，否则使用内置默认密钥（启动会告警）。
  - `SMARTKB_DATA_DIR`：数据根目录（桌面版由 Electron 指到 userData）。
  - `SMARTKB_FRONTEND_PATH`：前端产物目录覆盖。
  - AI Key 走配置文件/后台，不要写进代码或提交仓库。
- Python 依赖见 `requirements.txt`（注意其中 `latex2mathml>=3.80` 与 `cairosvg` 在部分环境装不上，
  属存量问题）。

## 编码约定

- 全部注释、文档、提交信息使用中文；关键/难懂逻辑必须写中文注释说明「为什么」。
- 函数保持短小、单一职责；提前返回避免深层嵌套；单文件改动避免产生超长函数。
- 数据库访问用裸 SQL + 参数绑定，不引入 ORM；注意区分上面两个库的连接与行类型。
- 新增 API 需在 `backend/main.py` 注册路由，并确认中间件鉴权行为符合预期。
- 新增前端页面需同步：路由（含角色守卫）、菜单项、i18n 文案、移动端白名单（如适用）。
- 不要修改 `frontend/dist`（构建产物）与运行期数据（`*.db`、`root/`、`stu/`、`question_media/`）。
