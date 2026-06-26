
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
sudo dpkg -i product-installer.deb
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
sudo dpkg -r product-installer
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
                | product-installer.deb |
                +-----------+-----------+
                            |
                 postinst/postrm
                            |
          +-----------------+------------------+
          |                                    |
     安装所有 Deb                        卸载所有 Deb
          |                                    |
    runtime.deb                          runtime
    client.deb                           client
    server.deb                           server
    driver.deb                           driver
```

Bundle 本身不包含业务逻辑。

仅作为安装调度器。

---

# 4. Bundle 内部结构

建议采用如下目录：

```text
product-installer/

├── DEBIAN
│   ├── control
│   ├── postinst
│   ├── postrm
│   └── manifest.json
│
└── opt
    └── bundle
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

```text
用户

↓

dpkg -i bundle.deb

↓

安装 Wrapper

↓

执行 postinst

↓

读取 manifest

↓

安装所有子包

↓

安装结束
```

---

## 卸载流程

```text
用户

↓

dpkg -r bundle

↓

执行 postrm

↓

读取 manifest

↓

卸载所有 Package

↓

删除 Bundle
```

---

## 升级流程

```text
Bundle v1

↓

Bundle v2

↓

升级 Wrapper

↓

升级需要升级的 Deb

↓

完成
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
product-installer.deb
```

Builder 自动完成：

* 创建目录
* 拷贝 Deb
* 生成 control
* 生成 manifest
* 生成 postinst
* 生成 postrm
* 调用 dpkg-deb

整个过程自动完成。

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
/var/log/product-installer.log
```

记录：

* Bundle Version
* 安装时间
* 卸载时间
* Package
* ExitCode
* Error

便于售后分析。

---

# 12. HTTP 服务器

提供一个 Web 服务器，用于聚合打包模式（Bundle）创建和调试。

## 12.1 Web 界面功能

启动一个 Web 服务，提供图形化界面让用户选择 N 个 deb 包。

* 上传 Deb 文件
* 显示包列表
* 选择安装顺序
* 预览 Bundle 结构
* 生成 Manifest

## 12.2 HTTP API

### 12.2.1 包上传

```text
POST /api/packages/upload

Content-Type: multipart/form-data

Form Data:
  package: deb file
```

### 12.2.2 生成 Bundle

```text
POST /api/bundles/generate

Content-Type: application/json

Body:
{
    "packages": [
        {
            "name": "runtime",
            "file": "runtime_1.0.0_amd64.deb"
        },
        {
            "name": "server", 
            "file": "server_2.0.0_amd64.deb"
        }
    ],
    "order": ["runtime", "server"]
}
```

### 12.2.3 下载 Bundle

```text
GET /api/bundles/{bundle_id}
```

## 12.3 组件架构

```text
                 +-----------------------+
                 |   Web 服务器 (Node.js) |
                 +-----------+-----------+
                            |
                 HTTP API  |  Web Socket  |
                            |
            +-----------------+------------------+
            |                                    |
          请求/响应                          实时更新
            |                                    |
     Bundle 生成器                         UI
```

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
