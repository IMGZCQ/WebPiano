# 对牛弹琴

一个跑在浏览器里的虚拟钢琴，3 组八度 36 个白键 + 25 个黑键，从 C2 到 C7 完整覆盖。键盘鼠标都能弹，打开就能玩。

后端用 Go 起一个静态文件服务，前端是原生 HTML / CSS / JS，音色用 Web Audio API 实时解码，零依赖、无构建步骤。

## 特性

- **两种演奏方式**：鼠标点击琴键，或直接用电脑键盘按键
- **3 组八度键位映射**：C4~C7 同时绑定主键盘 + 方向键 + 数字小键盘，每键可触发多个物理键
- **黑键 hold-key 模式**：按住 \`（反引号）或 `Backspace` 再按白键，即可触发对应的升半音黑键，避开 Shift/Ctrl/Alt 与系统快捷键的冲突
- **键位示意图**：琴体下方有完整的键盘布局图，点击图上的键也能发声，触发时对应按钮实时高亮
- **可视化反馈**：键位提示 + 音名显示可独立开关；按住琴键一直发声，松开立即停止
- **资源分级缓存**：音色 1 天缓存，HTML/CSS/JS 不缓存，调试修改刷新即生效

## 键位一览

### 白键（C2 ~ C7，共 36 个）

| 八度 | 物理键位 |
|---|---|
| C2 ~ E3 | 数字键 `1 2 3 4 5 6 7 8 9 0` |
| F3 ~ B3 | `Q W E R T Y U` |
| C4 ~ B4 | `T Y U I O P A` + `← ↑ ↓ →` + 数字小键盘 `0 . Enter` |
| C5 ~ B5 | `S D F G H J K` + 数字小键盘 `1 2 3 4 5 6 7` |
| C6 ~ B6 | `L Z X C V B N` + 数字小键盘 `8 9 + Num / * -` |
| C7 | `M` |

### 黑键（升半音）

每个白键对应的升半音黑键，按住 ` \` `（反引号）` 或 `Backspace` 的同时按下该白键的主键位即可触发。

> 键位图上 \` 和 `Bksp` 键被染成淡紫色，键帽下有"黑键"小字标识。

## 界面

```
┌──────────────────────────────────────────────┐
│  🟪 对牛弹琴    ☑ 键位提示 ☑ 音名 🔊 80%    │  ← 顶栏
├──────────────────────────────────────────────┤
│        对牛弹琴 · PIANO       使用提示       │  ← 琴体品牌条
│   ┃█┃█┃█┃█┃█┃█┃█┃█┃█┃ ...                │  ← 琴键
│   C2 D2 E2 ... C7                            │
├──────────────────────────────────────────────┤
│  ` 1 2 3 4 5 6 7 8 9 0 - = Bksp ...         │  ← 键位图
│  Tab Q W E R T Y U I O P ...                 │
│  ...                                         │
└──────────────────────────────────────────────┘
```

- **键位提示**：显示每个琴键上印的字母 / 符号
- **音名**：显示 C2 / D#4 之类
- **音量**：0~100 直接控制 master gain

## 快速开始

### 本地直接跑

```bash
cd webpiano
go run .
```

默认监听 `:8080`，浏览器打开 http://localhost:8080 即可。

可指定参数：

```bash
go run . -addr=":9000" -root=./static
```

### Docker

构建并启动：

```bash
cd webpiano
docker compose up -d
```

镜像名默认 `imgzcq/webpiano:latest`，映射端口 `8080:8080`，开自启。

单独构建：

```bash
docker build -t webpiano .
docker run -d --name webpiano -p 8080:8080 --restart always webpiano
```

### 发布版本

仓库根目录打 tag（如 `v0.1.0`）即可触发 GitHub Actions：
- 推送 Docker 镜像到 Docker Hub（多架构：amd64 / arm64 / armv7）
- 产出 5 个平台的二进制（Linux / Windows / macOS）+ sha256 校验和，自动创建 GitHub Release

**GitHub Secrets 配置**（Settings → Secrets and variables → Actions → New repository secret）：

| Secret 名 | 必填 | 说明 |
|---|---|---|
| `DOCKERHUB_USERNAME` | 否 | Docker Hub 用户名。缺失时 Docker 推送步骤自动跳过，只发布二进制 |
| `DOCKERHUB_TOKEN` | 否 | Docker Hub Access Token（不是密码，建议在 https://hub.docker.com/settings/security 生成） |
| `GITHUB_TOKEN` | 自动 | GitHub Actions 内置，无需手动配置，用于创建 Release |

手动触发时可选 `build_type`：
- `docker_and_release`（默认）：两个都做
- `docker`：只推 Docker
- `release`：只发二进制

## 项目结构

```
webpiano/
├── main.go                       # 入口：HTTP 服务 + 优雅关闭
├── go.mod                        # 模块声明，无第三方依赖
├── Dockerfile                    # 多阶段构建，最终镜像仅含二进制
├── docker-compose.yml
├── .dockerignore
├── .github/
│   └── workflows/
│       └── publish-and-release.yml
├── internal/
│   └── server/
│       └── server.go             # 静态文件服务 + Cache-Control 策略
└── static/
    ├── index.html                # 页面骨架
    ├── style.css                 # 钢琴与键位图样式
    ├── app.js                    # 键盘事件、音频播放、键位图渲染
    ├── assets/
    │   └── icon.png              # 站点图标 / 品牌标识
    └── samples/
        └── piano/                # 61 个 mp3 音色文件
            ├── a49.mp3 ~ a90.mp3 # 白键
            └── b49.mp3 ~ b90.mp3 # 黑键
```

## 技术栈

- **后端**：Go 标准库 `net/http`，多阶段 Docker 镜像
- **前端**：原生 HTML / CSS / JS，无构建工具
- **音频**：Web Audio API + `AudioContext.decodeAudioData` 预解码到 `AudioBuffer`
- **键盘事件**：优先使用 `e.code` 区分顶行数字键与数字小键盘（即使 NumLock 关闭也能识别）

## 缓存策略

| 资源类型 | Cache-Control |
|---|---|
| `*.mp3 / *.ogg / *.wav / *.flac` | `public, max-age=86400` |
| `*.js / *.css / *.html` | `no-cache` |

实现见 [server.go](file:///f:/飞牛图标工具/piano/webpiano/internal/server/server.go)。

## 致谢

音色样本来自参考项目 [AutoPiano-master](file:///f:/飞牛图标工具/piano/AutoPiano-master)，仅供学习交流使用。
