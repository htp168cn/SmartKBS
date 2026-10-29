/** 家长端共享组件：孩子切换器（多于一个绑定孩子时显示下拉，否则显示当前孩子信息） */
import React from 'react'
import { Select, Typography } from 'antd'
import type { BoundStudent } from '../../api/parent'

const { Text } = Typography

interface Props {
  students: BoundStudent[]
  current: BoundStudent | null
  onChange: (username: string) => void
}

const StudentSwitcher: React.FC<Props> = ({ students, current, onChange }) => {
  if (!current) return null

  // 只绑定一个孩子时无需切换，直接展示身份信息
  if (students.length <= 1) {
    return (
      <Text strong style={{ fontSize: 15 }}>
        {current.name}
        <Text type="secondary" style={{ fontWeight: 400, marginLeft: 8, fontSize: 13 }}>
          {current.grade} · {current.class_name}
          {current.relation ? ` · ${current.relation}` : ''}
        </Text>
      </Text>
    )
  }

  return (
    <Select
      value={current.username}
      onChange={onChange}
      style={{ minWidth: 180 }}
      options={students.map((s) => ({
        value: s.username,
        label: `${s.name}（${s.grade}·${s.class_name}）`,
      }))}
    />
  )
}

export default StudentSwitcher
