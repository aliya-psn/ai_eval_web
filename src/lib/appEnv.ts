/**
 * 制品库上传配置（应用市场 env 里放一个 JSON）
 */
export type UploadRepoConfig = {
  baseUrl: string;
  /** 仓库名（对应 /repo/artifacts/tree/{repo}） */
  repo: string;
  username?: string;
  password?: string;
  /** 仓库内子目录前缀，如 skills；可为空 */
  pathPrefix?: string;
};

const SupportAppEnv = {
  /** testinfra-admin 服务地址 */
  ADMIN_API_BASE: {
    defaultValue: 'http://192.168.178.116:8080/testinfra-admin', //  'http://192.168.178.234:8086',
    transformer: (value: string) => value,
  },
  /** testinfra-experiment-runner 服务地址 */
  EXPERIMENT_RUNNER_API_BASE: {
    defaultValue: 'http://192.168.178.116:8080/testinfra-experiment-runner',
    transformer: (value: string) => value,
  },
  /** 网关 Server-Type：测试 gateway-test，生产 gateway */
  ADMIN_SERVER_TYPE: {
    defaultValue: 'gateway-test',
    transformer: (value: string) => value,
  },
  /** Langfuse 服务地址 */
  LANGFUSE_BASE_URL: {
    defaultValue: 'http://192.168.131.114:3000',
    transformer: (value: string) => value,
  },
  /** Langfuse 项目密钥映射（JSON：{ workspaceKey: { publicKey, secretKey } }） */
  LANGFUSE_PROJECT_MAP: {
    defaultValue: '{}',
    transformer: (value: string) => value,
  },
  /** Langfuse 登录邮箱（tRPC Session 鉴权） */
  LANGFUSE_EMAIL: {
    defaultValue: '',
    transformer: (value: string) => value,
  },
  /** Langfuse 登录密码（tRPC Session 鉴权） */
  LANGFUSE_PASSWORD: {
    defaultValue: '',
    transformer: (value: string) => value,
  },
  /**
   * 制品库上传配置（JSON 字符串或对象）
   */
  UPLOAD_REPO: {
    defaultValue: JSON.stringify({
      baseUrl: 'http://192.168.182.47:8000',
      repo: 'testinfra-test',
      username: '',
      password: '',
      pathPrefix: '',
    } satisfies UploadRepoConfig),
    transformer: (value: string) => value,
  },
} as const;

type AppEnvKey = keyof typeof SupportAppEnv;

/** 读取原始 env 值（可为对象，如注入的 JSON） */
function getRawAppEnv(key: string): unknown {
  let processEnvValue: unknown;
  try {
    processEnvValue = process.env?.[key];
  } catch {
    // 浏览器可能无 process
  }
  return processEnvValue;
}

/**
 * 获取应用环境变量（字符串）。
 * 优先级：process.env → 默认值
 */
export function getAppEnv<K extends AppEnvKey>(key: K): string {
  const raw = getRawAppEnv(key);
  const envConfig = SupportAppEnv[key];
  if (raw == null || raw === '') return envConfig.defaultValue;
  if (typeof raw === 'string') return envConfig.transformer(raw);
  // 对象类配置（如 map）不走字符串 transformer
  try {
    return JSON.stringify(raw);
  } catch {
    return envConfig.defaultValue;
  }
}

/** testinfra-admin API base */
export function getAdminApiBase(): string {
  return getAppEnv('ADMIN_API_BASE');
}

/** testinfra-experiment-runner API base */
export function getExperimentRunnerApiBase(): string {
  return getAppEnv('EXPERIMENT_RUNNER_API_BASE');
}

/** 网关 Server-Type */
export function getAdminServerType(): string {
  return getAppEnv('ADMIN_SERVER_TYPE');
}

/** Langfuse API base（去除末尾 /） */
export function getLangfuseBaseUrl(): string {
  return getAppEnv('LANGFUSE_BASE_URL').replace(/\/+$/, '');
}

/** Langfuse 项目密钥映射 */
export interface LangfuseProjectKey {
  publicKey: string;
  secretKey: string;
}

/** 解析 LANGFUSE_PROJECT_MAP，返回 workspaceKey → { publicKey, secretKey } */
export function getLangfuseProjectMap(): Record<string, LangfuseProjectKey> {
  const raw = getRawAppEnv('LANGFUSE_PROJECT_MAP');
  let parsed: unknown = raw;
  if (raw == null || raw === '') {
    return {};
  }
  if (typeof raw === 'object') {
    parsed = raw;
  } else if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed as Record<string, LangfuseProjectKey>;
}

/** 按空间 key 查 Langfuse API Key */
export function getLangfuseApiKey(workspaceKey: string): LangfuseProjectKey | undefined {
  const map = getLangfuseProjectMap();
  return map[workspaceKey];
}

/** Langfuse 登录邮箱 */
export function getLangfuseEmail(): string {
  return getAppEnv('LANGFUSE_EMAIL');
}

/** Langfuse 登录密码 */
export function getLangfusePassword(): string {
  return getAppEnv('LANGFUSE_PASSWORD');
}

const DEFAULT_UPLOAD_REPO: UploadRepoConfig = {
  baseUrl: 'http://192.168.182.47:8000',
  repo: 'testinfra-test',
  username: '',
  password: '',
  pathPrefix: '',
};

/** 解析 UPLOAD_REPO（支持对象或 JSON 字符串） */
export function getUploadRepoConfig(): UploadRepoConfig {
  const raw = getRawAppEnv('UPLOAD_REPO');
  let parsed: unknown = raw;
  if (raw == null || raw === '') {
    try {
      parsed = JSON.parse(SupportAppEnv.UPLOAD_REPO.defaultValue);
    } catch {
      return { ...DEFAULT_UPLOAD_REPO };
    }
  } else if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_UPLOAD_REPO };
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ...DEFAULT_UPLOAD_REPO };
  }

  const obj = parsed as Record<string, unknown>;
  const baseUrl =
    asNonEmptyString(obj.baseUrl) ||
    asNonEmptyString(obj.base_url) ||
    DEFAULT_UPLOAD_REPO.baseUrl;
  const repo =
    asNonEmptyString(obj.repo) ||
    asNonEmptyString(obj.repoName) ||
    asNonEmptyString(obj.project) ||
    DEFAULT_UPLOAD_REPO.repo;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    repo: repo.replace(/^\/+|\/+$/g, ''),
    username: asNonEmptyString(obj.username) || asNonEmptyString(obj.user) || '',
    password: asNonEmptyString(obj.password) || asNonEmptyString(obj.passwd) || '',
    pathPrefix: (asNonEmptyString(obj.pathPrefix) || asNonEmptyString(obj.path_prefix) || '')
      .replace(/^\/+|\/+$/g, ''),
  };
}

function asNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
