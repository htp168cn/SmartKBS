/** 家长端：错题本（待掌握/已掌握切换，只读） */
import React, { useEffect, useState } from 'react'
import { Card, List, Tag, Spin, Empty, Alert, Typography, Space, Segmented, Statistic, Row, Col } from 'antd'
import { useTranslation } from 'react-i18next'
import { getParentWrongBook, type WrongBookItem } from '../../api/parent'
import StudentSwitcher from './StudentSwitcher'
import { useBoundStudent } from './useBoundStudent'

const { Text, Paragraph } = Typography

type StatusFilter = 'pending' | 'mastered' | 'all'

const ParentWrongBook: React.FC = () => {
  const { t } = useTranslation('parent')
  const { students, current, loading, select } = useBoundStudent()
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [items, setItems] = useState<WrongBookItem[]>([])
  const [pendingTotal, setPendingTotal] = useState(0)
  const [masteredTotal, setMasteredTotal] = useState(0)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!current) return
    let cancelled = false
    setFetching(true)
    setError('')
    getParentWrongBook(current.username, filter)
      .then((data) => {
        if (cancelled) return
        setItems(data.items)
        setPendingTotal(data.pending_total)
        setMasteredTotal(data.mastered_total)
      })
      .catch(() => { if (!cancelled) setError(t('loadFailed')) })
      .finally(() => { if (!cancelled) setFetching(false) })
    return () => { cancelled = true }
  }, [current, filter, t])

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  if (!current) return <Empty style={{ marginTop: 80 }} description={t('noStudentBound')} />

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <StudentSwitcher students={students} current={current} onChange={select} />
      </div>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col xs={12}>
            <Statistic title={t('wrongPending')} value={pendingTotal} valueStyle={{ color: '#cf1322' }} />
          </Col>
          <Col xs={12}>
            <Statistic title={t('mastered')} value={masteredTotal} valueStyle={{ color: '#3f8600' }} />
          </Col>
        </Row>
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v as StatusFilter)}
          options={[
            { label: t('filterPending'), value: 'pending' },
            { label: t('filterMastered'), value: 'mastered' },
            { label: t('filterAll'), value: 'all' },
          ]}
        />
      </Card>

      <Spin spinning={fetching}>
        <Card size="small">
          <List
            dataSource={items}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noWrongQuestions')} /> }}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Text strong>{item.question_text}</Text>
                      <Tag color={item.status === 'mastered' ? 'green' : 'red'}>
                        {item.status === 'mastered' ? t('mastered') : t('filterPending')}
                      </Tag>
                      <Tag>×{item.wrong_count}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      {item.knowledge_points && (
                        <Text type="secondary">{t('knowledgePoints')}: {item.knowledge_points}</Text>
                      )}
                      <Paragraph style={{ margin: 0 }}>
                        <Text type="secondary">{t('yourAnswer')}: </Text>
                        <Text delete style={{ color: '#cf1322' }}>{item.student_answer}</Text>
                        <Text type="secondary" style={{ marginLeft: 12 }}>{t('correctAnswer')}: </Text>
                        <Text style={{ color: '#3f8600' }}>{item.correct_answer}</Text>
                      </Paragraph>
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.updated_at}</Text>
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

export default ParentWrongBook
