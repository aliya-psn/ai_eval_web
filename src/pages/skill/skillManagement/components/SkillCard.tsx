import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExportOutlined,
  GlobalOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { Button, Card, Checkbox, Space, Tag, Tooltip } from 'antd';
import { nameInitials, formatTime } from '@/components/page/PageShell';
import { parseBizTags, type SkillListItem } from '@/types/skill';

interface SkillCardProps {
  item: SkillListItem;
  selected?: boolean;
  onSelect?: (name: string) => void;
  onDetail: (name: string, namespaceId?: string) => void;
  onDelete?: (name: string) => void;
  /** market：只读浏览，不展示勾选/删除 */
  variant?: 'manage' | 'market';
  /** 当前空间，用于市场态标识跨空间 Skill */
  currentNamespaceId?: string;
}

export function SkillCard({
  item,
  selected = false,
  onSelect,
  onDetail,
  onDelete,
  variant = 'manage',
  currentNamespaceId,
}: SkillCardProps) {
  const latestVersion = item.labels?.latest;
  const bizTags = parseBizTags(item.bizTags).slice(0, 2);
  const isMarket = variant === 'market';
  const isCrossNamespace =
    isMarket &&
    Boolean(currentNamespaceId && item.namespaceId && item.namespaceId !== currentNamespaceId);

  return (
    <Card
      hoverable
      size="small"
      className={selected ? 'skill-mgmt-card skill-mgmt-card--selected' : 'skill-mgmt-card'}
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' },
      }}
      onClick={() => onDetail(item.name, item.namespaceId)}
    >
      <div style={{ padding: '14px 16px 8px', position: 'relative' }}>
        {!isMarket && onSelect ? (
          <div
            style={{ position: 'absolute', top: 10, right: 10, zIndex: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onChange={() => onSelect(item.name)}
            />
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            paddingRight: isMarket ? 0 : 28,
          }}
        >
          <div className="agent-detail-avatar" style={{ width: 40, height: 40, fontSize: 14, borderRadius: 10 }}>
            {nameInitials(item.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: '#091940',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.name}
              </div>
              {item.workspaceName ? (
                <Tag style={{ margin: 0, fontSize: 11, flexShrink: 0 }}>{item.workspaceName}</Tag>
              ) : null}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {item.scope ? (
                <span
                  style={{
                    fontSize: 11,
                    color: 'rgba(9,25,64,0.48)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  {item.scope === 'PUBLIC' ? <GlobalOutlined /> : <LockOutlined />}
                  {item.scope === 'PUBLIC' ? '公开' : '私有空间'}
                </span>
              ) : null}
              {isCrossNamespace ? (
                <Tag style={{ margin: 0, fontSize: 11 }}>其他空间</Tag>
              ) : null}
              {latestVersion ? (
                <span className="agent-version-pill">{latestVersion}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 10px', flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: 'rgba(9,25,64,0.48)',
            lineHeight: 1.55,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 26,
          }}
        >
          {item.description || '暂无描述'}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {bizTags.map((tag) => (
            <Tag key={tag} style={{ margin: 0, fontSize: 11 }}>
              {tag}
            </Tag>
          ))}
          <Tag
            color={(item.onlineCnt ?? 0) > 0 ? 'success' : 'default'}
            style={{ margin: 0, fontSize: 11 }}
          >
            <GlobalOutlined style={{ marginRight: 2 }} />
            {(item.onlineCnt ?? 0) > 0 ? `版本数： ${item.onlineCnt}` : '无版本'}
          </Tag>
          {item.editingVersion ? (
            <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>
              <EditOutlined style={{ marginRight: 2 }} />
              有草稿
            </Tag>
          ) : null}
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: 'rgba(9,25,64,0.45)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <DownloadOutlined />
            {item.downloadCount ?? 0}
          </span>
        </div>
      </div>

      <div
        style={{
          padding: '8px 12px 8px 16px',
          borderTop: '1px solid #f1f2f4',
          background: '#fafbfc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span style={{ fontSize: 11, color: 'rgba(9,25,64,0.45)' }}>
          {item.updateTime
            ? formatTime(new Date(item.updateTime).toISOString())
            : '-'}
        </span>
        <Space size={0}>
          <Tooltip title="详情">
            <Button
              type="text"
              size="small"
              icon={<ExportOutlined />}
              onClick={() => onDetail(item.name, item.namespaceId)}
            />
          </Tooltip>
          {!isMarket && onDelete ? (
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onDelete(item.name)}
              />
            </Tooltip>
          ) : null}
        </Space>
      </div>
    </Card>
  );
}
