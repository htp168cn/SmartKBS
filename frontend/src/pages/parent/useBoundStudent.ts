/** 家长端共享：绑定孩子列表 + 当前选中孩子（跨页面记忆） */
import { useEffect, useState } from 'react'
import { getParentStudents, type BoundStudent } from '../../api/parent'

const STORAGE_KEY = 'smartkb_parent_current_student'

export interface BoundStudentState {
  students: BoundStudent[]
  current: BoundStudent | null
  loading: boolean
  /** 切换当前查看的孩子 */
  select: (username: string) => void
}

export function useBoundStudent(): BoundStudentState {
  const [students, setStudents] = useState<BoundStudent[]>([])
  const [current, setCurrent] = useState<BoundStudent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getParentStudents()
      .then((list) => {
        if (cancelled) return
        setStudents(list)
        // 恢复上次选中的孩子，没有则默认第一个
        const saved = localStorage.getItem(STORAGE_KEY)
        const found = list.find((s) => s.username === saved) ?? list[0] ?? null
        setCurrent(found)
      })
      .catch(() => {
        if (!cancelled) setCurrent(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const select = (username: string) => {
    const target = students.find((s) => s.username === username)
    if (!target) return
    localStorage.setItem(STORAGE_KEY, username)
    setCurrent(target)
  }

  return { students, current, loading, select }
}
