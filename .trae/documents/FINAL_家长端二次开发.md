# FINAL 家长端二次开发（第四端）总结报告

分支：`dev/2026-10-29`（本地未推送）｜v8.9.0 基线二开

## 交付内容

在既有 管理员/教师/学生 三端之上新增 **家长端（role=3）**，Web 手机优先响应式，纯只读。

### 后端（FastAPI，裸 SQL 双库）
- **角色**：[backend/auth.py](file:///workspace/backend/auth.py) `ROLE_PARENT=3`；登录返回 `parent`（auth_router.py 映射）。
- **绑定表**：`student_guardians(student_username, guardian_username, relation)`，迁移 [migrations/V8_9_1.py](file:///workspace/backend/migrations/V8_9_1.py)，一多家长可绑多孩子。
- **绑定管理**：仅管理员在 users_router 绑定/解绑/查列表；家长不可自助绑定。
- **家长接口**：[backend/api/parent_router.py](file:///workspace/backend/api/parent_router.py) 七个只读端点，统一 `_require_parent` + `_bound_student` 双校验，未绑定一律 403。考试数据走 `question_db`（questions.db），积分/错题/点名/通知走主库。
- **权限收口**：users_router 用户列表/导出改为 `role not in (0,1)` 拦截（修复家长越权）。

### 前端（React 19 + antd 6）
- 路由 `/parent` 六页：概览、考试成绩、错题本、考勤、通知、作业（[pages/parent/](file:///workspace/frontend/src/pages/parent/)）。
- `useBoundStudent` 共享 hook + `StudentSwitcher` 多孩子切换（localStorage 记住当前选择）。
- AppLayout parentMenu 侧边栏、`MobileTabBar` 四 Tab、`mobileNav.ts` 家长白名单、登录页 parent 跳转。
- i18n：新增 `parent` 命名空间与 `menu.parentMenu`（zh-CN/en）。

### 文档
- README：特性表、四角色说明、家长端小节（页面路径 + 安全边界）。

## 验证结论
lint（新文件零报错）、vite build、接口联调 24/24、越权用例全拦截、三端浏览器回归、375 窄屏 —— 全部通过。详见 [ACCEPTANCE_家长端二次开发.md](./ACCEPTANCE_家长端二次开发.md)。

## 关键实现备注
- 双库陷阱：`exams/exam_attempts` 在 `questions.db`，必须用 `backend.question_db.execute_query`（字典行）；主库返回元组行。
- 登录字段是 `username_or_name`；注册 `POST /api/users/register` role 传数字 3。
- 点名 result 实际取值 correct/incorrect/skip/win/pending（非 present/absent）。
- attempt 状态实际为 submitted/graded（非 published）。

## 遗留
见 [TODO_家长端二次开发.md](./TODO_家长端二次开发.md)。
