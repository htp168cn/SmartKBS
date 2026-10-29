"""
V8.9.1 家长端迁移脚本：创建家长-学生绑定表 student_guardians

幂等（CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS），
与 backend/database.py init_db() 中的建表语句保持一致，两条路径均可安全执行。
"""
from backend.database import get_connection
from backend.logger import logger


def migrate():
    """家长端迁移：确保 student_guardians 绑定表与索引存在"""
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS student_guardians (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                guardian_username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                relation TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(student_username, guardian_username)
            )
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_sg_guardian ON student_guardians(guardian_username)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_sg_student ON student_guardians(student_username)")
    logger.info("家长端迁移完成：student_guardians 表已就绪")
