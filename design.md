
---

# 多 Deb 安装包聚合器（Deb Package Bundle）设计白皮书

**版本**：V1.0

**发布日期**：2026-06

---

# 1. 项目背景

Linux 平台的软件通常以 Debian 安装包（`.deb`）形式进行分发。

在一些企业级软件中，一个完整的软件产品通常由多个独立组件组成，例如：

* 主程序
* 服务端程序
* 驱动程序
* 插件
* Runtime
* 第三方依赖

这些组件分别维护为独立的 Debian Package，以方便：

* 独立升级
* 独立发布
* 独立测试
* 依赖管理

然而，对于最终用户而言，希望获得的是：

> 一个安装包，一次安装。

而不是：

```text
dpkg -i a.deb
dpkg -i b.deb
dpkg -i c.deb
...
```

因此需要一种聚合安装机制（Bundle Installer），实现：

* 单一入口
* 多包安装
* 多包卸载
* 多包升级

---

# 2. 设计目标

本项目旨在实现一个 **Deb Bundle Installer**。

其目标包括：

## 2.1 单一安装入口

用户仅需执行：

```bash
sudo dpkg -i <bundle-package-name>.deb
```

即可完成整个产品安装。

---

## 2.2 聚合多个 Deb

Bundle 中可包含任意数量 Deb：

```text
runtime.deb
driver.deb
server.deb
client.deb
plugin.deb
...
```

无需修改安装逻辑。

---

## 2.3 自动安装

Bundle 安装完成后：

自动安装所有子 Deb。

无需用户再次执行命令。

---

## 2.4 自动卸载

当用户执行：

```bash
sudo dpkg -r <bundle-package-name>
```

自动卸载：

* runtime
* server
* client
* driver
* plugin

保持系统一致性。

---

## 2.5 自动升级

新的 Bundle 可以覆盖旧版本。

支持：

```text
1.0 -> 1.1
1.1 -> 2.0
```

自动完成组件升级。

---

## 2.6 最小侵入

不修改已有 Deb。

无需重新打包已有组件。

Bundle 仅负责组织与调度。

---

# 3. 总体架构

整体采用 **Wrapper Package** 架构。

```text
                 +-----------------------+
                 | <bundle-package-name>.deb |
                 +-----------+-----------+
                             |
                  postinst/postrm
                             |
         +-------------------+-------------------+
         |                                       |
    读取 manifest                         读取 /var/lib/<bundle-package-name>/packages
    (/opt/bundle/manifest.json)            (持久化包列表, 由 postinst 保存)
         |                                       |
         v                                       v
  安装所有 Deb (async)                   卸载所有 Deb (async)
         |                                       |
    runtime.deb                            runtime
    client.deb                             client
    server.deb                             server
    driver.deb                             driver
```

Bundle 本身不包含业务逻辑。

仅作为安装调度器。

由于 dpkg 在安装 Wrapper 期间持有锁，postinst 通过后台子进程（`{ ... } & exit 0`）执行子包安装，以避免子包 `dpkg -i` 时的死锁。卸载同理。

---

# 4. Bundle 内部结构

建议采用如下目录：

```text
<bundle-package-name>/

├── DEBIAN
│   ├── control
│   ├── postinst
│   ├── postrm
│   └── md5sums
│
└── opt
    └── bundle
        ├── manifest.json
        ├── runtime.deb
        ├── client.deb
        ├── server.deb
        └── driver.deb
```

其中：

DEBIAN 负责：

* 生命周期
* 安装脚本
* 卸载脚本

opt/bundle：

存放所有待安装 Deb。

---

# 5. Manifest 设计

为了避免硬编码，Bundle 引入 Manifest。

例如：

```json
{
    "version": "1.0.0",
    "packages": [
        {
            "name": "runtime",
            "file": "runtime_1.0.0_amd64.deb"
        },
        {
            "name": "server",
            "file": "server_2.0.0_amd64.deb"
        },
        {
            "name": "client",
            "file": "client_2.0.0_amd64.deb"
        }
    ]
}
```

Manifest 用于：

安装：

```text
读取 manifest

↓

依次安装所有 deb
```

卸载：

```text
读取 manifest

↓

根据 package name 卸载
```

Node Builder 自动生成 Manifest。

无需人工维护。

---

# 6. 生命周期

## 安装流程

由于 dpkg 在安装 Wrapper 时持有锁，postinst 无法在同步上下文中调用 `dpkg -i`（会导致死锁）。
因此子包安装通过后台进程执行，postinst 立即 `exit 0`。

