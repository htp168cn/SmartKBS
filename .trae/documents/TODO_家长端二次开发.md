# TODO 家长端二次开发 —— 待办与缺失配置

> 精简列出需要人工决策/支持的事项，按优先级排序。

## P0 缺失配置（需要你提供）

1. **JWT_SECRET_KEY 未配置**：当前用默认密钥，正式环境需在 `.env` 配置强随机值并重启（否则令牌可被伪造）。
2. **DASHSCOPE_API_KEY 未配置**：AI 功能（对话/判题）不可用，家长端只读功能不受影响。配置方式：`.env` 中 `DASHSCOPE_API_KEY=sk-xxx`。

## P1 代码提交（需要你确认）

3. **改动尚未 commit**：分支 `dev/2026-10-29` 本地未提交、未推送远程。是否需要我执行 git commit / push？

## P2 预存问题（非本次引入，建议知晓）

4. `requirements.txt` 两处预存问题：`latex2mathml>=3.80` 在 PyPI 不存在（需降级）；`cairosvg` 缺系统 cairo 库（需 `apt install libcairo2`）。当前环境已用可用版本安装，未改动该文件。
5. `tsc -b` 5 个预存 antd 6 类型错误（ResetActivityButton/AIPanel/main.tsx/CodePracticePage/HomeworkPanel），本次未改动这些文件；构建验证改用 `vite build`（通过）。
6. ESLint 全仓 193 个预存 problems（本次新文件零报错）。
7. 演示测试账号：空库时 README 账号 s11001 等不存在；联调创建了 `e2e_parent/123456`、`e2e_student/123456`，管理员 `root/root`（视初始配置而定）。正式演示需自行建号并在后台绑定。

## P3 明确排除（本次未做，避免误期待）

- 家长自助绑定/扫码、消息推送、IM 聊天、家长写操作 —— 按共识全部不做。
- 三端（管理员/教师/学生）行为零变更，仅做权限越权收口（家长访问用户列表/导出 → 403）。

## 操作指引

- 启动后端：`python3 -m backend.main`（端口 8086，reload）；前端：`npm run dev`（5173，代理 /api → 8086）。
- 家长账号创建：管理员后台 → 用户管理 → 角色选"家长"；绑定：同页绑定接口或 `PUT /api/users/{username}/guardians`。
- 家长登录后自动进入 `/parent`，多孩子通过顶部下拉切换。
