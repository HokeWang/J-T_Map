---
title: J&T 地址解析对比平台
description: 多供应商地址解析方案对比工具，支持本地运行和 Node 托管部署。
ms.date: 2026-07-02
ms.topic: overview
---

## 项目简介

J&T 地址解析对比平台用于导入地址数据，维护不同地址入参方案，并同时请求
Google、Microsoft、Amazon 等供应商的地址解析接口。页面会展示每个方案的
经纬度、供应商对比距离、最终取值和地图坐标。

## 本地运行

确认电脑已安装 Node.js LTS，然后运行：

```powershell
npm start
```

浏览器打开：

```text
http://localhost:5174
```

Windows 用户也可以双击 `start-app.cmd` 启动。

## 在线部署

这个项目包含 `/api/vendor-geocode` Node 代理接口。GitHub Pages 只能托管静态
页面，不能运行这个接口，所以不适合作为完整可用的线上访问方式。

推荐使用 Render、Railway 或类似 Node Web Service 平台部署。仓库已包含
`render.yaml`，上传到 GitHub 后可以在 Render 中按 Blueprint 部署。

Render 部署步骤：

1. 将本项目推送到 GitHub 仓库。
2. 打开 <https://dashboard.render.com/>。
3. 选择 New > Blueprint。
4. 选择这个 GitHub 仓库。
5. Render 会读取 `render.yaml`，使用 `npm start` 启动服务。
6. 部署完成后，把 Render 提供的 URL 分享给外部用户。

## API Key 说明

项目不会保存任何 API Key。外部用户访问线上链接后，需要在页面顶部输入自己的
Google Maps JavaScript API Key，并在供应商配置里维护各供应商请求参数。

Google Key 至少需要启用：

* Maps JavaScript API
* Geocoding API

## 文件说明

* `index.html`：页面入口
* `src/app.js`：导入、解析、结果表格和地图逻辑
* `src/styles.css`：页面样式
* `server.js`：静态资源服务和供应商地址解析代理
* `sample-addresses.csv`：示例地址数据
* `start-app.cmd`：Windows 本地启动脚本
* `render.yaml`：Render Web Service 部署配置
