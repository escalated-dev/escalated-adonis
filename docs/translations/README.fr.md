<p align="center"><sub>
  <a href="README.ar.md">العربية</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="../../README.md">English</a> ·
  <a href="README.es.md">Español</a> ·
  <b>Français</b> ·
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
  Ajoutez un helpdesk complet à votre application AdonisJS.<br>
  Tickets, SLA, règles d'escalade, une boîte de réception pour les agents et un portail client, sur votre propre base de données.
</p>

<p align="center">
  <a href="https://escalated.dev"><b>Site web</b></a> ·
  <a href="https://escalated.dev/docs"><b>Documentation</b></a> ·
  <a href="https://escalated.dev/cloud"><b>Cloud</b></a> ·
  <a href="../../CHANGELOG.md"><b>Journal des modifications</b></a>
</p>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-dark.png">
  <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-light.png" alt="La boîte de réception des agents d'Escalated : vues enregistrées avec compteurs, comptes à rebours SLA et priorités sur chaque ticket" width="100%">
</picture>

## Ce qu'il fait

<table>
  <tr>
    <td width="40%">
      <h3>Une boîte de réception où vos agents peuvent travailler toute la journée</h3>
      Conversation, notes internes, réponses types et minuteurs SLA sur un seul écran. Les tickets arrivent aussi par e-mail via Mailgun, Postmark ou SES.
    </td>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-light.png" alt="Un ticket ouvert dans l'espace de travail de l'agent avec l'éditeur de réponse">
      </picture>
    </td>
  </tr>
  <tr>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-light.png" alt="La page des rapports d'administration avec les temps de réponse, le CSAT et les dépassements de SLA">
      </picture>
    </td>
    <td width="40%">
      <h3>Des SLA et des règles d'escalade visibles</h3>
      Des objectifs de réponse et de résolution par priorité avec horaires d'ouverture, des règles qui escaladent ou réattribuent en cas de retard, et des rapports sur les dépassements.
    </td>
  </tr>
</table>

## Fonctionnalités

<table>
<tr>
<td width="33%" valign="top">

**Tickets**
- Créer, mettre à jour, fermer et rouvrir
- Réponses en fil avec notes épinglées
- Scinder, fusionner, lier et mettre en attente
- Conversations annexes sur un ticket
- Journal d'activité de chaque modification

</td>
<td width="33%" valign="top">

**Espace de travail de l'agent**
- Filtres rapides et vues enregistrées
- Statut, priorité et attribution en masse
- Macros et réponses types
- Services, tags et abonnés
- Voir qui consulte un ticket

</td>
<td width="33%" valign="top">

**SLA et automatisation**
- Objectifs de première réponse et de résolution
- Détection des dépassements et alertes
- Règles d'escalade planifiées
- Règles d'automatisation avec conditions

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Clients**
- Portail et tableau de bord client
- Tickets invités avec accès par jeton
- Accès invité vérifié par code envoyé par e-mail
- Widget intégrable avec recherche dans la base de connaissances
- Base de connaissances, activable ou non
- Notes CSAT après résolution

</td>
<td width="33%" valign="top">

**E-mail**
- Réception via Mailgun, Postmark, SES
- Fils de discussion corrects dans les clients mail
- Modèles à votre image

</td>
<td width="33%" valign="top">

**Administration et accès**
- Rôles client, agent et administrateur
- Rôles et permissions optionnels
- SSO optionnel : SAML, OAuth 2, OIDC, JWT
- Paramètres stockés en base de données
- Liens privés vers les pièces jointes, avec expiration

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Intégrations**
- Webhooks signés avec journal de livraison
- API REST avec jetons à portée limitée
- Plugins TypeScript dans le même processus
- Import de données en masse

</td>
<td width="33%" valign="top">

**Temps réel**
- Diffusion via Transmit
- Repli sur le polling quand elle est désactivée

</td>
<td width="33%" valign="top">

**Langues**
- Textes issus du paquet de traductions partagé
- Surcharges par hôte

</td>
</tr>
</table>

<p align="center"><sub><a href="../features.md">Chaque fonctionnalité en détail</a></sub></p>

<p align="center">
  <a href="https://adonisjs.com"><img src="https://img.shields.io/badge/AdonisJS_7-5A45FF?style=for-the-badge&logo=adonisjs&logoColor=white" alt="AdonisJS 7"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js_24+-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 24+"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://inertiajs.com"><img src="https://img.shields.io/badge/Inertia-9553E9?style=for-the-badge&logo=inertia&logoColor=white" alt="Inertia"></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue 3"></a>
</p>

## Démarrage rapide

```bash
npm install @escalated-dev/escalated-adonis
npm install @escalated-dev/escalated
node ace configure @escalated-dev/escalated-adonis
node ace migration:run
```

Ouvrez ensuite `/support`. Nécessite AdonisJS v7 et Node.js 24+. Le [guide de démarrage](../getting-started.md) liste les autres paquets Adonis nécessaires, et la [configuration](../configuration.md) décrit les commandes planifiées qui font tourner les SLA et les escalades.

## En savoir plus

- [Toutes les fonctionnalités](../features.md) · [Premiers pas](../getting-started.md) · [Configuration et commandes planifiées](../configuration.md)
- [Architecture, pages, routes et événements](../architecture.md) · [Personnalisation](../customization.md)
- [Contrôle d'accès](../access-control.md) · [SSO](../sso.md) · [Accès aux tickets et routage](../ticket-access-and-routing.md)
- [E-mail entrant](../inbound-email.md) · [Intégrer le widget](../embedding-the-widget.md) · [Accès invité](../guest-access.md) · [Pièces jointes privées](../private-attachments.md)
- [Panneau agent](../agent-panel.md) · [Intégrer l'administration](../embedding-admin.md)
- [SDK de plugins](../plugin-sdk.md) · [Plugins](../plugins.md) · [Newsletters](../newsletters.md) · [Sécurité des dépendances](../dependency-security.md)

Escalated est aussi disponible pour [Laravel](https://github.com/escalated-dev/escalated-laravel), [Rails](https://github.com/escalated-dev/escalated-rails), [Django](https://github.com/escalated-dev/escalated-django), [NestJS](https://github.com/escalated-dev/escalated-nestjs), [Symfony](https://github.com/escalated-dev/escalated-symfony), [Phoenix](https://github.com/escalated-dev/escalated-phoenix), [Go](https://github.com/escalated-dev/escalated-go), [.NET](https://github.com/escalated-dev/escalated-dotnet), [Spring](https://github.com/escalated-dev/escalated-spring), [WordPress](https://github.com/escalated-dev/escalated-wordpress) et [Filament](https://github.com/escalated-dev/escalated-filament). L'interface se trouve dans [escalated](https://github.com/escalated-dev/escalated).

## Licence

MIT. Copyright (c) Escalated.dev. Voir [LICENSE](../../LICENSE).
