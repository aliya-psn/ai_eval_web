# 本地调试指南

## 启动

```sh
yarn install
yarn dev
```

开发服务器运行在 `http://localhost:8000`。

## 架构说明

项目为**独立运行模式**（无微前端 / 无 qiankun）：

- 前端直连后端服务（testinfra-admin / Nacos / Langfuse / experiment-runner）
- 通过 webpack devServer proxy 代理跨域
- Nacos 免密登录：启动时用 `.env` 中的账号密码自动获取 token
- HTTP 调试、制品库上传均走浏览器直连（无服务端转发）

## 代理配置

webpack proxy 规则（`src/webpack.local.config.js`）：

| 路径前缀 | 代理目标 |
|---|---|
| `/api/admin` | testinfra-admin |
| `/repo` | 制品库 |
| `/v1/auth`、`/v3/auth` | Nacos auth |
| `/v1`、`/v2`、`/v3` | Nacos API |

## 环境变量

见 `.env` 文件，所有服务地址和凭据在此配置。

## 空间上下文

独立运行模式无基座注入空间信息，`namespace-store` 默认为空。
业务接口需要 namespaceId 时，从 URL 参数 `?namespaceId=xxx` 读取。

## Langfuse

- Public API 直连（axios）
- tRPC 调用（如删除数据集）直连 Langfuse，需 `.env` 配置 `LANGFUSE_EMAIL` / `LANGFUSE_PASSWORD`
- 项目名通过 `GET /api/public/projects` 运行时解析，按 `LANGFUSE_PROJECT_MAP` 密钥鉴权
