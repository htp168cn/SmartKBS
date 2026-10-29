# ACCEPTANCE 家长端二次开发（第四端）

分支：`dev/2026-10-29`（本地，未推送）｜计划：[家长端二次开发计划.md](./家长端二次开发计划.md)

## 任务完成情况（12/12）

| 任务 | 状态 | 说明 |
|---|---|---|
| A1 ROLE_PARENT 常量 | ✅ | backend/auth.py，role=3 |
| A2 登录映射 3→parent | ✅ | auth_router.py |
| A3 student_guardians 迁移 | ✅ | migrations/V8_9_1.py + 索引 |
| A4 绑定管理接口 | ✅ | users_router：绑定/解绑/列表（仅管理员） |
| A5 parent_router 六接口 | ✅ | students/overview/scores/wrong-book/attendance/notifications/homework |
| B1 前端类型与 api/parent.ts | ✅ | |
| B2 App.tsx 家长路由 | ✅ | /parent 六路由 + 未绑定兜底 |
| B3 六个家长页面 | ✅ | pages/parent/，含 useBoundStudent、StudentSwitcher |
| B4 AppLayout 菜单 | ✅ | parentMenu + PARENT_ALLOWED 白名单 + PARENT_TABS |
| B5 登录页跳转 | ✅ | parent → /parent |
| C README 同步 | ✅ | 特性表、用户管理、家长端小节 |
| V 验收 | ✅ | 见下 |

## 验收证据

1. **静态检查**：新文件 `npx eslint` 零报错；`npx vite build` 通过（3.61s）。
2. **接口联调**（/tmp/parent_e2e.py，Python urllib e2e）：**24/24 PASS**，覆盖登录、建家长号、绑定、六接口数据、越权 403（家长访问未绑定学生、家长调绑定接口、家长访问用户管理、学生访问家长接口）、422、解绑 403、重复解绑 404。
3. **浏览器验收**：家长登录 → /parent 六页全 PASS，console 无 /api/parent 错误；学生、管理员回归 PASS。
4. **窄屏 375×640**（CDP 仿真）：无 DesktopOnlyGuide 拦截，底部 TabBar = [孩子概览, 考试成绩, 作业情况, 通知消息, 菜单]，孩子切换器正常，截图 /tmp/parent_375.png 观感正常。

## 验收标准核对

- [x] 家长可登录并进入独立第四端（六页面）
- [x] 一个家长可绑多个孩子，前端可切换（持久化当前选择）
- [x] 家长端纯只读：全部 /api/parent/* 经角色 + 绑定双重校验，未绑定 403
- [x] 越权收口：家长调 /api/users 列表/导出 403（原漏洞已修）
- [x] 管理员/教师/学生三端行为无回归
- [x] 移动优先：手机白名单 + 底部 Tab；桌面侧边栏菜单
- [x] README 文档同步
