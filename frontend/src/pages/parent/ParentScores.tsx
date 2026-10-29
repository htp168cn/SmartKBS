/** 家长端：考试成绩列表（近 20 场）+ 总积分 */
import React, { useEffect, useState } from 'react'
import { Card, List, Tag, Spin, Empty, Alert, Typography, Space, Row, Col, Statistic } from 'antd'
import { useTranslation } from 'react-i18next'
import { getParentScores, type ParentScoreItem } from '../../api/parent'
import StudentSwitcher from './StudentSwitcher'
import { useBoundStudent } from './useBoundStudent'

const { Text } = Typography

const ParentScores: React.FC = () => {
  const { t } = useTranslation('parent')
  const { students, current, loading, select } = useBoundStudent()
  const [exams, setExams] = useState<ParentScoreItem[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!current) return
    let cancelled = false
    setFetching(true)
    setError('')
    getParentScores(current.username)
      .then((data) => {
        if (cancelled) return
        setExams(data.exams)
        setTotalPoints(data.total_points)
      })
      .catch(() => { if (!cancelled) setError(t('loadFailed')) })
      .finally(() => { if (!cancelled) setFetching(false) })
    return () => { cancelled = true }
  }, [current, t])

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  if (!current) return <Empty style={{ marginTop: 80 }} description={t('noStudentBound')} />

  // 得分率着色：>=80% 绿、60%~80% 橙、其余红
  const rateColor = (score: number, total: number) => {
    if (total <= 0) return undefined
    const rate = score / total
    return rate >= 0.8 ? '#3f8600' : rate >= 0.6 ? '#d46b08' : '#cf1322'
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <StudentSwitcher students={students} current={current} onChange={select} />
      </div>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={12}><Statistic title={t('totalPoints')} value={totalPoints} suffix="分" /></Col>
          <Col xs={12}><Statistic title={t('examCount')} value={exams.length} suffix="场" /></Col>
        </Row>
      </Card>

      <Spin spinning={fetching}>
        <Card size="small">
          <List
            dataSource={exams}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noExamYet')} /> }}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Text strong>{item.title}</Text>
                      <Tag>{item.subject}</Tag>
                      <Tag color={item.status === 'graded' ? 'green' : 'blue'}>
                        {item.status === 'graded' ? t('graded') : t('submitted')}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space wrap>
                      <Text style={{ color: rateColor(item.score, item.total_score), fontWeight: 600 }}>
                        {item.score} / {item.total_score}
                      </Text>
                      <Text type="secondary">{item.submitted_at}</Text>
                      {item.comment && <Text type="secondary">“{item.comment}”</Text>}
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

export default ParentScores
