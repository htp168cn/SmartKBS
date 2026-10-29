"""
家长端 API 路由（第四端，只读）

家长账号（role=3）由管理员创建并与学生绑定（student_guardians 表）后，
按 student_id 查询孩子的成绩、错题、考勤、通知与作业。
所有业务接口统一走 _bound_student() 校验：调用者必须是家长，且目标学生已绑定，
未绑定一律 403 —— 家长端不产生任何写操作。
"""
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Request

from backend.database import execute_query
from backend.question_db import execute_query as q_execute  # exam_attempts/exams 住在题库 questions.db
from backend.api.dependencies import get_current_user
from backend.api.tasks_router import get_all_tasks, get_user_relevant_tasks
from backend.api.wrong_book_router import _question_meta_map  # 复用错题题目详情查询

router = APIRouter()

ROLE_PARENT = 3  # 与 backend.auth.ROLE_PARENT 一致（此处直引避免环形依赖）


# ── 公共校验 ──

def _require_parent(request: Request) -> dict[str, Any]:
    """要求当前登录者是家长账号"""
    user = get_current_user(request)
    if user.get("role") != ROLE_PARENT:
        raise HTTPException(status_code=403, detail="权限不足：仅家长账号可访问家长端")
    return user


def _bound_student(request: Request, student_id: str) -> str:
    """校验当前家长与目标学生的绑定关系，返回规范化学号；未绑定 403"""
    user = _require_parent(request)
    sid = (student_id or "").strip()
    if not sid:
        raise HTTPException(status_code=400, detail="缺少 student_id")
    bound = execute_query(
        "SELECT 1 FROM student_guardians WHERE student_username=? AND guardian_username=?",
        (sid, user.get("username", "")),
    )
    if not bound:
        raise HTTPException(status_code=403, detail="该学生未与当前家长绑定")
    student = execute_query("SELECT 1 FROM users WHERE username=? AND role=2", (sid,))
    if not student:
        raise HTTPException(status_code=404, detail="学生账号不存在")
    return sid


def _student_base(sid: str) -> dict[str, Any]:
    """学生基础信息（姓名/年级/班级）"""
    rows = execute_query(
        "SELECT username, IFNULL(name,''), IFNULL(grade,''), IFNULL(class,'') FROM users WHERE username=?",
        (sid,),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="学生账号不存在")
    r = rows[0]
    return {"username": r[0], "name": r[1], "grade": r[2], "class_name": r[3]}


# ── 绑定学生列表 ──

@router.get("/students", summary="家长已绑定的孩子列表")
async def list_bound_students(request: Request):
    user = _require_parent(request)
    rows = execute_query(
        """SELECT u.username, IFNULL(u.name,''), IFNULL(u.grade,''), IFNULL(u.class,''), IFNULL(sg.relation,'')
           FROM student_guardians sg
           JOIN users u ON u.username = sg.student_username
           WHERE sg.guardian_username = ?
           ORDER BY sg.id""",
        (user.get("username", ""),),
    )
    return {"students": [
        {"username": r[0], "name": r[1], "grade": r[2], "class_name": r[3], "relation": r[4]}
        for r in rows
    ]}


# ── 首页概览（聚合卡片数据） ──

