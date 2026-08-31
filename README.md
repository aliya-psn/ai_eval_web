# agent_manage

智能管理 AI 前端（Agent / Skill / Prompt / 数据集 / 评估器）。

## 技术栈

React 19 + TypeScript + Webpack 5 + Ant Design 6 + Tailwind CSS + Zustand

## 快速开始

```sh
# 安装依赖
yarn install

# 本地开发（独立模式，端口 8000）
yarn dev

# 生产构建
yarn build
```

## 环境变量

项目根目录 `.env` 文件配置：

| 变量 | 说明 |
|---|---|
| `ADMIN_API_BASE` | testinfra-admin 服务地址 |
| `NACOS_BASE_URL` | Nacos 服务地址 |
| `NACOS_AUTO_LOGIN_USERNAME` | Nacos 免密登录用户名 |
| `NACOS_AUTO_LOGIN_PASSWORD` | Nacos 免密登录密码 |
| `NACOS_TOKEN_STORAGE_KEY` | Nacos token 存储 key |
| `ADMIN_SERVER_TYPE` | 网关类型：`gateway-test` / `gateway` |
| `LANGFUSE_BASE_URL` | Langfuse 服务地址 |
| `LANGFUSE_EMAIL` | Langfuse 登录邮箱（tRPC 鉴权） |
| `LANGFUSE_PASSWORD` | Langfuse 登录密码（tRPC 鉴权） |
| `LANGFUSE_PROJECT_MAP` | 空间 key → Langfuse 项目密钥映射（JSON） |
| `EXPERIMENT_RUNNER_API_BASE` | experiment-runner 服务地址 |
| `UPLOAD_REPO` | 制品库上传配置（JSON） |

## 功能模块

- Agent 管理（HTTP Agent / Nacos Agent）
- Skill 管理（上传 / 编辑 / 版本对比）
- Prompt 管理
- 数据集管理（对接 Langfuse）
- 评估器管理
- MCP Server 管理
