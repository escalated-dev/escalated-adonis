<p align="center"><sub>
  <a href="README.ar.md">العربية</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="../../README.md">English</a> ·
  <b>Español</b> ·
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
  Añade un helpdesk completo a tu aplicación AdonisJS.<br>
  Tickets, SLA, reglas de escalado, una bandeja de entrada para agentes y un portal de clientes, funcionando en tu propia base de datos.
</p>

<p align="center">
  <a href="https://escalated.dev"><b>Sitio web</b></a> ·
  <a href="https://escalated.dev/docs"><b>Documentación</b></a> ·
  <a href="https://escalated.dev/cloud"><b>Cloud</b></a> ·
  <a href="../../CHANGELOG.md"><b>Registro de cambios</b></a>
</p>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-dark.png">
  <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-light.png" alt="La bandeja de entrada de agentes de Escalated: vistas guardadas con contadores, cuentas atrás de SLA y prioridades en cada ticket" width="100%">
</picture>

## Qué hace

<table>
  <tr>
    <td width="40%">
      <h3>Una bandeja de entrada en la que tus agentes pueden trabajar todo el día</h3>
      Conversación, notas internas, respuestas predefinidas y temporizadores de SLA en una sola pantalla. Los tickets también llegan por correo a través de Mailgun, Postmark o SES.
    </td>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-light.png" alt="Un ticket abierto en el espacio de trabajo del agente con el editor de respuestas">
      </picture>
    </td>
  </tr>
  <tr>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-light.png" alt="La página de informes de administración con tiempos de respuesta, CSAT e incumplimientos de SLA">
      </picture>
    </td>
    <td width="40%">
      <h3>SLA y reglas de escalado que puedes ver</h3>
      Objetivos de respuesta y resolución por prioridad con horario laboral, reglas que escalan o reasignan cuando no se cumplen, e informes de incumplimientos.
    </td>
  </tr>
</table>

## Funciones

<table>
<tr>
<td width="33%" valign="top">

**Tickets**
- Crear, actualizar, cerrar y reabrir
- Respuestas en hilo con notas fijadas
- Dividir, fusionar, vincular y posponer
- Conversaciones paralelas en un ticket
- Registro de actividad de cada cambio

</td>
<td width="33%" valign="top">

**Espacio de trabajo del agente**
- Filtros rápidos y vistas guardadas
- Estado, prioridad y asignación en bloque
- Macros y respuestas predefinidas
- Departamentos, etiquetas y seguidores
- Ve quién está viendo un ticket

</td>
<td width="33%" valign="top">

**SLA y automatización**
- Objetivos de primera respuesta y resolución
- Detección de incumplimientos y avisos
- Reglas de escalado programadas
- Reglas de automatización con condiciones

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Clientes**
- Portal y panel del cliente
- Tickets de invitados con acceso por token
- Acceso de invitado verificado con código por correo
- Widget integrable con búsqueda en la base de conocimiento
- Base de conocimiento, activada o desactivada
- Valoraciones CSAT tras la resolución

</td>
<td width="33%" valign="top">

**Correo**
- Entrada vía Mailgun, Postmark, SES
- Hilos correctos en los clientes de correo
- Plantillas con tu marca

</td>
<td width="33%" valign="top">

**Administración y acceso**
- Roles de cliente, agente y administrador
- Roles y permisos opcionales
- SSO opcional: SAML, OAuth 2, OIDC, JWT
- Ajustes guardados en la base de datos
- Enlaces privados a adjuntos que caducan

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Integraciones**
- Webhooks firmados con registro de entregas
- API REST con tokens de alcance limitado
- Plugins de TypeScript en el mismo proceso
- Importación masiva de datos

</td>
<td width="33%" valign="top">

**Tiempo real**
- Broadcasting vía Transmit
- Polling como alternativa cuando está desactivado

</td>
<td width="33%" valign="top">

**Idiomas**
- Textos del paquete de traducciones compartido
- Sobrescrituras por host

</td>
</tr>
</table>

<p align="center"><sub><a href="../features.md">Cada función en detalle</a></sub></p>

<p align="center">
  <a href="https://adonisjs.com"><img src="https://img.shields.io/badge/AdonisJS_7-5A45FF?style=for-the-badge&logo=adonisjs&logoColor=white" alt="AdonisJS 7"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js_24+-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 24+"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://inertiajs.com"><img src="https://img.shields.io/badge/Inertia-9553E9?style=for-the-badge&logo=inertia&logoColor=white" alt="Inertia"></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue 3"></a>
</p>

## Inicio rápido

```bash
npm install @escalated-dev/escalated-adonis
npm install @escalated-dev/escalated
node ace configure @escalated-dev/escalated-adonis
node ace migration:run
```

Después visita `/support`. Requiere AdonisJS v7 y Node.js 24+. La [guía de primeros pasos](../getting-started.md) enumera los demás paquetes de Adonis que necesita, y la [configuración](../configuration.md) explica los comandos programados que ejecutan los SLA y las escalaciones.

## Más información

- [Todas las funciones](../features.md) · [Primeros pasos](../getting-started.md) · [Configuración y comandos programados](../configuration.md)
- [Arquitectura, páginas, rutas y eventos](../architecture.md) · [Personalización](../customization.md)
- [Control de acceso](../access-control.md) · [SSO](../sso.md) · [Acceso a tickets y enrutamiento](../ticket-access-and-routing.md)
- [Correo entrante](../inbound-email.md) · [Integrar el widget](../embedding-the-widget.md) · [Acceso de invitados](../guest-access.md) · [Adjuntos privados](../private-attachments.md)
- [Panel del agente](../agent-panel.md) · [Integrar la administración](../embedding-admin.md)
- [SDK de plugins](../plugin-sdk.md) · [Plugins](../plugins.md) · [Boletines](../newsletters.md) · [Seguridad de dependencias](../dependency-security.md)

Escalated también está disponible para [Laravel](https://github.com/escalated-dev/escalated-laravel), [Rails](https://github.com/escalated-dev/escalated-rails), [Django](https://github.com/escalated-dev/escalated-django), [NestJS](https://github.com/escalated-dev/escalated-nestjs), [Symfony](https://github.com/escalated-dev/escalated-symfony), [Phoenix](https://github.com/escalated-dev/escalated-phoenix), [Go](https://github.com/escalated-dev/escalated-go), [.NET](https://github.com/escalated-dev/escalated-dotnet), [Spring](https://github.com/escalated-dev/escalated-spring), [WordPress](https://github.com/escalated-dev/escalated-wordpress) y [Filament](https://github.com/escalated-dev/escalated-filament). La interfaz está en [escalated](https://github.com/escalated-dev/escalated).

## Licencia

MIT. Copyright (c) Escalated.dev. Consulta [LICENSE](../../LICENSE).
