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
  <b>Português (BR)</b> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.zh-CN.md">简体中文</a>
</sub></p>

<p align="center">
  <a href="https://escalated.dev"><img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/logo.png" width="72" height="72" alt="Escalated"></a>
</p>

<h1 align="center">Escalated for AdonisJS</h1>

<p align="center">
  Adicione um helpdesk completo ao seu app AdonisJS.<br>
  Tickets, SLAs, regras de escalonamento, uma caixa de entrada para agentes e um portal do cliente, rodando no seu próprio banco de dados.
</p>

<p align="center">
  <a href="https://escalated.dev"><b>Site</b></a> ·
  <a href="https://escalated.dev/docs"><b>Documentação</b></a> ·
  <a href="https://escalated.dev/cloud"><b>Cloud</b></a> ·
  <a href="../../CHANGELOG.md"><b>Histórico de mudanças</b></a>
</p>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-dark.png">
  <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-light.png" alt="A caixa de entrada dos agentes no Escalated: visualizações salvas com contadores, contagens regressivas de SLA e prioridades em cada ticket" width="100%">
</picture>

## O que ele faz

<table>
  <tr>
    <td width="40%">
      <h3>Uma caixa de entrada em que seus agentes podem trabalhar o dia todo</h3>
      Conversa, notas internas, respostas prontas e cronômetros de SLA em uma tela só. Os tickets também chegam por e-mail via Mailgun, Postmark ou SES.
    </td>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-light.png" alt="Um ticket aberto no espaço de trabalho do agente com o editor de resposta">
      </picture>
    </td>
  </tr>
  <tr>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-light.png" alt="A página de relatórios do admin com tempos de resposta, CSAT e violações de SLA">
      </picture>
    </td>
    <td width="40%">
      <h3>SLAs e regras de escalonamento que você consegue ver</h3>
      Metas de resposta e resolução por prioridade com horário comercial, regras que escalonam ou reatribuem quando as metas não são cumpridas, e relatórios de violações.
    </td>
  </tr>
</table>

## Recursos

<table>
<tr>
<td width="33%" valign="top">

**Tickets**
- Criar, atualizar, fechar e reabrir
- Respostas em thread com notas fixadas
- Dividir, mesclar, vincular e adiar
- Conversas paralelas em um ticket
- Log de atividade de cada alteração

</td>
<td width="33%" valign="top">

**Espaço de trabalho do agente**
- Filtros rápidos e visualizações salvas
- Status, prioridade e atribuição em massa
- Macros e respostas prontas
- Departamentos, tags e seguidores
- Veja quem está vendo um ticket

</td>
<td width="33%" valign="top">

**SLAs e automação**
- Metas de primeira resposta e de resolução
- Detecção de violações e alertas
- Regras de escalonamento agendadas
- Regras de automação com condições

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Clientes**
- Portal e painel do cliente
- Tickets de convidados com acesso por token
- Acesso de convidado verificado por código enviado por e-mail
- Widget incorporável com busca na base de conhecimento
- Base de conhecimento, ligada ou desligada
- Avaliações CSAT após a resolução

</td>
<td width="33%" valign="top">

**E-mail**
- Entrada via Mailgun, Postmark, SES
- Threads corretas nos clientes de e-mail
- Templates com a sua marca

</td>
<td width="33%" valign="top">

**Admin e acesso**
- Papéis de cliente, agente e admin
- Papéis e permissões opcionais
- SSO opcional: SAML, OAuth 2, OIDC, JWT
- Configurações salvas no banco de dados
- Links privados para anexos, com expiração

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Integrações**
- Webhooks assinados com log de entregas
- API REST com tokens de escopo limitado
- Plugins TypeScript no mesmo processo
- Importação de dados em massa

</td>
<td width="33%" valign="top">

**Tempo real**
- Broadcasting via Transmit
- Polling como alternativa quando está desligado

</td>
<td width="33%" valign="top">

**Idiomas**
- Textos do pacote de traduções compartilhado
- Substituições por host

</td>
</tr>
</table>

<p align="center"><sub><a href="../features.md">Cada recurso em detalhes</a></sub></p>

<p align="center">
  <a href="https://adonisjs.com"><img src="https://img.shields.io/badge/AdonisJS_7-5A45FF?style=for-the-badge&logo=adonisjs&logoColor=white" alt="AdonisJS 7"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js_24+-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 24+"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://inertiajs.com"><img src="https://img.shields.io/badge/Inertia-9553E9?style=for-the-badge&logo=inertia&logoColor=white" alt="Inertia"></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue 3"></a>
</p>

## Início rápido

```bash
npm install @escalated-dev/escalated-adonis
npm install @escalated-dev/escalated
node ace configure @escalated-dev/escalated-adonis
node ace migration:run
```

Depois acesse `/support`. Requer AdonisJS v7 e Node.js 24+. O [guia de primeiros passos](../getting-started.md) lista os outros pacotes Adonis necessários, e a [configuração](../configuration.md) explica os comandos agendados que executam SLAs e escalonamentos.

## Saiba mais

- [Todos os recursos](../features.md) · [Primeiros passos](../getting-started.md) · [Configuração e comandos agendados](../configuration.md)
- [Arquitetura, páginas, rotas e eventos](../architecture.md) · [Personalização](../customization.md)
- [Controle de acesso](../access-control.md) · [SSO](../sso.md) · [Acesso a tickets e roteamento](../ticket-access-and-routing.md)
- [E-mail de entrada](../inbound-email.md) · [Incorporar o widget](../embedding-the-widget.md) · [Acesso de convidados](../guest-access.md) · [Anexos privados](../private-attachments.md)
- [Painel do agente](../agent-panel.md) · [Incorporar o admin](../embedding-admin.md)
- [SDK de plugins](../plugin-sdk.md) · [Plugins](../plugins.md) · [Newsletters](../newsletters.md) · [Segurança de dependências](../dependency-security.md)

O Escalated também está disponível para [Laravel](https://github.com/escalated-dev/escalated-laravel), [Rails](https://github.com/escalated-dev/escalated-rails), [Django](https://github.com/escalated-dev/escalated-django), [NestJS](https://github.com/escalated-dev/escalated-nestjs), [Symfony](https://github.com/escalated-dev/escalated-symfony), [Phoenix](https://github.com/escalated-dev/escalated-phoenix), [Go](https://github.com/escalated-dev/escalated-go), [.NET](https://github.com/escalated-dev/escalated-dotnet), [Spring](https://github.com/escalated-dev/escalated-spring), [WordPress](https://github.com/escalated-dev/escalated-wordpress) e [Filament](https://github.com/escalated-dev/escalated-filament). A interface fica em [escalated](https://github.com/escalated-dev/escalated).

## Licença

MIT. Copyright (c) Escalated.dev. Veja [LICENSE](../../LICENSE).