```text
用户

↓

dpkg -i bundle.deb

↓

安装 Wrapper package

↓

执行 postinst
    │
    ├─ 启动后台子进程 ({ ... } &)
    │
    ├─ 读取 manifest (/opt/bundle/manifest.json)
    │
    ├─ 写入持久化包列表到 /var/lib/<bundle-package-name>/packages
    │   （逆序，供卸载使用）
    │
    ├─ 等待 dpkg 锁释放
    │
    ├─ 按 manifest 顺序安装所有子包 (dpkg -i)
    │   └─ 每次安装记录 ExitCode 和耗时到 /var/log/<bundle-package-name>.log
    │
    └─ 安装完成

postinst exit 0

dpkg -i bundle.deb 返回

后台子进程继续运行 → 子包逐一安装完成
```

### 错误恢复

安装期间任一子包失败时，行为由 Builder 的 `onInstallError` 配置决定：

方案一（stop — 默认）：

```text
安装 Package A → 成功
安装 Package B → 失败 → 记录错误 → exit 1 → 停止
```

方案二（rollback）：

```text
安装 Package A → 成功 → 记录到 INSTALLED 列表
安装 Package B → 失败 → 逆序卸载所有已安装包 → exit 1
```

两种方案均记录 ExitCode 和错误信息到 `/var/log/<bundle-package-name>.log`。

---

## 卸载流程

```text
用户

↓

dpkg -r bundle

↓

执行 postrm
    │
    ├─ 检查 $1 为 "remove" 或 "purge"
    │
    ├─ 启动后台子进程 ({ ... } &)
    │
    ├─ 读取持久化包列表 (/var/lib/<bundle-package-name>/packages)
    │
    ├─ 删除持久化文件
    │
    ├─ 等待 dpkg 锁释放
    │
    ├─ 按逆序卸载所有包 (dpkg -r)
    │   └─ 每次卸载记录 ExitCode
    │
    └─ 卸载完成

postrm exit 0

dpkg -r bundle 返回

后台子进程继续运行 → 子包逐一卸载完成

删除 Wrapper package
```

---

## 升级流程

```text
Bundle v1 → 已安装的旧版本

Bundle v2 → 执行 dpkg -i bundle-v2.deb

↓

dpkg 检测 $2 为旧版本号 → postinst 识别为升级

↓

启动后台子进程

↓

按 manifest 顺序安装新版本子包
（dpkg 自动处理已安装包的新旧版本替换）

↓

完成

注意：升级并非逐个卸载再安装，而是直接通过 dpkg -i 覆盖。
dpkg 会正确处理已安装包的版本比较和依赖关系。
```

---

# 7. Node Builder

整个 Bundle 不建议人工制作。

建议提供 Builder：

```text
bundle-builder
```

输入：

```text
packages/

runtime.deb

server.deb

client.deb
```

输出：

```text
<bundle-package-name>.deb
```

Builder 自动完成：

* 创建目录
* 拷贝 Deb
* 生成 control
* 生成 manifest
* 生成 postinst
* 生成 postrm
* 生成 md5sums（所有 payload 文件的 MD5 校验和）
* 调用 dpkg-deb

整个过程自动完成。

### Builder 配置选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `onInstallError` | 子包安装失败时的行为 | `"stop"` |
| | `"stop"` — 停止安装，保留已安装包 | |
| | `"rollback"` — 回滚所有已安装包 | |

当设为 `"rollback"` 时，Builder 生成的 postinst 包含回滚函数。
失败时自动卸载所有已成功安装的包（逆序），再退出。

---

# 8. 安装策略

推荐采用：

Manifest 顺序安装。

例如：

```text
runtime

↓

driver

↓

server

↓

client
```

而不是目录遍历。

因为：

有依赖关系。

Manifest 可以保证安装顺序。

---

# 9. 卸载策略

建议：

逆序卸载。

例如：

```text
client

↓

server

↓

driver

↓

runtime
```

避免依赖冲突。

---

# 10. 错误恢复

安装失败：

```text
Package A

↓

Package B

↓

失败
```

Bundle 应记录：

```text
A 已安装

B 未安装
```

可选择：

方案一：

停止安装。

方案二：

回滚：

```text
卸载 A
```

具体策略由 Builder 配置。

---

# 11. 日志

建议：

统一输出：

```text
/var/log/<bundle-package-name>.log
```

其中 `<bundle-package-name>` 为 Builder 生成的 control 文件中 `Package` 字段的值。
例如包名为 `myapp-installer` 时，日志路径为 `/var/log/myapp-installer.log`。

记录：

* Bundle Version
* 安装时间
* 卸载时间
* Package
* ExitCode
* Error

便于售后分析。

### 持久化包列表

安装时，postinst 将子包列表（逆序）写入：

```text
/var/lib/<bundle-package-name>/packages
```

供 postrm 卸载时读取。该文件在卸载完成后删除。

---

# 12. HTTP 服务器

提供一个 Web 服务器，用于聚合打包模式（Bundle）创建和调试。

