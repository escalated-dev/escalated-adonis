<p align="center"><sub>
  <a href="README.ar.md">العربية</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="../../README.md">English</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.it.md">Italiano</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.nl.md">Nederlands</a> ·
  <a href="README.pl.md">Polski</a> ·
  <a href="README.pt-BR.md">Português (BR)</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <b>简体中文</b>
</sub></p>

<p align="center">
  <a href="https://escalated.dev"><img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/logo.png" width="72" height="72" alt="Escalated"></a>
</p>

<h1 align="center">Escalated for AdonisJS</h1>

<p align="center">
  为你的 AdonisJS 应用添加一套完整的帮助台。<br>
  工单、SLA、升级规则、客服收件箱和客户门户，全部运行在你自己的数据库上。
</p>

<p align="center">
  <a href="https://escalated.dev"><b>官网</b></a> ·
  <a href="https://escalated.dev/docs"><b>文档</b></a> ·
  <a href="https://escalated.dev/cloud"><b>Cloud</b></a> ·
  <a href="../../CHANGELOG.md"><b>更新日志</b></a>
</p>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-dark.png">
  <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-light.png" alt="Escalated 客服收件箱：带计数的已保存视图，每个工单上的 SLA 倒计时和优先级" width="100%">
</picture>

## 它能做什么

<table>
  <tr>
    <td width="40%">
      <h3>客服可以整天在其中工作的收件箱</h3>
      对话、内部备注、预设回复和 SLA 计时器都在同一个屏幕上。工单也可以通过 Mailgun、Postmark 或 SES 以邮件形式进入。
    </td>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-light.png" alt="在客服工作区中打开的工单及回复编辑器">
      </picture>
    </td>
  </tr>
  <tr>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-light.png" alt="管理后台的报表页面，显示响应时间、CSAT 和 SLA 违约">
      </picture>
    </td>
    <td width="40%">
      <h3>一目了然的 SLA 和升级规则</h3>
      按优先级设定的响应和解决目标，支持工作时间；目标未达成时进行升级或重新分配的规则；以及违约报表。
    </td>
  </tr>
</table>

## 功能

<table>
<tr>
<td width="33%" valign="top">

**工单**
- 创建、更新、关闭和重新打开
- 带置顶备注的会话式回复
- 拆分、合并、关联和暂缓
- 工单内的旁路对话
- 每次变更的活动日志

</td>
<td width="33%" valign="top">

**客服工作区**
- 快速筛选和已保存视图
- 批量修改状态、优先级和分配
- 宏和预设回复
- 部门、标签和关注者
- 查看谁正在浏览工单

</td>
<td width="33%" valign="top">

**SLA 与自动化**
- 首次响应和解决目标
- 违约检测和预警
- 按计划运行的升级规则
- 带条件的自动化规则

</td>
</tr>
<tr>
<td width="33%" valign="top">

**客户**
- 客户门户和仪表盘
- 通过令牌访问的访客工单
- 通过邮件验证码验证的访客访问
- 可嵌入的小部件，支持知识库搜索
- 知识库，可开可关
- 解决后的 CSAT 评分

</td>
<td width="33%" valign="top">

**邮件**
- 通过 Mailgun、Postmark、SES 接收邮件
- 在邮件客户端中正确归入会话
- 品牌化模板

</td>
<td width="33%" valign="top">

**管理与访问**
- 客户、客服和管理员角色
- 可选的角色和权限
- 可选 SSO：SAML、OAuth 2、OIDC、JWT
- 设置保存在数据库中
- 会过期的私有附件链接

</td>
</tr>
<tr>
<td width="33%" valign="top">

**集成**
- 带投递日志的签名 Webhook
- 带作用域令牌的 REST API
- 进程内运行的 TypeScript 插件
- 批量数据导入

</td>
<td width="33%" valign="top">

**实时**
- 通过 Transmit 广播
- 关闭时回退为轮询

</td>
<td width="33%" valign="top">

**语言**
- 来自共享语言包的文案
- 按宿主覆盖

</td>
</tr>
</table>

<p align="center"><sub><a href="../features.md">查看全部功能详情</a></sub></p>

<p align="center">
  <a href="https://adonisjs.com"><img src="https://img.shields.io/badge/AdonisJS_7-5A45FF?style=for-the-badge&logo=adonisjs&logoColor=white" alt="AdonisJS 7"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js_24+-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 24+"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://inertiajs.com"><img src="https://img.shields.io/badge/Inertia-9553E9?style=for-the-badge&logo=inertia&logoColor=white" alt="Inertia"></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue 3"></a>
</p>

## 快速开始

```bash
npm install @escalated-dev/escalated-adonis
npm install @escalated-dev/escalated
node ace configure @escalated-dev/escalated-adonis
node ace migration:run
```

然后访问 `/support`。需要 AdonisJS v7 和 Node.js 24+。[入门指南](../getting-started.md)列出了所需的其他 Adonis 包，[配置](../configuration.md)介绍了运行 SLA 和升级的定时命令。

## 了解更多

- [全部功能](../features.md) · [入门](../getting-started.md) · [配置与定时命令](../configuration.md)
- [架构、页面、路由和事件](../architecture.md) · [自定义](../customization.md)
- [访问控制](../access-control.md) · [SSO](../sso.md) · [工单访问与路由](../ticket-access-and-routing.md)
- [入站邮件](../inbound-email.md) · [嵌入小部件](../embedding-the-widget.md) · [访客访问](../guest-access.md) · [私有附件](../private-attachments.md)
- [客服面板](../agent-panel.md) · [嵌入管理后台](../embedding-admin.md)
- [插件 SDK](../plugin-sdk.md) · [插件](../plugins.md) · [邮件简报](../newsletters.md) · [依赖安全](../dependency-security.md)

Escalated 也提供 [Laravel](https://github.com/escalated-dev/escalated-laravel)、[Rails](https://github.com/escalated-dev/escalated-rails)、[Django](https://github.com/escalated-dev/escalated-django)、[NestJS](https://github.com/escalated-dev/escalated-nestjs)、[Symfony](https://github.com/escalated-dev/escalated-symfony)、[Phoenix](https://github.com/escalated-dev/escalated-phoenix)、[Go](https://github.com/escalated-dev/escalated-go)、[.NET](https://github.com/escalated-dev/escalated-dotnet)、[Spring](https://github.com/escalated-dev/escalated-spring)、[WordPress](https://github.com/escalated-dev/escalated-wordpress)、[Filament](https://github.com/escalated-dev/escalated-filament) 版本。UI 位于 [escalated](https://github.com/escalated-dev/escalated)。

## 许可证

MIT。Copyright (c) Escalated.dev。详见 [LICENSE](../../LICENSE)。
