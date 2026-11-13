<p align="center"><sub>
  <a href="README.ar.md">العربية</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="../../README.md">English</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.it.md">Italiano</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a> ·
  <b>Nederlands</b> ·
  <a href="README.pl.md">Polski</a> ·
  <a href="README.pt-BR.md">Português (BR)</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.zh-CN.md">简体中文</a>
</sub></p>

<p align="center">
  <a href="https://escalated.dev"><img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/logo.png" width="72" height="72" alt="Escalated"></a>
</p>

<h1 align="center">Escalated for AdonisJS</h1>

<p align="center">
  Voeg een complete helpdesk toe aan je AdonisJS-app.<br>
  Tickets, SLA's, escalatieregels, een inbox voor agents en een klantenportaal, draaiend op je eigen database.
</p>

<p align="center">
  <a href="https://escalated.dev"><b>Website</b></a> ·
  <a href="https://escalated.dev/docs"><b>Documentatie</b></a> ·
  <a href="https://escalated.dev/cloud"><b>Cloud</b></a> ·
  <a href="../../CHANGELOG.md"><b>Wijzigingslog</b></a>
</p>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-dark.png">
  <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-light.png" alt="De agent-inbox van Escalated: opgeslagen weergaven met aantallen, SLA-afteltimers en prioriteiten op elk ticket" width="100%">
</picture>

## Wat het doet

<table>
  <tr>
    <td width="40%">
      <h3>Een inbox waar je agents de hele dag in kunnen werken</h3>
      Gesprek, interne notities, standaardantwoorden en SLA-timers op één scherm. Tickets komen ook binnen per e-mail via Mailgun, Postmark of SES.
    </td>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-light.png" alt="Een geopend ticket in de werkruimte van de agent met de antwoordeditor">
      </picture>
    </td>
  </tr>
  <tr>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-light.png" alt="De rapportpagina in het beheer met reactietijden, CSAT en SLA-overschrijdingen">
      </picture>
    </td>
    <td width="40%">
      <h3>SLA's en escalatieregels die je kunt zien</h3>
      Reactie- en oplosdoelen per prioriteit met kantooruren, regels die escaleren of opnieuw toewijzen als een doel niet gehaald wordt, en rapporten over overschrijdingen.
    </td>
  </tr>
</table>

## Functies

<table>
<tr>
<td width="33%" valign="top">

**Tickets**
- Aanmaken, bijwerken, sluiten en heropenen
- Antwoorden in threads met vastgezette notities
- Splitsen, samenvoegen, koppelen en snoozen
- Zijgesprekken op een ticket
- Activiteitenlog van elke wijziging

</td>
<td width="33%" valign="top">

**Werkruimte voor agents**
- Snelle filters en opgeslagen weergaven
- Status, prioriteit en toewijzing in bulk
- Macro's en standaardantwoorden
- Afdelingen, tags en volgers
- Zie wie een ticket bekijkt

</td>
<td width="33%" valign="top">

**SLA's en automatisering**
- Doelen voor eerste reactie en oplossing
- Detectie van overschrijdingen en waarschuwingen
- Escalatieregels volgens schema
- Automatiseringsregels met voorwaarden

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Klanten**
- Klantenportaal en dashboard
- Gasttickets met toegang via token
- Geverifieerde gasttoegang met een code per e-mail
- Insluitbare widget met zoeken in de kennisbank
- Kennisbank, aan of uit
- CSAT-beoordelingen na oplossing

</td>
<td width="33%" valign="top">

**E-mail**
- Inkomend via Mailgun, Postmark, SES
- Correcte threads in mailprogramma's
- Templates in je eigen huisstijl

</td>
<td width="33%" valign="top">

**Beheer en toegang**
- Rollen voor klant, agent en beheerder
- Optionele rollen en rechten
- Optionele SSO: SAML, OAuth 2, OIDC, JWT
- Instellingen opgeslagen in de database
- Privélinks naar bijlagen die verlopen

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Integraties**
- Ondertekende webhooks met afleverlog
- REST API met tokens met beperkte scope
- TypeScript-plugins in hetzelfde proces
- Bulkimport van gegevens

</td>
<td width="33%" valign="top">

**Realtime**
- Broadcasting via Transmit
- Polling als terugval als het uit staat

</td>
<td width="33%" valign="top">

**Talen**
- Teksten uit het gedeelde localepakket
- Overschrijvingen per host

</td>
</tr>
</table>

<p align="center"><sub><a href="../features.md">Alle functies in detail</a></sub></p>

<p align="center">
  <a href="https://adonisjs.com"><img src="https://img.shields.io/badge/AdonisJS_7-5A45FF?style=for-the-badge&logo=adonisjs&logoColor=white" alt="AdonisJS 7"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js_24+-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 24+"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://inertiajs.com"><img src="https://img.shields.io/badge/Inertia-9553E9?style=for-the-badge&logo=inertia&logoColor=white" alt="Inertia"></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue 3"></a>
</p>

## Snel aan de slag

```bash
npm install @escalated-dev/escalated-adonis
npm install @escalated-dev/escalated
node ace configure @escalated-dev/escalated-adonis
node ace migration:run
```

Ga daarna naar `/support`. Vereist AdonisJS v7 en Node.js 24+. De [handleiding om te beginnen](../getting-started.md) noemt de andere Adonis-pakketten die nodig zijn, en [configuratie](../configuration.md) behandelt de geplande commando's die SLA's en escalaties uitvoeren.

## Meer informatie

- [Alle functies](../features.md) · [Aan de slag](../getting-started.md) · [Configuratie en geplande commando's](../configuration.md)
- [Architectuur, pagina's, routes en events](../architecture.md) · [Aanpassen](../customization.md)
- [Toegangsbeheer](../access-control.md) · [SSO](../sso.md) · [Tickettoegang en routering](../ticket-access-and-routing.md)
- [Inkomende e-mail](../inbound-email.md) · [De widget insluiten](../embedding-the-widget.md) · [Gasttoegang](../guest-access.md) · [Privébijlagen](../private-attachments.md)
- [Agentpaneel](../agent-panel.md) · [Het beheer insluiten](../embedding-admin.md)
- [Plugin-SDK](../plugin-sdk.md) · [Plugins](../plugins.md) · [Nieuwsbrieven](../newsletters.md) · [Beveiliging van dependencies](../dependency-security.md)

Escalated is ook beschikbaar voor [Laravel](https://github.com/escalated-dev/escalated-laravel), [Rails](https://github.com/escalated-dev/escalated-rails), [Django](https://github.com/escalated-dev/escalated-django), [NestJS](https://github.com/escalated-dev/escalated-nestjs), [Symfony](https://github.com/escalated-dev/escalated-symfony), [Phoenix](https://github.com/escalated-dev/escalated-phoenix), [Go](https://github.com/escalated-dev/escalated-go), [.NET](https://github.com/escalated-dev/escalated-dotnet), [Spring](https://github.com/escalated-dev/escalated-spring), [WordPress](https://github.com/escalated-dev/escalated-wordpress) en [Filament](https://github.com/escalated-dev/escalated-filament). De UI staat in [escalated](https://github.com/escalated-dev/escalated).

## Licentie

MIT. Copyright (c) Escalated.dev. Zie [LICENSE](../../LICENSE).
