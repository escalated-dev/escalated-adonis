<p align="center"><sub>
  <a href="docs/translations/README.ar.md">العربية</a> ·
  <a href="docs/translations/README.de.md">Deutsch</a> ·
  <b>English</b> ·
  <a href="docs/translations/README.es.md">Español</a> ·
  <a href="docs/translations/README.fr.md">Français</a> ·
  <a href="docs/translations/README.it.md">Italiano</a> ·
  <a href="docs/translations/README.ja.md">日本語</a> ·
  <a href="docs/translations/README.ko.md">한국어</a> ·
  <a href="docs/translations/README.nl.md">Nederlands</a> ·
  <a href="docs/translations/README.pl.md">Polski</a> ·
  <a href="docs/translations/README.pt-BR.md">Português (BR)</a> ·
  <a href="docs/translations/README.ru.md">Русский</a> ·
  <a href="docs/translations/README.tr.md">Türkçe</a> ·
  <a href="docs/translations/README.zh-CN.md">简体中文</a>
</sub></p>

<p align="center">
  <a href="https://escalated.dev"><img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/logo.png" width="72" height="72" alt="Escalated"></a>
</p>

<h1 align="center">Escalated for AdonisJS</h1>

<p align="center">
  Add a complete helpdesk to your AdonisJS app.<br>
  Tickets, SLAs, escalation rules, an agent inbox and a customer portal, running on your own database.
</p>

<p align="center">
  <a href="https://escalated.dev"><b>Website</b></a> ·
  <a href="https://escalated.dev/docs"><b>Docs</b></a> ·
  <a href="https://escalated.dev/cloud"><b>Cloud</b></a> ·
  <a href="CHANGELOG.md"><b>Changelog</b></a>
</p>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-dark.png">
  <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-light.png" alt="The Escalated agent inbox: saved views with counts, SLA countdowns and priorities on every ticket" width="100%">
</picture>

## What it does

<table>
  <tr>
    <td width="40%">
      <h3>An inbox your agents can work in all day</h3>
      Conversation, internal notes, canned replies and SLA timers on one screen. Tickets also arrive by email through Mailgun, Postmark or SES.
    </td>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-light.png" alt="A ticket open in the agent workspace with the reply composer">
      </picture>
    </td>
  </tr>
  <tr>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-light.png" alt="The admin reports page with response times, CSAT and SLA breaches">
      </picture>
    </td>
    <td width="40%">
      <h3>SLAs and escalation rules you can see</h3>
      Response and resolution targets per priority with business hours, rules that escalate or reassign when they slip, and reports on breaches.
    </td>
  </tr>
</table>

## Features

<table>
<tr>
<td width="33%" valign="top">

**Tickets**
- Create, update, close and reopen
- Threaded replies with pinned notes
- Split, merge, link and snooze
- Side conversations on a ticket
- Activity log of every change

</td>
<td width="33%" valign="top">

**Agent workspace**
- Quick filters and saved views
- Bulk status, priority and assignment
- Macros and canned responses
- Departments, tags and followers
- See who is viewing a ticket

</td>
<td width="33%" valign="top">

**SLAs and automation**
- First response and resolution targets
- Breach detection and warnings
- Escalation rules on a schedule
- Automation rules with conditions

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Customers**
- Customer portal and dashboard
- Guest tickets with token access
- Verified guest access by emailed code
- Embeddable widget with KB search
- Knowledge base, on or off
- CSAT ratings after resolution

</td>
<td width="33%" valign="top">

**Email**
- Inbound via Mailgun, Postmark, SES
- Correct threading in mail clients
- Branded templates

</td>
<td width="33%" valign="top">

**Admin and access**
- Customer, agent and admin roles
- Optional roles and permissions
- Optional SSO: SAML, OAuth 2, OIDC, JWT
- Settings stored in the database
- Private, expiring attachment links

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Integrations**
- Signed webhooks with a delivery log
- REST API with scoped tokens
- In-process TypeScript plugins
- Bulk data import

</td>
<td width="33%" valign="top">

**Real time**
- Broadcasting via Transmit
- Polling fallback when it is off

</td>
<td width="33%" valign="top">

**Languages**
- Strings from the shared locale package
- Per-host overrides

</td>
</tr>
</table>

<p align="center"><sub><a href="docs/features.md">Every feature in detail</a></sub></p>

<p align="center">
  <a href="https://adonisjs.com"><img src="https://img.shields.io/badge/AdonisJS_7-5A45FF?style=for-the-badge&logo=adonisjs&logoColor=white" alt="AdonisJS 7"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js_24+-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 24+"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://inertiajs.com"><img src="https://img.shields.io/badge/Inertia-9553E9?style=for-the-badge&logo=inertia&logoColor=white" alt="Inertia"></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue 3"></a>
</p>

## Quick start

```bash
npm install @escalated-dev/escalated-adonis
npm install @escalated-dev/escalated
node ace configure @escalated-dev/escalated-adonis
node ace migration:run
```

Then visit `/support`. Needs AdonisJS v7 and Node.js 24+. The [getting started guide](docs/getting-started.md) lists the other Adonis packages it needs, and [configuration](docs/configuration.md) covers the scheduled commands that run SLAs and escalations.

## Learn more

- [All features](docs/features.md) · [Getting started](docs/getting-started.md) · [Configuration and scheduled commands](docs/configuration.md)
- [Architecture, pages, routes and events](docs/architecture.md) · [Customization](docs/customization.md)
- [Access control](docs/access-control.md) · [SSO](docs/sso.md) · [Ticket access and routing](docs/ticket-access-and-routing.md)
- [Inbound email](docs/inbound-email.md) · [Embedding the widget](docs/embedding-the-widget.md) · [Guest access](docs/guest-access.md) · [Private attachments](docs/private-attachments.md)
- [Agent panel](docs/agent-panel.md) · [Embedding the admin](docs/embedding-admin.md)
- [Plugin SDK](docs/plugin-sdk.md) · [Plugins](docs/plugins.md) · [Newsletters](docs/newsletters.md) · [Dependency security](docs/dependency-security.md)

Escalated is also available for [Laravel](https://github.com/escalated-dev/escalated-laravel), [Rails](https://github.com/escalated-dev/escalated-rails), [Django](https://github.com/escalated-dev/escalated-django), [NestJS](https://github.com/escalated-dev/escalated-nestjs), [Symfony](https://github.com/escalated-dev/escalated-symfony), [Phoenix](https://github.com/escalated-dev/escalated-phoenix), [Go](https://github.com/escalated-dev/escalated-go), [.NET](https://github.com/escalated-dev/escalated-dotnet), [Spring](https://github.com/escalated-dev/escalated-spring), [WordPress](https://github.com/escalated-dev/escalated-wordpress) and [Filament](https://github.com/escalated-dev/escalated-filament). The UI lives in [escalated](https://github.com/escalated-dev/escalated).

## License

MIT. Copyright (c) Escalated.dev. See [LICENSE](LICENSE).