@router.get("/overview", summary="孩子首页概览")
async def get_overview(request: Request, student_id: str = Query(..., description="学生学号")):
    sid = _bound_student(request, student_id)
    student = _student_base(sid)

    # 积分与称号
    pts_rows = execute_query(
        "SELECT total_points FROM student_total_points WHERE student_username=?", (sid,))
    total_points = pts_rows[0][0] if pts_rows else 0
    title_rows = execute_query(
        "SELECT title_level, title_name FROM student_titles WHERE student_username=?", (sid,))

    # 错题统计（待掌握 / 已掌握）
    wrong_rows = execute_query(
        """SELECT
             SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),
             SUM(CASE WHEN status='mastered' THEN 1 ELSE 0 END)
           FROM wrong_book WHERE student_username=?""",
        (sid,),
    )
    pending_wrong = int(wrong_rows[0][0] or 0) if wrong_rows else 0
    mastered_wrong = int(wrong_rows[0][1] or 0) if wrong_rows else 0

    # 未读通知
    unread_rows = execute_query(
        "SELECT COUNT(*) FROM notifications WHERE recipient_username=? AND is_read=0", (sid,))
    unread_count = unread_rows[0][0] if unread_rows else 0

    # 最近一次考试成绩（exams/exam_attempts 在 questions.db，须走题库连接）
    exam_rows = q_execute(
        """SELECT IFNULL(e.title,''), IFNULL(e.subject,''), ea.score, ea.total_score,
                  ea.teacher_score, ea.submitted_at
           FROM exam_attempts ea LEFT JOIN exams e ON e.id = ea.exam_id
           WHERE ea.student_username=? AND ea.submitted_at IS NOT NULL
           ORDER BY ea.submitted_at DESC LIMIT 1""",
        (sid,),
    )
    latest_exam: Optional[dict[str, Any]] = None
    if exam_rows:
        r = exam_rows[0]
        score = float(r["score"] or 0)
        # 教师复核分优先（-1 表示未调整）
        if r["teacher_score"] is not None and float(r["teacher_score"]) >= 0:
            score = float(r["teacher_score"])
        latest_exam = {
            "title": r["title"], "subject": r["subject"], "score": score,
            "total_score": float(r["total_score"] or 0), "submitted_at": r["submitted_at"],
        }

    return {
        "student": student,
        "total_points": total_points,
        "title": {"level": title_rows[0][0], "name": title_rows[0][1]} if title_rows else None,
        "wrong": {"pending": pending_wrong, "mastered": mastered_wrong},
        "unread_notifications": unread_count,
        "latest_exam": latest_exam,
    }


# ── 考试成绩 ──

@router.get("/scores", summary="孩子近期考试成绩")
async def get_scores(request: Request, student_id: str = Query(..., description="学生学号")):
    sid = _bound_student(request, student_id)
    rows = q_execute(
        """SELECT ea.id, ea.exam_id, IFNULL(e.title,''), IFNULL(e.subject,''),
                  ea.submitted_at, ea.score, ea.total_score, ea.teacher_score,
                  IFNULL(ea.teacher_comment,''), ea.status
           FROM exam_attempts ea LEFT JOIN exams e ON e.id = ea.exam_id
           WHERE ea.student_username=? AND ea.submitted_at IS NOT NULL
           ORDER BY ea.submitted_at DESC LIMIT 20""",
        (sid,),
    )
    scores = []
    for r in rows:
        final = float(r["score"] or 0)
        if r["teacher_score"] is not None and float(r["teacher_score"]) >= 0:
            final = float(r["teacher_score"])  # 教师复核分覆盖 AI 分
        scores.append({
            "attempt_id": r["id"], "exam_id": r["exam_id"], "title": r["title"], "subject": r["subject"],
            "submitted_at": r["submitted_at"], "score": final, "total_score": float(r["total_score"] or 0),
            "comment": r["teacher_comment"], "status": r["status"],
        })

    pts_rows = execute_query(
        "SELECT total_points FROM student_total_points WHERE student_username=?", (sid,))
    return {
        "exams": scores,
        "total_points": pts_rows[0][0] if pts_rows else 0,
    }


# ── 错题本 ──

@router.get("/wrong-book", summary="孩子错题本（待掌握为主）")
async def get_wrong_book(
    request: Request,
    student_id: str = Query(..., description="学生学号"),
    status: str = Query("pending", description="pending=待掌握 mastered=已掌握 all=全部"),
):
    sid = _bound_student(request, student_id)
    if status not in ("pending", "mastered", "all"):
        status = "pending"

    count_rows = execute_query(
        """SELECT
             SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),
             SUM(CASE WHEN status='mastered' THEN 1 ELSE 0 END)
           FROM wrong_book WHERE student_username=?""",
        (sid,),
    )
    pending_total = int(count_rows[0][0] or 0) if count_rows else 0
    mastered_total = int(count_rows[0][1] or 0) if count_rows else 0

    rows = execute_query(
        """SELECT id, question_id, question_type, knowledge_points, wrong_answer,
                  wrong_count, status, last_wrong_at, created_at
           FROM wrong_book
           WHERE student_username=? AND (?='all' OR status=?)
           ORDER BY COALESCE(last_wrong_at, created_at) DESC
           LIMIT 50""",
        (sid, status, status),
    ) or []
    # 复用错题本的题目详情查询（题干/选项/正确答案）
    meta = _question_meta_map([r[1] for r in rows])
    items = []
    for r in rows:
        q = meta.get(r[1], {})
        items.append({
            "wrong_book_id": r[0],
            "question_id": str(r[1]),
            "question_text": q.get("question_text") or f"(题目ID:{r[1]})",
            "question_type": r[2] or q.get("type") or "",
            "knowledge_points": r[3] or q.get("knowledge_points") or "",
            "student_answer": r[4] or "",
            "correct_answer": q.get("correct_answer", "") or "",
            "wrong_count": r[5] or 1,
            "status": r[6],
            "updated_at": r[7] or r[8],
        })
    return {
        "pending_total": pending_total,
        "mastered_total": mastered_total,
        "items": items,
    }


