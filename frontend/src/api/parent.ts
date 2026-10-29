/** 家长端 API（第四端，只读）：所有查询都带 student_id，由后端校验家长-学生绑定关系 */
import apiClient from './client'

/** 家长绑定的孩子 */
export interface BoundStudent {
  username: string
  name: string
  grade: string
  class_name: string
  relation: string
}

/** 首页概览 */
export interface ParentOverview {
  student: { username: string; name: string; grade: string; class_name: string }
  total_points: number
  title: { level: number; name: string } | null
  wrong: { pending: number; mastered: number }
  unread_notifications: number
  latest_exam: {
    title: string
    subject: string
    score: number
    total_score: number
    submitted_at: string
  } | null
}

/** 考试成绩条目 */
export interface ParentScoreItem {
  attempt_id: number
  exam_id: number
  title: string
  subject: string
  submitted_at: string
  score: number
  total_score: number
  comment: string
  status: string
}

/** 错题条目 */
export interface WrongBookItem {
  wrong_book_id: number
  question_id: string
  question_text: string
  question_type: string
  knowledge_points: string
  student_answer: string
  correct_answer: string
  wrong_count: number
  status: string
  updated_at: string
}

/** 点名考勤记录 */
export interface AttendanceRecord {
  result: string
  points: number
  created_at: string
  teacher_username: string
}

/** 通知条目（家长视角） */
export interface ParentNotificationItem {
  id: number
  type: string
  title: string
  content: string
  related_link: string
  is_read: boolean
  created_at: string
}

/** 作业完成情况条目 */
export interface HomeworkItem {
  id: string
  name: string
  subject: string
  creator: string
  created_time: string
  deadline_at: string
  submit_mode: string
  total_score: number
  publish_status: string
  submitted: boolean
  submitted_at: string
  score: number | null
  comment: string
}

/** 家长已绑定的孩子列表 */
export async function getParentStudents(): Promise<BoundStudent[]> {
  const { data } = await apiClient.get('/api/parent/students')
  return data.students
}

/** 孩子首页概览 */
export async function getParentOverview(studentId: string): Promise<ParentOverview> {
  const { data } = await apiClient.get('/api/parent/overview', { params: { student_id: studentId } })
  return data
}

/** 孩子近期考试成绩 */
export async function getParentScores(studentId: string): Promise<{ exams: ParentScoreItem[]; total_points: number }> {
  const { data } = await apiClient.get('/api/parent/scores', { params: { student_id: studentId } })
  return data
}

/** 孩子错题本 */
export async function getParentWrongBook(
  studentId: string,
  status: 'pending' | 'mastered' | 'all' = 'pending',
): Promise<{ pending_total: number; mastered_total: number; items: WrongBookItem[] }> {
  const { data } = await apiClient.get('/api/parent/wrong-book', {
    params: { student_id: studentId, status },
  })
  return data
}

/** 孩子点名考勤 */
export async function getParentAttendance(
  studentId: string,
): Promise<{ records: AttendanceRecord[]; summary: Record<string, number> }> {
  const { data } = await apiClient.get('/api/parent/attendance', { params: { student_id: studentId } })
  return data
}

/** 孩子收到的通知 */
export async function getParentNotifications(
  studentId: string,
): Promise<{ unread_count: number; items: ParentNotificationItem[] }> {
  const { data } = await apiClient.get('/api/parent/notifications', { params: { student_id: studentId } })
  return data
}

/** 孩子作业与完成情况 */
export async function getParentHomework(studentId: string): Promise<{ tasks: HomeworkItem[]; total: number }> {
  const { data } = await apiClient.get('/api/parent/homework', { params: { student_id: studentId } })
  return data
}
