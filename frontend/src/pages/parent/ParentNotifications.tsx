/** 家长端：孩子收到的通知列表（只读，未读高亮） */
import React, { useEffect, useState } from 'react'
import { Card, List, Badge, Spin, Empty, Alert, Typography, Space, Statistic, Row, Col } from 'antd'
import { useTranslation } from 'react-i18next'
import { getParentNotifications, type ParentNotificationItem } from '../../api/parent'
import StudentSwitcher from './StudentSwitcher'
import { useBoundStudent } from './useBoundStudent'

const { Text, Paragraph } = Typography

const ParentNotifications: React.FC = () => {
  const { t } = useTranslation('parent')
  const { students, current, loading, select } = useBoundStudent()
  const [items, setItems] = useState<ParentNotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!current) return
    let cancelled = false
    setFetching(true)
    setError('')
    getParentNotifications(current.username)
      .then((data) => {
        if (cancelled) return
        setItems(data.items)
        setUnreadCount(data.unread_count)
      })
      .catch(() => { if (!cancelled) setError(t('loadFailed')) })
      .finally(() => { if (!cancelled) setFetching(false) })
    return () => { cancelled = true }
  }, [current, t])

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  if (!current) return <Empty style={{ marginTop: 80 }} description={t('noStudentBound')} />

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <StudentSwitcher students={students} current={current} onChange={select} />
      </div>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={12}>
            <Statistic
              title={t('unreadNotifications')}
              value={unreadCount}
              valueStyle={{ color: unreadCount ? '#fa8c16' : undefined }}
            />
          </Col>
          <Col xs={12}>
            <Statistic title={t('notificationTotal')} value={items.length} />
          </Col>
        </Row>
      </Card>

      <Spin spinning={fetching}>
        <Card size="small">
          <List
            dataSource={items}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noNotifications')} /> }}
            renderItem={(item) => (
              <List.Item style={item.is_read ? undefined : { background: 'rgba(250, 173, 20, 0.06)' }}>
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Badge status={item.is_read ? 'default' : 'processing'} />
                      <Text strong={!item.is_read}>{item.title}</Text>
                      {item.type && <Text type="secondary" style={{ fontSize: 12 }}>[{item.type}]</Text>}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Paragraph style={{ margin: 0 }}>{item.content}</Paragraph>
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.created_at}</Text>
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

export default ParentNotifications
