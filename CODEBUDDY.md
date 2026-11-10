# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## 项目概览

**SmartKBS**（v8.9.0，AGPL-3.0）— 面向小学/初中/高中全学段的 AI 智慧教学平台，覆盖教·学·练·评·管五条主线。

- 后端：Python 3.11+ · FastAPI · Uvicorn · SQLite 双库（无外部数据库）· JWT 认证
- 前端：React 19 · TypeScript · Vite · Ant Design 6 · Zustand · React Router 7 · tldraw · i18next（全站中英双语）
- AI：阿里云 DashScope（通义千问/通义万相）与 DeepSeek，SSE 流式 + WebSocket 实时链路
- **学科无关、配置驱动**：学科/年级/班级/题型/模型/提示词全部来自 `backend/system_config.json` 与数据库主数据表，禁止在代码里硬编码任何一门学科
- 可完全离线部署；数据全部落在本地 SQLite 与本地目录

## 常用命令

### 后端

```bash
pip install -r requirements.txt          # 国内可加 -i https://mirrors.aliyun.com/pypi/simple/
python backend/main.py                   # 启动：uvicorn reload 模式，端口 8086，自动托管 frontend/dist
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8086 --reload   # 等价显式写法
```

默认管理员账号 `root` / `root`。涉及 WebSocket、语音合成、AI 超时策略的改动需要**重启后端**才生效。

### 前端（在 `frontend/` 下执行）

```bash
npm install
npm run dev        # 开发服务器 :5173，/api 等请求代理到 :8086（后端须同时在跑）
npm run build      # tsc -b && vite build，产物输出到 frontend/dist
npm run lint       # ESLint
npm run build:https-site   # 仅「公网 HTTPS 站点 + 教学白板」才用：把 React 退回 development 以跳过 tldraw license 校验，见 vite.config.ts 注释
```

`frontend/dist` 是**入库的预编译产物**，后端直接托管它——改完前端源码必须重新 `npm run build`，否则运行中的站点看不到变化。

### 测试与巡检

- 仓库**没有自动化单元/集成测试**，也没有 Python 测试框架配置。
- 移动端页面巡检：`cd frontend/mobile-qa && node proxy.cjs`（反代 :5199）+ `node scan.cjs`，在 390×844 下量化溢出/截断/破图并截图，任一指标越线返回码 1，可当发布门禁；详见 `frontend/mobile-qa/README.md`。

### 关键环境变量

| 变量 | 作用 |
| --- | --- |
| `JWT_SECRET_KEY` | 不设则用内置默认密钥并在启动时告警 |
| `SMARTKB_DOCS_ENABLED=1` | 打开 `/docs`、`/openapi.json`（默认关闭，防止匿名拉走接口清单） |
| `SMARTKB_DATA_DIR` | 覆盖用户数据目录（桌面版 Electron 用它指到 `%APPDATA%\SmartKBS`） |
| `SMARTKB_FRONTEND_PATH` | 覆盖前端产物目录 |

## 架构（大图）

### 双 SQLite 库 + 本地文件存储

- `backend/smartkb.db`（经 `backend/database.py`）：用户、积分、点名、任务、通知、考试业务数据，以及年级/班级/教师任教范围等主数据。
- `backend/questions.db`（经 `backend/question_db.py`）：试题库与考试数据，与业务库物理分离。
- 模式演进走**启动期幂等加列**（`database.py` 的 `_ensure_column`：吞 duplicate column、锁冲突重试）+ `backend/migrations/`，升级不需人工干预；新增表/列的迁移必须写成幂等且失败不阻断启动。
- 运行时产物不入库：`system_config.json`（含密钥）、`root/`、`stu/`（对话历史/资源 HTML/画像）、`question_media/`、`temp_uploads/`、日志、`db_backups/`。

### 后端入口与路由装配

`backend/main.py` 是唯一装配点：lifespan 里做大量启动自检与数据治理（gzip/SSE 自检、脏数据清理、积分键归位、后台守护线程如日志保留/主观题批改/画像巡检/版本检测），每项均 try 包裹不阻断启动。约 45 个业务路由在 `backend/api/*_router.py`，逐个 `include_router(prefix="/api/...")`——**新增功能 = 新建 router 文件 + 在 main.py 挂载**。所有 API 路由之后才是托管 `frontend/dist` 的 catch-all 静态路由（含路径穿越防护），**顺序不能调换**，否则静态路由会遮蔽 API。

### 认证与权限

