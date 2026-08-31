interface ImportMetaEnv {
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
declare module '*.less';
declare module '*.scss';

interface Worker {
  new (url: string | URL): Worker;
}

interface Module {
  hot?: {
    accept: (path?: string | string[], callback?: () => void) => void;
    dispose: (callback?: () => void) => void;
  };
}

declare const module: Module;

declare let __webpack_public_path__: string;



declare namespace NodeJS {
  interface ProcessEnv {
    /** testinfra-experiment-runner 真实服务地址 */
    EXPERIMENT_RUNNER_API_BASE?: string;
    /** admin 网关 Server-Type：gateway-test | gateway */
    ADMIN_SERVER_TYPE?: string;
    /** Langfuse 服务地址 */
    LANGFUSE_BASE_URL?: string;
    /**
     * DevOps 空间 key → Langfuse 项目密钥映射（JSON 字符串）
     * 例：{"ceshikongjian":{"publicKey":"pk-lf-...","secretKey":"sk-lf-..."}}
     * 项目名运行时通过 GET /api/public/projects 解析，勿在此写死
     */
    LANGFUSE_PROJECT_MAP?: string;
    /**
     * Langfuse 登录邮箱（tRPC，langfuse 鉴权使用）
     */
    LANGFUSE_EMAIL?: string;
    /** Langfuse 登录密码（tRPC） */
    LANGFUSE_PASSWORD?: string;
    /**
     * 制品库上传配置 JSON
     * {"baseUrl":"http://192.168.182.47:8000","repo":"testinfra-test","username":"","password":"","pathPrefix":""}
     */
    UPLOAD_REPO?: string;
  }
}
