<p align="center"><sub>
  <a href="README.ar.md">العربية</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="../../README.md">English</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.it.md">Italiano</a> ·
  <b>日本語</b> ·
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
  AdonisJS アプリに本格的なヘルプデスクを追加できます。<br>
  チケット、SLA、エスカレーションルール、エージェント用の受信トレイ、カスタマーポータルが、あなた自身のデータベース上で動きます。
</p>

<p align="center">
  <a href="https://escalated.dev"><b>ウェブサイト</b></a> ·
  <a href="https://escalated.dev/docs"><b>ドキュメント</b></a> ·
  <a href="https://escalated.dev/cloud"><b>Cloud</b></a> ·
  <a href="../../CHANGELOG.md"><b>変更履歴</b></a>
</p>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-dark.png">
  <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-light.png" alt="Escalated のエージェント受信トレイ: 件数付きの保存済みビュー、各チケットの SLA カウントダウンと優先度" width="100%">
</picture>

## できること

<table>
  <tr>
    <td width="40%">
      <h3>エージェントが一日中作業できる受信トレイ</h3>
      会話、内部メモ、定型返信、SLA タイマーを一つの画面にまとめています。チケットは Mailgun、Postmark、SES 経由のメールでも届きます。
    </td>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-light.png" alt="エージェントワークスペースで開いたチケットと返信エディター">
      </picture>
    </td>
  </tr>
  <tr>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-light.png" alt="応答時間、CSAT、SLA 違反を表示する管理画面のレポートページ">
      </picture>
    </td>
    <td width="40%">
      <h3>目に見える SLA とエスカレーションルール</h3>
      営業時間を考慮した優先度ごとの応答目標と解決目標、目標を外れたときにエスカレーションや再割り当てを行うルール、そして違反のレポート。
    </td>
  </tr>
</table>

## 機能

<table>
<tr>
<td width="33%" valign="top">

**チケット**
- 作成、更新、クローズ、再オープン
- 固定メモ付きのスレッド返信
- 分割、マージ、リンク、スヌーズ
- チケット上のサイドカンバセーション
- すべての変更のアクティビティログ

</td>
<td width="33%" valign="top">

**エージェントワークスペース**
- クイックフィルターと保存済みビュー
- ステータス、優先度、担当者の一括変更
- マクロと定型返信
- 部署、タグ、フォロワー
- 誰がチケットを見ているかを表示

</td>
<td width="33%" valign="top">

**SLA と自動化**
- 初回応答と解決の目標
- 違反の検知と警告
- スケジュール実行のエスカレーションルール
- 条件付きの自動化ルール

</td>
</tr>
<tr>
<td width="33%" valign="top">

**顧客**
- カスタマーポータルとダッシュボード
- トークンでアクセスするゲストチケット
- メールで届くコードによるゲストアクセスの確認
- ナレッジベース検索付きの埋め込みウィジェット
- ナレッジベース (オン/オフ切り替え可)
- 解決後の CSAT 評価

</td>
<td width="33%" valign="top">

**メール**
- Mailgun、Postmark、SES 経由の受信
- メールクライアントで正しくスレッド表示
- ブランドに合わせたテンプレート

</td>
<td width="33%" valign="top">

**管理とアクセス**
- 顧客、エージェント、管理者のロール
- 任意のロールと権限
- 任意の SSO: SAML、OAuth 2、OIDC、JWT
- データベースに保存される設定
- 期限付きの非公開添付ファイルリンク

</td>
</tr>
<tr>
<td width="33%" valign="top">

**連携**
- 配信ログ付きの署名済み Webhook
- スコープ付きトークンの REST API
- 同一プロセスで動く TypeScript プラグイン
- データの一括インポート

</td>
<td width="33%" valign="top">

**リアルタイム**
- Transmit によるブロードキャスト
- オフのときはポーリングで代替

</td>
<td width="33%" valign="top">

**言語**
- 共有ロケールパッケージの文字列
- ホストごとの上書き

</td>
</tr>
</table>

<p align="center"><sub><a href="../features.md">すべての機能の詳細</a></sub></p>

<p align="center">
  <a href="https://adonisjs.com"><img src="https://img.shields.io/badge/AdonisJS_7-5A45FF?style=for-the-badge&logo=adonisjs&logoColor=white" alt="AdonisJS 7"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js_24+-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 24+"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://inertiajs.com"><img src="https://img.shields.io/badge/Inertia-9553E9?style=for-the-badge&logo=inertia&logoColor=white" alt="Inertia"></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue 3"></a>
</p>

## クイックスタート

```bash
npm install @escalated-dev/escalated-adonis
npm install @escalated-dev/escalated
node ace configure @escalated-dev/escalated-adonis
node ace migration:run
```

その後 `/support` にアクセスしてください。AdonisJS v7 と Node.js 24 以上が必要です。ほかに必要な Adonis パッケージは[スタートガイド](../getting-started.md)に、SLA とエスカレーションを実行するスケジュールコマンドは[設定](../configuration.md)に載っています。

## 詳しく知る

- [すべての機能](../features.md) · [はじめに](../getting-started.md) · [設定とスケジュールコマンド](../configuration.md)
- [アーキテクチャ、ページ、ルート、イベント](../architecture.md) · [カスタマイズ](../customization.md)
- [アクセス制御](../access-control.md) · [SSO](../sso.md) · [チケットのアクセスとルーティング](../ticket-access-and-routing.md)
- [受信メール](../inbound-email.md) · [ウィジェットの埋め込み](../embedding-the-widget.md) · [ゲストアクセス](../guest-access.md) · [非公開の添付ファイル](../private-attachments.md)
- [エージェントパネル](../agent-panel.md) · [管理画面の埋め込み](../embedding-admin.md)
- [プラグイン SDK](../plugin-sdk.md) · [プラグイン](../plugins.md) · [ニュースレター](../newsletters.md) · [依存関係のセキュリティ](../dependency-security.md)

Escalated は [Laravel](https://github.com/escalated-dev/escalated-laravel)、[Rails](https://github.com/escalated-dev/escalated-rails)、[Django](https://github.com/escalated-dev/escalated-django)、[NestJS](https://github.com/escalated-dev/escalated-nestjs)、[Symfony](https://github.com/escalated-dev/escalated-symfony)、[Phoenix](https://github.com/escalated-dev/escalated-phoenix)、[Go](https://github.com/escalated-dev/escalated-go)、[.NET](https://github.com/escalated-dev/escalated-dotnet)、[Spring](https://github.com/escalated-dev/escalated-spring)、[WordPress](https://github.com/escalated-dev/escalated-wordpress)、[Filament](https://github.com/escalated-dev/escalated-filament) 向けにも提供しています。UI は [escalated](https://github.com/escalated-dev/escalated) にあります。

## ライセンス

MIT。Copyright (c) Escalated.dev。詳細は [LICENSE](../../LICENSE) を参照してください。
