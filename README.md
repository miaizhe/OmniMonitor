# OmniMonitor

OmniMonitor 是一个现代化的全局基础设施监控大屏，旨在将多个 Serverless 与边缘计算平台（如 Vercel, Cloudflare, 腾讯云 EdgeOne）的遥测数据与性能指标聚合在同一个面板中展示。

## ✨ 核心特性

- **多平台聚合 (Multi-provider Integration)**: 原生支持 Vercel, Cloudflare 和 Tencent EdgeOne 的数据接入。
- **全局流量分析 (Global Traffic Analysis)**: 提供跨平台的时序流量趋势图（Requests & Bandwidth），支持平台间数据的合并展示与独立查看。
- **访问地区与状态码分布 (Geographic & Status Codes)**: 动态解析请求的来源国家/地区以及 HTTP 响应状态码，生成直观的进度条和横向柱状图。
- **灵活的时间窗口 (Dynamic Time Range)**: 支持一键切换查询时间段：最近 1 小时、24 小时、7 天和 30 天，图表数据及横轴标签会自适应重绘。
- **多域名/Zone 隔离切换 (Domain Filtering)**: 自动检测您在 Cloudflare 和 EdgeOne 账号下的所有可用域名（Zones），并提供便捷的下拉菜单支持单域名数据隔离查看。

## 🚀 快速开始

### 1. 环境依赖

确保你已经安装了 [Node.js](https://nodejs.org/) (建议 v18+) 和 `npm` 或 `pnpm`。

### 2. 安装依赖

```bash
npm install
# 或者
pnpm install
```

### 3. 配置环境变量

复制环境配置文件示例并进行修改：

```bash
cp .env.example .env.local
```

在 `.env.local` 中填入你的各平台密钥：

```env
# -----------------------------
# Cloudflare 配置
# -----------------------------
# 需要拥有 Zone -> Analytics -> Read 以及 Zone -> Zone -> Read 的权限
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token

# -----------------------------
# 腾讯云 EdgeOne 配置
# -----------------------------
TENCENTCLOUD_SECRET_ID=your_tencentcloud_secret_id
TENCENTCLOUD_SECRET_KEY=your_tencentcloud_secret_key

# -----------------------------
# Vercel 配置
# -----------------------------
VERCEL_API_TOKEN=your_vercel_api_token
```

### 4. 运行开发服务器

```bash
npm run dev
# 或者
pnpm dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可查看监控大屏。

## 🛠️ 技术栈

- **框架**: [Next.js](https://nextjs.org/) (App Router)
- **UI 库**: [React](https://reactjs.org/) + [Tailwind CSS](https://tailwindcss.com/)
- **图表**: [Recharts](https://recharts.org/)
- **图标**: [Lucide React](https://lucide.dev/)

## 📄 许可证 (License)

本项目采用 **GPL-3.0 (GNU General Public License v3.0)** 许可证。这是一个较为严格的“传染性”开源许可证。

**核心含义包括**：
- 允许商业使用、修改、分发、专利使用和私人使用。
- **强制开源**：任何基于此项目修改或衍生的作品，在分发或作为网络服务提供时，**必须同样以 GPL-3.0 许可证开源其全部源代码**。
- 必须包含相同的版权声明和许可证文件。

详细条款请参阅项目根目录下的 `LICENSE` 文件。
