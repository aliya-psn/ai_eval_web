import { useEffect, useState } from 'react';

export interface CurrentUser {
  objectId?: string;
  id?: string;
  username?: string;
  nickname?: string;
  sessionToken?: string;
  deleted?: boolean;
  enabled?: boolean;
  [key: string]: unknown;
}

/** 默认用户 */
const DEFAULT_USER: CurrentUser = { username: 'admin', nickname: 'admin' };

/**
 * 获取当前用户：默认返回 admin。
 */
export function getCurrentUserFromHost(): CurrentUser | null {
  return { ...DEFAULT_USER };
}

/** 展示名：有 nickname 时为「昵称(username)」，否则 username */
export function generateUserDisplayName(
  user?: CurrentUser | null,
  onlyNickname = false,
): string {
  if (!user) return '';
  const username = user.username || '';
  if (onlyNickname) return user.nickname || username;
  if (user.nickname) return `${user.nickname}(${username})`;
  return username;
}

/**
 * 获取当前登录用户。
 */
export function useCurrentUser(): { data: CurrentUser | null; loading: boolean } {
  const [data, setData] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(getCurrentUserFromHost());
    setLoading(false);
  }, []);

  return { data, loading };
}
