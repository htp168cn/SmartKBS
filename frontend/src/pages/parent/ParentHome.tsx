/** 家长端首页：孩子切换 + 概览卡片（积分/称号/错题/未读通知/最近考试） */
import React, { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Tag, Spin, Empty, Alert, Typography, Space } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  getParentOverview,
  type ParentOverview,
} from '../../api/parent'
import StudentSwitcher from './StudentSwitcher'
import { useBoundStudent } from './useBoundStudent'

const { Text } = Typography

const ParentHome: React.FC = () => {
  const { t } = useTranslation('parent')
  const { students, current, loading, select } = useBoundStudent()
  const [overview, setOverview] = useState<ParentOverview | null>(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!current) return
    let cancelled = false
    setFetching(true)
    setError('')
    getParentOverview(current.username)
      .then((data) => { if (!cancelled) setOverview(data) })
      .catch(() => { if (!cancelled) setError(t('loadFailed')) })
      .finally(() => { if (!cancelled) setFetching(false) })
    return () => { cancelled = true }
  }, [current, t])

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />

  // 没有任何绑定孩子：给出可读提示而非空白页
  if (!current) {
    return (
      <Empty
        style={{ marginTop: 80 }}
        description={t('noStudentBound')}
      />
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <StudentSwitcher students={students} current={current} onChange={select} />
      </div>

      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

      <Spin spinning={fetching}>
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={8}>
            <Card size="small">
              <Statistic title={t('totalPoints')} value={overview?.total_points ?? 0} suffix="分" />
              {overview?.title && (
                <Tag color="gold" style={{ marginTop: 4 }}>{`Lv.${overview.title.level} ${overview.title.name}`}</Tag>
              )}
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card size="small">
              <Statistic
                title={t('wrongPending')}
                value={overview?.wrong.pending ?? 0}
                valueStyle={{ color: '#cf1322' }}
              />
              <Text type="secondary">{t('mastered')}: {overview?.wrong.mastered ?? 0}</Text>
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card size="small">
              <Statistic
                title={t('unreadNotifications')}
                value={overview?.unread_notifications ?? 0}
                valueStyle={{ color: overview?.unread_notifications ? '#fa8c16' : undefined }}
              />
            </Card>
          </Col>
          <Col xs={24}>
            <Card size="small" title={t('latestExam')}>
              {overview?.latest_exam ? (
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Text strong>{overview.latest_exam.title}</Text>
                  <Space wrap>
                    <Tag>{overview.latest_exam.subject}</Tag>
                    <Text>
                      {overview.latest_exam.score} / {overview.latest_exam.total_score}
                    </Text>
                    <Text type="secondary">{overview.latest_exam.submitted_at}</Text>
                  </Space>
                </Space>
              ) : (
                <Text type="secondary">{t('noExamYet')}</Text>
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}

export default ParentHome
