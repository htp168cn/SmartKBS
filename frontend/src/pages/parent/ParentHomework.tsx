/** 家长端：作业完成情况（只读：已交/得分/截止） */
import React, { useEffect, useState } from 'react'
import { Card, List, Tag, Spin, Empty, Alert, Typography, Space, Statistic, Row, Col } from 'antd'
import { useTranslation } from 'react-i18next'
import { getParentHomework, type HomeworkItem } from '../../api/parent'
import StudentSwitcher from './StudentSwitcher'
import { useBoundStudent } from './useBoundStudent'

const { Text } = Typography

const ParentHomework: React.FC = () => {
  const { t } = useTranslation('parent')
  const { students, current, loading, select } = useBoundStudent()
  const [tasks, setTasks] = useState<HomeworkItem[]>([])
  // 拉取数据时记录的"当前时间"，用于判定是否已截止（渲染期保持纯函数）
  const [fetchedAt, setFetchedAt] = useState(0)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!current) return
    let cancelled = false
    setFetching(true)
    setError('')
    getParentHomework(current.username)
      .then((data) => {
        if (cancelled) return
        setTasks(data.tasks)
        setFetchedAt(Date.now())
      })
      .catch(() => { if (!cancelled) setError(t('loadFailed')) })
      .finally(() => { if (!cancelled) setFetching(false) })
    return () => { cancelled = true }
  }, [current, t])

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  if (!current) return <Empty style={{ marginTop: 80 }} description={t('noStudentBound')} />

  const submittedCount = tasks.filter((x) => x.submitted).length
  const gradedCount = tasks.filter((x) => x.score !== null).length

  // 作业状态标签：已批改 > 已提交 > 已截止未交 > 待完成
  const statusTag = (task: HomeworkItem) => {
    if (task.score !== null) return <Tag color="green">{`${t('graded')} ${task.score}${task.total_score ? `/${task.total_score}` : ''}`}</Tag>
    if (task.submitted) return <Tag color="blue">{t('submitted')}</Tag>
    if (task.deadline_at && new Date(task.deadline_at).getTime() < fetchedAt) {
      return <Tag color="red">{t('overdue')}</Tag>
    }
    return <Tag color="orange">{t('todo')}</Tag>
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <StudentSwitcher students={students} current={current} onChange={select} />
      </div>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={8}><Statistic title={t('homeworkTotal')} value={tasks.length} /></Col>
          <Col xs={8}><Statistic title={t('submittedCount')} value={submittedCount} /></Col>
          <Col xs={8}><Statistic title={t('gradedCount')} value={gradedCount} /></Col>
        </Row>
      </Card>

      <Spin spinning={fetching}>
        <Card size="small">
          <List
            dataSource={tasks}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noHomework')} /> }}
            renderItem={(task) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Text strong>{task.name}</Text>
                      {task.subject && <Tag>{task.subject}</Tag>}
                      {statusTag(task)}
                    </Space>
                  }
                  description={
                    <Space wrap>
                      <Text type="secondary">{t('creator')}: {task.creator}</Text>
                      {task.deadline_at && (
                        <Text type="secondary">{t('deadline')}: {task.deadline_at}</Text>
                      )}
                      {task.submitted && task.submitted_at && (
                        <Text type="secondary">{t('submittedAt')}: {task.submitted_at}</Text>
                      )}
                      {task.comment && <Text type="secondary">“{task.comment}”</Text>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </Spin>
    </div>
  )
}

export default ParentHomework