- `backend/auth.py`：bcrypt + PyJWT；users 表的 `token_version` 实现单点登录（异地登录踢出）。
- `backend/middleware.py`：`AuthMiddleware` 校验 Bearer/cookie，把用户注入 `request.state`，401 一律带原因码（`auth_errors.py`，与前端 `api/client.ts` 的 `AuthErrorCode` 一一对应），滑动续期经 `X-Renew-Token` 头下发新令牌。角色为数字：0 管理员 / 1 教师 / 2 学生。
- 路由内用 `api/dependencies.py` 的 `get_current_user` / `require_admin`；**教师能看到哪些年级班级，唯一入口是 `permission_service.py`**（查 teacher_assignments），不要另写解析逻辑。前端在 `App.tsx` 用 `RequireRole` 做路由级角色守卫。

### AI 调用链（三模式自动接管、逐级降级）

`backend/api/ai_service.py` 是所有 LLM 调用的统一封装：RAG 知识库检索（`rag.py`、`bailian_kb.py`）→ 百炼智能体应用 → 直接调大模型（DashScope/DeepSeek 的 OpenAI 兼容接口）。接入地址有「专属域名→公共域名」候选链，连接层失败自动换址；超时预算按 `AI_REQUEST_TIMEOUT` 统一。异步重活走 `ai_task_manager.py`（超并发上限统一 429）。`skill_engine.py` 按场景把 `backend/skills/`（core + domain 的 `*.skill.md`，YAML 前件 + Markdown 正文）注入提示词，加载失败必须静默降级不影响主流程；场景化提示词模板在 `backend/prompts/`，模型候选清单在 `model_catalog.py`。AI 出题生成图片走 `api/image_gen_service.py`（通义万相）。

### 题库单一写入口

**所有新题入库必须走 `backend/question_factory.py`**（normalize → validate → 查重 → 事务插入 → 连知识点边），不得再写裸 `INSERT INTO question_bank`。组卷/补题策略：题库优先 → 缺口 AI 补 → AI 题必须入库（`question_fill.py`、`question_select.py`、`paper_compose.py`）；Word 试卷导出在 `paper_generator.py`。

### 积分奖励单一真相

`backend/reward_engine.py` 的 `REWARD_CONFIG` 是积分规则的唯一来源，学生端/教师端规则弹窗一律读 `GET /api/rewards/rules` 下发，改分值只改这里。每日额度分三池（学术/课堂参与/轻量娱乐）。称号与徽章在 `title_system.py`。

### 实时链路

SSE 用于 AI 流式对话；WebSocket 三条独立链路——分组讨论 `ws_manager.py`、协作白板（tldraw）`whiteboard_ws.py`、抢答 `question_ws.py`。uvicorn 启动参数固定 `ws="websockets-sansio"` + 逐消息压缩，改动需谨慎。

### 前端结构

`src/pages/`（约 94 个页面，含 class-ladder 等大屏玩法）、`src/api/*.ts`（按域封装，共用 `client.ts` 的 axios 实例：令牌携带/滑动续期/401 广播 `auth:unauthorized` 事件统一登出）、`src/stores/`（9 个 Zustand store：auth/chat/companion/locale/news/portrait/theme/whiteboard/discovery）、`src/components/`、`src/i18n.ts`。窄屏适配规矩：**所有移动端 CSS 必须包在 `@media (max-width: 767px)` 内**（`src/styles/mobile.css`），明细表格在手机端一律用 `NarrowTable` 卡片化。

### 国际化

中英双语两侧都要做：前端翻译在 `frontend/public/locales/{zh-CN,en}/*.json`（按 namespace 分文件，经 i18next-http-backend 懒加载）；后端文案在 `backend/locales/{zh-CN,en}/`，用 `backend/i18n.py` 的 `T()` 按请求语言渲染（通知、401 消息等都走它）。

### 升级与版本

版本号三处对齐：`version.json`（在线升级权威源 + changelog）、`frontend/package.json`、README 徽章。Git 部署可站内增量升级（`api/upgrade_router.py`：fetch → reset → 迁移 → pip → 重启，失败回滚，启动时先对账未完成的升级）。`instance_guard.py` 检测多实例并存。

## 代码风格与惯例

- 后端注释、docstring、提交说明以**中文**为主，且大量注释记录了踩坑根因（为什么这么写），修改这些区域前先读注释，不要顺手"清理"。
- 启动自检/数据治理类函数一律**幂等 + 单项失败互不影响**。
- 新增 AI 功能：提示词进 `backend/prompts/`，需要行为增强的考虑写成 `backend/skills/` 技能文件而非硬编码。
- Markdown 文档规则见 `.markdownlint.json`（已放宽 MD013 行长等）。
