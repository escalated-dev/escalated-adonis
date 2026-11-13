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
  <b>Русский</b> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.zh-CN.md">简体中文</a>
</sub></p>

<p align="center">
  <a href="https://escalated.dev"><img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/logo.png" width="72" height="72" alt="Escalated"></a>
</p>

<h1 align="center">Escalated for AdonisJS</h1>

<p align="center">
  Добавьте полноценный хелпдеск в ваше приложение на AdonisJS.<br>
  Тикеты, SLA, правила эскалации, входящие для агентов и клиентский портал, на вашей собственной базе данных.
</p>

<p align="center">
  <a href="https://escalated.dev"><b>Сайт</b></a> ·
  <a href="https://escalated.dev/docs"><b>Документация</b></a> ·
  <a href="https://escalated.dev/cloud"><b>Cloud</b></a> ·
  <a href="../../CHANGELOG.md"><b>Список изменений</b></a>
</p>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-dark.png">
  <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-light.png" alt="Входящие агентов в Escalated: сохранённые представления со счётчиками, обратный отсчёт SLA и приоритеты у каждого тикета" width="100%">
</picture>

## Что он делает

<table>
  <tr>
    <td width="40%">
      <h3>Входящие, в которых агенты могут работать весь день</h3>
      Переписка, внутренние заметки, шаблоны ответов и таймеры SLA на одном экране. Тикеты также приходят по почте через Mailgun, Postmark или SES.
    </td>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-light.png" alt="Тикет, открытый в рабочем пространстве агента, с редактором ответа">
      </picture>
    </td>
  </tr>
  <tr>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-light.png" alt="Страница отчётов в админке со временем ответа, CSAT и нарушениями SLA">
      </picture>
    </td>
    <td width="40%">
      <h3>SLA и правила эскалации на виду</h3>
      Цели по ответу и решению для каждого приоритета с учётом рабочих часов, правила, которые эскалируют или переназначают тикет при срыве сроков, и отчёты о нарушениях.
    </td>
  </tr>
</table>

## Возможности

<table>
<tr>
<td width="33%" valign="top">

**Тикеты**
- Создание, изменение, закрытие и повторное открытие
- Ответы в ветке с закреплёнными заметками
- Разделение, объединение, связывание и откладывание
- Побочные переписки в тикете
- Журнал всех изменений

</td>
<td width="33%" valign="top">

**Рабочее место агента**
- Быстрые фильтры и сохранённые представления
- Массовая смена статуса, приоритета и исполнителя
- Макросы и шаблоны ответов
- Отделы, теги и подписчики
- Видно, кто сейчас смотрит тикет

</td>
<td width="33%" valign="top">

**SLA и автоматизация**
- Цели по первому ответу и решению
- Обнаружение нарушений и предупреждения
- Правила эскалации по расписанию
- Правила автоматизации с условиями

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Клиенты**
- Клиентский портал и панель
- Гостевые тикеты с доступом по токену
- Подтверждённый гостевой доступ по коду из письма
- Встраиваемый виджет с поиском по базе знаний
- База знаний, включается и выключается
- Оценки CSAT после решения

</td>
<td width="33%" valign="top">

**Почта**
- Входящая почта через Mailgun, Postmark, SES
- Правильные цепочки писем в почтовых клиентах
- Шаблоны в вашем фирменном стиле

</td>
<td width="33%" valign="top">

**Администрирование и доступ**
- Роли клиента, агента и администратора
- Необязательные роли и права
- Необязательный SSO: SAML, OAuth 2, OIDC, JWT
- Настройки хранятся в базе данных
- Закрытые ссылки на вложения с ограниченным сроком

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Интеграции**
- Подписанные вебхуки с журналом доставки
- REST API с токенами ограниченной области
- Плагины на TypeScript в том же процессе
- Массовый импорт данных

</td>
<td width="33%" valign="top">

**Реальное время**
- Трансляция событий через Transmit
- Опрос (polling) как запасной вариант, если она выключена

</td>
<td width="33%" valign="top">

**Языки**
- Строки из общего пакета локализации
- Переопределения для каждого хоста

</td>
</tr>
</table>

<p align="center"><sub><a href="../features.md">Все возможности подробно</a></sub></p>

<p align="center">
  <a href="https://adonisjs.com"><img src="https://img.shields.io/badge/AdonisJS_7-5A45FF?style=for-the-badge&logo=adonisjs&logoColor=white" alt="AdonisJS 7"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js_24+-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 24+"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://inertiajs.com"><img src="https://img.shields.io/badge/Inertia-9553E9?style=for-the-badge&logo=inertia&logoColor=white" alt="Inertia"></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue 3"></a>
</p>

## Быстрый старт

```bash
npm install @escalated-dev/escalated-adonis
npm install @escalated-dev/escalated
node ace configure @escalated-dev/escalated-adonis
node ace migration:run
```

Затем откройте `/support`. Требуются AdonisJS v7 и Node.js 24+. В [руководстве по началу работы](../getting-started.md) перечислены другие нужные пакеты Adonis, а в разделе [конфигурация](../configuration.md) описаны команды по расписанию, которые обрабатывают SLA и эскалации.

## Подробнее

- [Все возможности](../features.md) · [Начало работы](../getting-started.md) · [Конфигурация и команды по расписанию](../configuration.md)
- [Архитектура, страницы, маршруты и события](../architecture.md) · [Настройка под себя](../customization.md)
- [Управление доступом](../access-control.md) · [SSO](../sso.md) · [Доступ к тикетам и маршрутизация](../ticket-access-and-routing.md)
- [Входящая почта](../inbound-email.md) · [Встраивание виджета](../embedding-the-widget.md) · [Гостевой доступ](../guest-access.md) · [Закрытые вложения](../private-attachments.md)
- [Панель агента](../agent-panel.md) · [Встраивание админки](../embedding-admin.md)
- [SDK плагинов](../plugin-sdk.md) · [Плагины](../plugins.md) · [Рассылки](../newsletters.md) · [Безопасность зависимостей](../dependency-security.md)

Escalated также доступен для [Laravel](https://github.com/escalated-dev/escalated-laravel), [Rails](https://github.com/escalated-dev/escalated-rails), [Django](https://github.com/escalated-dev/escalated-django), [NestJS](https://github.com/escalated-dev/escalated-nestjs), [Symfony](https://github.com/escalated-dev/escalated-symfony), [Phoenix](https://github.com/escalated-dev/escalated-phoenix), [Go](https://github.com/escalated-dev/escalated-go), [.NET](https://github.com/escalated-dev/escalated-dotnet), [Spring](https://github.com/escalated-dev/escalated-spring), [WordPress](https://github.com/escalated-dev/escalated-wordpress) и [Filament](https://github.com/escalated-dev/escalated-filament). Интерфейс находится в [escalated](https://github.com/escalated-dev/escalated).

## Лицензия

MIT. Copyright (c) Escalated.dev. См. [LICENSE](../../LICENSE).
