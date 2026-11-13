<p align="center"><sub>
  <a href="README.ar.md">العربية</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="../../README.md">English</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <b>Italiano</b> ·
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
  Aggiungi un helpdesk completo alla tua app AdonisJS.<br>
  Ticket, SLA, regole di escalation, una inbox per gli agenti e un portale clienti, sul tuo database.
</p>

<p align="center">
  <a href="https://escalated.dev"><b>Sito web</b></a> ·
  <a href="https://escalated.dev/docs"><b>Documentazione</b></a> ·
  <a href="https://escalated.dev/cloud"><b>Cloud</b></a> ·
  <a href="../../CHANGELOG.md"><b>Registro delle modifiche</b></a>
</p>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-dark.png">
  <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-light.png" alt="La inbox degli agenti di Escalated: viste salvate con contatori, conti alla rovescia SLA e priorità su ogni ticket" width="100%">
</picture>

## Cosa fa

<table>
  <tr>
    <td width="40%">
      <h3>Una inbox in cui i tuoi agenti possono lavorare tutto il giorno</h3>
      Conversazione, note interne, risposte predefinite e timer SLA in un'unica schermata. I ticket arrivano anche via email tramite Mailgun, Postmark o SES.
    </td>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-light.png" alt="Un ticket aperto nell'area di lavoro dell'agente con l'editor di risposta">
      </picture>
    </td>
  </tr>
  <tr>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-light.png" alt="La pagina dei report di amministrazione con tempi di risposta, CSAT e violazioni degli SLA">
      </picture>
    </td>
    <td width="40%">
      <h3>SLA e regole di escalation che puoi vedere</h3>
      Obiettivi di risposta e risoluzione per priorità con orari lavorativi, regole che eseguono l'escalation o riassegnano quando non vengono rispettati, e report sulle violazioni.
    </td>
  </tr>
</table>

## Funzionalità

<table>
<tr>
<td width="33%" valign="top">

**Ticket**
- Crea, aggiorna, chiudi e riapri
- Risposte in thread con note fissate
- Dividi, unisci, collega e posticipa
- Conversazioni laterali su un ticket
- Registro attività di ogni modifica

</td>
<td width="33%" valign="top">

**Area di lavoro dell'agente**
- Filtri rapidi e viste salvate
- Stato, priorità e assegnazione in blocco
- Macro e risposte predefinite
- Reparti, tag e follower
- Vedi chi sta guardando un ticket

</td>
<td width="33%" valign="top">

**SLA e automazione**
- Obiettivi di prima risposta e risoluzione
- Rilevamento delle violazioni e avvisi
- Regole di escalation pianificate
- Regole di automazione con condizioni

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Clienti**
- Portale e dashboard clienti
- Ticket ospite con accesso tramite token
- Accesso ospite verificato con codice via email
- Widget incorporabile con ricerca nella knowledge base
- Knowledge base, attivabile o no
- Valutazioni CSAT dopo la risoluzione

</td>
<td width="33%" valign="top">

**Email**
- In entrata via Mailgun, Postmark, SES
- Thread corretti nei client di posta
- Template con il tuo brand

</td>
<td width="33%" valign="top">

**Amministrazione e accesso**
- Ruoli cliente, agente e amministratore
- Ruoli e permessi opzionali
- SSO opzionale: SAML, OAuth 2, OIDC, JWT
- Impostazioni salvate nel database
- Link privati agli allegati con scadenza

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Integrazioni**
- Webhook firmati con registro delle consegne
- API REST con token a scope limitato
- Plugin TypeScript nello stesso processo
- Importazione di dati in blocco

</td>
<td width="33%" valign="top">

**Tempo reale**
- Broadcasting tramite Transmit
- Polling come alternativa quando è disattivato

</td>
<td width="33%" valign="top">

**Lingue**
- Testi dal pacchetto di traduzioni condiviso
- Override per singolo host

</td>
</tr>
</table>

<p align="center"><sub><a href="../features.md">Ogni funzionalità nel dettaglio</a></sub></p>

<p align="center">
  <a href="https://adonisjs.com"><img src="https://img.shields.io/badge/AdonisJS_7-5A45FF?style=for-the-badge&logo=adonisjs&logoColor=white" alt="AdonisJS 7"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js_24+-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 24+"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://inertiajs.com"><img src="https://img.shields.io/badge/Inertia-9553E9?style=for-the-badge&logo=inertia&logoColor=white" alt="Inertia"></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue 3"></a>
</p>

## Avvio rapido

```bash
npm install @escalated-dev/escalated-adonis
npm install @escalated-dev/escalated
node ace configure @escalated-dev/escalated-adonis
node ace migration:run
```

Poi visita `/support`. Richiede AdonisJS v7 e Node.js 24+. La [guida introduttiva](../getting-started.md) elenca gli altri pacchetti Adonis necessari, e la [configurazione](../configuration.md) spiega i comandi pianificati che gestiscono SLA ed escalation.

## Per saperne di più

- [Tutte le funzionalità](../features.md) · [Primi passi](../getting-started.md) · [Configurazione e comandi pianificati](../configuration.md)
- [Architettura, pagine, route ed eventi](../architecture.md) · [Personalizzazione](../customization.md)
- [Controllo degli accessi](../access-control.md) · [SSO](../sso.md) · [Accesso ai ticket e instradamento](../ticket-access-and-routing.md)
- [Email in entrata](../inbound-email.md) · [Incorporare il widget](../embedding-the-widget.md) · [Accesso ospite](../guest-access.md) · [Allegati privati](../private-attachments.md)
- [Pannello agente](../agent-panel.md) · [Incorporare l'amministrazione](../embedding-admin.md)
- [SDK dei plugin](../plugin-sdk.md) · [Plugin](../plugins.md) · [Newsletter](../newsletters.md) · [Sicurezza delle dipendenze](../dependency-security.md)

Escalated è disponibile anche per [Laravel](https://github.com/escalated-dev/escalated-laravel), [Rails](https://github.com/escalated-dev/escalated-rails), [Django](https://github.com/escalated-dev/escalated-django), [NestJS](https://github.com/escalated-dev/escalated-nestjs), [Symfony](https://github.com/escalated-dev/escalated-symfony), [Phoenix](https://github.com/escalated-dev/escalated-phoenix), [Go](https://github.com/escalated-dev/escalated-go), [.NET](https://github.com/escalated-dev/escalated-dotnet), [Spring](https://github.com/escalated-dev/escalated-spring), [WordPress](https://github.com/escalated-dev/escalated-wordpress) e [Filament](https://github.com/escalated-dev/escalated-filament). L'interfaccia si trova in [escalated](https://github.com/escalated-dev/escalated).

## Licenza

MIT. Copyright (c) Escalated.dev. Vedi [LICENSE](../../LICENSE).
