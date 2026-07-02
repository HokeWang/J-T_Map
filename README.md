---
title: J&T 地址解析对比平台静态版
description: 多供应商地址解析方案对比工具静态版，支持 GitHub Pages 部署和浏览器直连请求。
ms.date: 2026-07-02
ms.topic: overview
---

## 项目简介

J&T 地址解析对比平台用于导入地址数据，维护不同地址入参方案，并同时请求
Google、Microsoft、Amazon 等供应商的地址解析接口。页面会展示每个方案的
经纬度、供应商对比距离、最终取值和地图坐标。

## 本地预览

可以直接用浏览器打开 `index.html`。如果浏览器限制本地文件读取示例 CSV，可以用
任意静态服务器预览，例如：

```bash
npx serve .
```

## GitHub Pages 部署

这个版本不依赖 Node 代理接口，可以部署到 GitHub Pages。

部署步骤：

1. 将静态版文件提交到 GitHub 仓库。
2. 打开仓库 Settings > Pages。
3. Source 选择 Deploy from a branch。
4. Branch 选择 `gh-pages`，目录选择 `/root`。
5. 保存后等待 GitHub 生成访问链接。

访问链接格式通常是：

```text
https://hokewang.github.io/J-T_Map/
```

## 浏览器直连说明

静态版会在浏览器中直接请求供应商接口：

* Google 使用 Google Maps JavaScript API 的 `Geocoder`。
* Microsoft、Amazon 等其他供应商按页面配置的 URL、Params 和 Body 直接请求。

浏览器直连会受到供应商 CORS 策略影响。如果供应商接口不允许网页跨域请求，
页面会显示请求失败。这不是页面逻辑错误，而是供应商接口限制。

## API Key 说明

项目不会保存任何 API Key。外部用户访问页面后，需要在页面顶部输入自己的
Google Maps JavaScript API Key，并在供应商配置里维护各供应商请求参数。

> [!IMPORTANT]
> 静态版中用户输入的 Key 会出现在浏览器请求里。请在供应商后台配置 HTTP
> referrer、域名白名单、额度和权限限制。

Google Key 至少需要启用：

* Maps JavaScript API
* Geocoding API

## 文件说明

* `index.html`：页面入口
* `src/app.js`：导入、解析、结果表格和地图逻辑
* `src/styles.css`：页面样式
* `sample-addresses.csv`：示例地址数据
