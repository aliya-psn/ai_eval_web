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

/**
 * 获取当前用户：从页面缓存（基座注入 / window.currentUser）读取。
 */
export function getCurrentUserFromHost(): CurrentUser | null {
  if (typeof window === 'undefined') return null;

  const cached = (window as unknown as { currentUser?: CurrentUser }).currentUser;
  if (cached?.username) {
    return { ...cached };
  }

  return null;
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
    const user = getCurrentUserFromHost();
    if (user) {
      (window as unknown as { currentUser?: CurrentUser }).currentUser = user;
    }
    setData(user);
    setLoading(false);
  }, []);

  return { data, loading };
}
