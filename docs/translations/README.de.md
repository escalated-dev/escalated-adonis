<p align="center"><sub>
  <a href="README.ar.md">العربية</a> ·
  <b>Deutsch</b> ·
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
  <a href="README.zh-CN.md">简体中文</a>
</sub></p>

<p align="center">
  <a href="https://escalated.dev"><img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/logo.png" width="72" height="72" alt="Escalated"></a>
</p>

<h1 align="center">Escalated for AdonisJS</h1>

<p align="center">
  Füge deiner AdonisJS-App einen vollständigen Helpdesk hinzu.<br>
  Tickets, SLAs, Eskalationsregeln, ein Agenten-Posteingang und ein Kundenportal, direkt auf deiner eigenen Datenbank.
</p>

<p align="center">
  <a href="https://escalated.dev"><b>Website</b></a> ·
  <a href="https://escalated.dev/docs"><b>Dokumentation</b></a> ·
  <a href="https://escalated.dev/cloud"><b>Cloud</b></a> ·
  <a href="../../CHANGELOG.md"><b>Änderungsprotokoll</b></a>
</p>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-dark.png">
  <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-light.png" alt="Der Agenten-Posteingang von Escalated: gespeicherte Ansichten mit Zählern, SLA-Countdowns und Prioritäten an jedem Ticket" width="100%">
</picture>

## Was es kann

<table>
  <tr>
    <td width="40%">
      <h3>Ein Posteingang, in dem deine Agenten den ganzen Tag arbeiten können</h3>
      Konversation, interne Notizen, Textbausteine und SLA-Timer auf einem Bildschirm. Tickets kommen auch per E-Mail über Mailgun, Postmark oder SES an.
    </td>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-light.png" alt="Ein geöffnetes Ticket im Agenten-Arbeitsbereich mit dem Antwort-Editor">
      </picture>
    </td>
  </tr>
  <tr>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-light.png" alt="Die Berichtsseite im Adminbereich mit Antwortzeiten, CSAT und SLA-Verstößen">
      </picture>
    </td>
    <td width="40%">
      <h3>SLAs und Eskalationsregeln, die du im Blick hast</h3>
      Reaktions- und Lösungsziele pro Priorität mit Geschäftszeiten, Regeln, die eskalieren oder neu zuweisen, wenn ein Ziel verfehlt wird, und Berichte über Verstöße.
    </td>
  </tr>
</table>

## Funktionen

<table>
<tr>
<td width="33%" valign="top">

**Tickets**
- Erstellen, aktualisieren, schließen und wieder öffnen
- Antworten im Verlauf mit angehefteten Notizen
- Aufteilen, zusammenführen, verknüpfen und zurückstellen
- Nebenkonversationen an einem Ticket
- Aktivitätsprotokoll jeder Änderung

</td>
<td width="33%" valign="top">

**Agenten-Arbeitsbereich**
- Schnellfilter und gespeicherte Ansichten
- Status, Priorität und Zuweisung als Sammelaktion
- Makros und Textbausteine
- Abteilungen, Tags und Follower
- Sehen, wer ein Ticket gerade ansieht

</td>
<td width="33%" valign="top">

**SLAs und Automatisierung**
- Ziele für erste Antwort und Lösung
- Erkennung von Verstößen und Warnungen
- Eskalationsregeln nach Zeitplan
- Automatisierungsregeln mit Bedingungen

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Kunden**
- Kundenportal und Dashboard
- Gast-Tickets mit Token-Zugang
- Verifizierter Gastzugang per E-Mail-Code
- Einbettbares Widget mit Suche in der Wissensdatenbank
- Wissensdatenbank, an- oder abschaltbar
- CSAT-Bewertungen nach der Lösung

</td>
<td width="33%" valign="top">

**E-Mail**
- Eingang über Mailgun, Postmark, SES
- Korrektes Threading in Mail-Clients
- Vorlagen in deinem Branding