# ── 点名考勤 ──

@router.get("/attendance", summary="孩子近期点名考勤记录")
async def get_attendance(request: Request, student_id: str = Query(..., description="学生学号")):
    sid = _bound_student(request, student_id)
    student = _student_base(sid)
    # 优先按学号记账；老数据未回填学号时按 年级+班级+姓名 兜底
    rows = execute_query(
        """SELECT result, points, created_at, teacher_username
           FROM rollcall_history
           WHERE student_username = ?
              OR (IFNULL(student_username,'')='' AND student_name=? AND grade=? AND class_name=?)
           ORDER BY created_at DESC LIMIT 50""",
        (sid, student["name"], student["grade"], student["class_name"]),
    ) or []
    summary: dict[str, int] = {}
    for r in rows:
        key = (r[0] or "未知").strip() or "未知"
        summary[key] = summary.get(key, 0) + 1
    return {
        "records": [
            {"result": r[0] or "", "points": r[1] or 0, "created_at": r[2] or "",
             "teacher_username": r[3] or ""}
            for r in rows
        ],
        "summary": summary,
    }


# ── 通知公告 ──

@router.get("/notifications", summary="孩子收到的通知")
async def get_notifications(
    request: Request,
    student_id: str = Query(..., description="学生学号"),
    limit: int = Query(50, ge=1, le=100),
):
    sid = _bound_student(request, student_id)
    unread_rows = execute_query(
        "SELECT COUNT(*) FROM notifications WHERE recipient_username=? AND is_read=0", (sid,))
    rows = execute_query(
        """SELECT id, type, title, content, related_link, is_read, created_at
           FROM notifications WHERE recipient_username=?
           ORDER BY created_at DESC LIMIT ?""",
        (sid, limit),
    ) or []
    return {
        "unread_count": unread_rows[0][0] if unread_rows else 0,
        "items": [
            {"id": r[0], "type": r[1] or "info", "title": r[2] or "", "content": r[3] or "",
             "related_link": r[4] or "", "is_read": bool(r[5]), "created_at": r[6] or ""}
            for r in rows
        ],
    }


# ── 作业完成情况 ──

@router.get("/homework", summary="孩子相关作业与完成情况")
async def get_homework(request: Request, student_id: str = Query(..., description="学生学号")):
    sid = _bound_student(request, student_id)

    # 复用学生端的作业可见性逻辑（按目标范围过滤，只含发给这个孩子的作业）
    relevant = get_user_relevant_tasks(sid, get_all_tasks())

    sub_rows = execute_query(
        "SELECT task_id, submitted_at FROM task_submissions WHERE student_username=?", (sid,))
    sub_map = {r[0]: r[1] for r in sub_rows}

    grade_rows = execute_query(
        """SELECT task_id, ai_score, IFNULL(ai_comment,''),
                  teacher_score, IFNULL(teacher_comment,'')
           FROM task_grades WHERE student_username=?""", (sid,))
    grade_map = {r[0]: r for r in grade_rows}

    items = []
    for t in relevant:
        tid = t["id"]
        published = (t.get("publish_status") or "draft") == "published"
        g = grade_map.get(tid)
        score = None
        comment = ""
        if published and g:
            # 教师改分优先（NULL 表示未改）
            if g[3] is not None:
                score = float(g[3])
                comment = g[4] or ""
            elif g[1] is not None:
                score = float(g[1])
                comment = g[2] or ""
        items.append({
            "id": tid,
            "name": t.get("name") or "",
            "subject": t.get("subject") or "",
            "creator": t.get("creator") or "",
            "created_time": t.get("created_time") or "",
            "deadline_at": t.get("deadline_at") or "",
            "submit_mode": t.get("submit_mode") or "conversation",
            "total_score": t.get("total_score") or 100,
            "publish_status": t.get("publish_status") or "draft",
            "submitted": tid in sub_map,
            "submitted_at": sub_map.get(tid) or "",
            "score": score,
            "comment": comment,
        })
    return {"tasks": items, "total": len(items)}