## 12.1 Web 界面功能

启动一个 Web 服务，提供图形化界面让用户选择 N 个 deb 包。

* 上传 Deb 文件（最大 500MB，最多 5 个）
* 显示包列表（自动提取包名和版本）
* 选择安装顺序（拖拽排序）
* 预览 Bundle 结构（目录树 + manifest）
* 显示构建进度（轮询，带进度条）
* 配置包 metadata（名称、版本、架构、节、优先级等）
* 选择错误恢复策略（stop / rollback）
* 并发安全（sessionId 隔离不同的上传会话）

## 12.2 HTTP API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config/defaults` | 获取当前服务器默认配置 |
| POST | `/api/packages/upload` | 上传 .deb 文件 |
| PATCH | `/api/bundles/preview` | 预览 Bundle 结构 |
| POST | `/api/bundles/generate` | 异步生成 Bundle |
| GET | `/api/bundles/status/{buildId}` | 查询构建状态 |
| GET | `/api/bundles/{id}` | 下载生成的 .deb |

### 12.2.0 通用约定

所有上传相关的接口支持 `sessionId` 参数，用于并发安全隔离。
未提供 `sessionId` 时使用默认 `"default"`。

### 12.2.1 包上传

```text
POST /api/packages/upload

Content-Type: multipart/form-data

Form Data:
  package: deb file
```

### 12.2.2 生成 Bundle

POST /api/bundles/generate

Content-Type: application/json

Request Body:

```json
{
    "packages": [
        {
            "name": "runtime",
            "file": "runtime_1.0.0_amd64.deb",
            "id": "uploaded-filename-uuid.deb"
        },
        {
            "name": "server", 
            "file": "server_2.0.0_amd64.deb",
            "id": "uploaded-filename-uuid2.deb"
        }
    ],
    "order": ["runtime", "server"],
    "sessionId": "session_xxx",
    "onInstallError": "rollback",
    "config": {
        "version": "2.0.0",
        "section": "admin"
    }
}
```

Response:

```json
{
    "message": "Bundle generation queued",
    "buildId": "a1b2c3d4e5f6g7h8",
    "statusUrl": "/api/bundles/status/a1b2c3d4e5f6g7h8"
}
```

### 12.2.3 构建状态查询

```text
GET /api/bundles/status/{buildId}
```

Response:

```json
{
    "status": "building",
    "progress": 50,
    "error": null,
    "bundleId": null,
    "downloadUrl": null,
    "createdAt": "2026-06-27T12:00:00.000Z",
    "completedAt": null
}
```

可能的状态：`pending` → `building` → `completed` / `failed`

### 12.2.4 预览 Bundle 结构

```text
PATCH /api/bundles/preview

Content-Type: application/json

Body:
{
    "packages": [...],
    "order": [...],
    "sessionId": "session_xxx"
}
```

返回生成的 manifest 和目录树预览（不含实际构建）。

### 12.2.5 下载 Bundle

```text
GET /api/bundles/{bundle_id}
```

## 12.3 组件架构

```text
                 +-----------------------+
                 |   Web 服务器 (Node.js) |
                 +-----------+-----------+
                             |
                  HTTP API  |  轮询 (Polling)
                             |
            +-----------------+------------------+
            |                                    |
          请求/响应                          定时查询状态
            |                                    |
      Bundle 生成器                         UI（HTML + Fetch API）
```

构建采用异步模式：

1. 客户端 POST `/api/bundles/generate` → 立即返回 `buildId`
2. 服务端后台异步生成 Bundle
3. 客户端每隔 1s 轮询 `GET /api/bundles/status/{buildId}` 获取进度
4. 状态包括：`status`、`progress`（0-100）、`error`、`downloadUrl`

采用轮询而非 WebSocket，以保持零额外依赖。

## 12.4 使用场景

* 快速组装多个 Deb 为 Bundle
* 仅需 deb 文件，无需直接使用 Node Builder
* 图形化操作，适合非技术用户
* 离线环境调试 Bundle

---

# 13. 后续扩展

未来可增加：

## Bundle 签名

校验所有 Deb。

避免 Bundle 被篡改。

---

## SHA256 校验

Manifest：

```json
{
    "packages": [
        {
            "name": "runtime",
            "sha256": "xxxx..."
        }
    ]
}
```

安装前验证完整性。

---

## 条件安装

例如：

```json
{
    "package":"driver",
    "condition":"kernel>=6.6"
}
```

Builder 自动判断。

---

## 依赖图

Manifest：

```text
Runtime

↓

Driver

↓

Server

↓

Client
```

自动拓扑排序。

---

## GUI Installer

未来可提供：

```text
Bundle

↓

Qt

↓

Electron

↓

GTK
```

实现图形安装界面。

---
