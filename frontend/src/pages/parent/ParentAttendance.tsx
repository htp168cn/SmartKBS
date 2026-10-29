/** 家长端：考勤记录（课堂点名）+ 汇总统计 */
import React, { useEffect, useState } from 'react'
import { Card, List, Tag, Spin, Empty, Alert, Typography, Space, Row, Col, Statistic } from 'antd'
import { useTranslation } from 'react-i18next'
import { getParentAttendance, type AttendanceRecord } from '../../api/parent'
import StudentSwitcher from './StudentSwitcher'
import { useBoundStudent } from './useBoundStudent'

const { Text } = Typography

/** 点名结果 → 标签颜色（与教师端点名管理保持一致：correct/incorrect/skip） */
const RESULT_COLOR: Record<string, string> = {
  correct: 'green',
  incorrect: 'red',
  skip: 'orange',
  win: 'green',
  pending: 'default',
}

const ParentAttendance: React.FC = () => {
  const { t } = useTranslation('parent')
  const { students, current, loading, select } = useBoundStudent()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!current) return
    let cancelled = false
    setFetching(true)
    setError('')
    getParentAttendance(current.username)
      .then((data) => {
        if (cancelled) return
        setRecords(data.records)
        setSummary(data.summary)
      })
      .catch(() => { if (!cancelled) setError(t('loadFailed')) })
      .finally(() => { if (!cancelled) setFetching(false) })
    return () => { cancelled = true }
  }, [current, t])

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  if (!current) return <Empty style={{ marginTop: 80 }} description={t('noStudentBound')} />

  // 汇总 key → 展示文案（后端返回原始 result 值，未识别的原样展示）
  const summaryLabel = (key: string) => {
    const map: Record<string, string> = {
      correct: t('resultCorrect'),
      incorrect: t('resultIncorrect'),
      skip: t('resultSkip'),
      win: t('resultWin'),
      pending: t('resultPending'),
    }
    return map[key] || key
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <StudentSwitcher students={students} current={current} onChange={select} />
      </div>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          {Object.entries(summary).map(([key, count]) => (
            <Col xs={12} sm={6} key={key}>
              <Statistic
                title={summaryLabel(key)}
                value={count}
                valueStyle={{ color: RESULT_COLOR[key] === 'red' ? '#cf1322' : undefined }}
              />
            </Col>
          ))}
          {Object.keys(summary).length === 0 && (
            <Col xs={24}><Text type="secondary">{t('noAttendanceYet')}</Text></Col>
          )}
        </Row>
      </Card>

      <Spin spinning={fetching}>
        <Card size="small">
          <List
            dataSource={records}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noAttendanceYet')} /> }}
            renderItem={(item) => (
              <List.Item>
                <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space wrap>
                    <Tag color={RESULT_COLOR[item.result] || 'default'}>
                      {summaryLabel(item.result)}
                    </Tag>
                    <Text type="secondary">{item.teacher_username}</Text>
                  </Space>
                  <Space wrap>
                    {item.points !== 0 && (
                      <Text style={{ color: item.points > 0 ? '#3f8600' : '#cf1322' }}>
                        {item.points > 0 ? `+${item.points}` : item.points} 分
                      </Text>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.created_at}</Text>
                  </Space>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </Spin>
    </div>
  )
}

export default ParentAttendance