</td>
<td width="33%" valign="top">

**Admin und Zugriff**
- Rollen für Kunden, Agenten und Admins
- Optionale Rollen und Berechtigungen
- Optionales SSO: SAML, OAuth 2, OIDC, JWT
- Einstellungen in der Datenbank gespeichert
- Private, ablaufende Links zu Anhängen

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Integrationen**
- Signierte Webhooks mit Zustellprotokoll
- REST-API mit eingeschränkten Tokens
- TypeScript-Plugins im selben Prozess
- Massenimport von Daten

</td>
<td width="33%" valign="top">

**Echtzeit**
- Broadcasting über Transmit
- Polling als Fallback, wenn es aus ist

</td>
<td width="33%" valign="top">

**Sprachen**
- Texte aus dem gemeinsamen Locale-Paket
- Überschreibungen pro Host

</td>
</tr>
</table>

<p align="center"><sub><a href="../features.md">Alle Funktionen im Detail</a></sub></p>

<p align="center">
  <a href="https://adonisjs.com"><img src="https://img.shields.io/badge/AdonisJS_7-5A45FF?style=for-the-badge&logo=adonisjs&logoColor=white" alt="AdonisJS 7"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js_24+-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 24+"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://inertiajs.com"><img src="https://img.shields.io/badge/Inertia-9553E9?style=for-the-badge&logo=inertia&logoColor=white" alt="Inertia"></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue 3"></a>
</p>

## Schnellstart

```bash
npm install @escalated-dev/escalated-adonis
npm install @escalated-dev/escalated
node ace configure @escalated-dev/escalated-adonis
node ace migration:run
```

Rufe danach `/support` auf. Voraussetzungen: AdonisJS v7 und Node.js 24+. Die [Einstiegsanleitung](../getting-started.md) listet die weiteren Adonis-Pakete auf, die du brauchst, und die [Konfiguration](../configuration.md) beschreibt die geplanten Befehle, die SLAs und Eskalationen ausführen.

## Mehr erfahren

- [Alle Funktionen](../features.md) · [Erste Schritte](../getting-started.md) · [Konfiguration und geplante Befehle](../configuration.md)
- [Architektur, Seiten, Routen und Events](../architecture.md) · [Anpassung](../customization.md)
- [Zugriffskontrolle](../access-control.md) · [SSO](../sso.md) · [Ticketzugriff und Routing](../ticket-access-and-routing.md)
- [Eingehende E-Mails](../inbound-email.md) · [Widget einbetten](../embedding-the-widget.md) · [Gastzugang](../guest-access.md) · [Private Anhänge](../private-attachments.md)
- [Agenten-Panel](../agent-panel.md) · [Admin einbetten](../embedding-admin.md)
- [Plugin-SDK](../plugin-sdk.md) · [Plugins](../plugins.md) · [Newsletter](../newsletters.md) · [Sicherheit der Abhängigkeiten](../dependency-security.md)

Escalated gibt es auch für [Laravel](https://github.com/escalated-dev/escalated-laravel), [Rails](https://github.com/escalated-dev/escalated-rails), [Django](https://github.com/escalated-dev/escalated-django), [NestJS](https://github.com/escalated-dev/escalated-nestjs), [Symfony](https://github.com/escalated-dev/escalated-symfony), [Phoenix](https://github.com/escalated-dev/escalated-phoenix), [Go](https://github.com/escalated-dev/escalated-go), [.NET](https://github.com/escalated-dev/escalated-dotnet), [Spring](https://github.com/escalated-dev/escalated-spring), [WordPress](https://github.com/escalated-dev/escalated-wordpress) und [Filament](https://github.com/escalated-dev/escalated-filament). Die Oberfläche liegt in [escalated](https://github.com/escalated-dev/escalated).

## Lizenz

MIT. Copyright (c) Escalated.dev. Siehe [LICENSE](../../LICENSE).
