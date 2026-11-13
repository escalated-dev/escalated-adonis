<p align="center"><sub>
  <a href="README.ar.md">العربية</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="../../README.md">English</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.it.md">Italiano</a> ·
  <a href="README.ja.md">日本語</a> ·
  <b>한국어</b> ·
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
  AdonisJS 앱에 완전한 헬프데스크를 추가하세요.<br>
  티켓, SLA, 에스컬레이션 규칙, 상담원 받은편지함, 고객 포털이 여러분의 데이터베이스에서 동작합니다.
</p>

<p align="center">
  <a href="https://escalated.dev"><b>웹사이트</b></a> ·
  <a href="https://escalated.dev/docs"><b>문서</b></a> ·
  <a href="https://escalated.dev/cloud"><b>Cloud</b></a> ·
  <a href="../../CHANGELOG.md"><b>변경 내역</b></a>
</p>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-dark.png">
  <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/inbox-light.png" alt="Escalated 상담원 받은편지함: 개수가 표시된 저장된 보기, 모든 티켓의 SLA 카운트다운과 우선순위" width="100%">
</picture>

## 주요 기능

<table>
  <tr>
    <td width="40%">
      <h3>상담원이 하루 종일 일할 수 있는 받은편지함</h3>
      대화, 내부 메모, 미리 작성된 답변, SLA 타이머가 한 화면에 있습니다. 티켓은 Mailgun, Postmark, SES를 통해 이메일로도 들어옵니다.
    </td>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/ticket-light.png" alt="답장 작성기가 열린 상담원 작업 공간의 티켓">
      </picture>
    </td>
  </tr>
  <tr>
    <td width="60%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-dark.png">
        <img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/dashboard-light.png" alt="응답 시간, CSAT, SLA 위반을 보여 주는 관리자 보고서 페이지">
      </picture>
    </td>
    <td width="40%">
      <h3>한눈에 보이는 SLA와 에스컬레이션 규칙</h3>
      업무 시간을 반영한 우선순위별 응답 및 해결 목표, 목표를 놓치면 에스컬레이션하거나 재배정하는 규칙, 그리고 위반 보고서.
    </td>
  </tr>
</table>

## 기능 목록

<table>
<tr>
<td width="33%" valign="top">

**티켓**
- 생성, 수정, 종료, 재오픈
- 고정 메모가 있는 스레드형 답장
- 분할, 병합, 연결, 다시 알림
- 티켓 내 사이드 대화
- 모든 변경 사항의 활동 로그

</td>
<td width="33%" valign="top">

**상담원 작업 공간**
- 빠른 필터와 저장된 보기
- 상태, 우선순위, 배정 일괄 변경
- 매크로와 미리 작성된 답변
- 부서, 태그, 팔로워
- 누가 티켓을 보고 있는지 확인

</td>
<td width="33%" valign="top">

**SLA와 자동화**
- 첫 응답 및 해결 목표
- 위반 감지와 경고
- 일정에 따라 실행되는 에스컬레이션 규칙
- 조건 기반 자동화 규칙

</td>
</tr>
<tr>
<td width="33%" valign="top">

**고객**
- 고객 포털과 대시보드
- 토큰으로 접근하는 게스트 티켓
- 이메일 코드로 인증하는 게스트 접근
- 지식 베이스 검색이 포함된 임베드 위젯
- 지식 베이스 켜기/끄기
- 해결 후 CSAT 평가

</td>
<td width="33%" valign="top">

**이메일**
- Mailgun, Postmark, SES를 통한 수신
- 메일 클라이언트에서 올바른 스레드 표시
- 브랜드 템플릿

</td>
<td width="33%" valign="top">

**관리와 접근**
- 고객, 상담원, 관리자 역할
- 선택형 역할과 권한
- 선택형 SSO: SAML, OAuth 2, OIDC, JWT
- 데이터베이스에 저장되는 설정
- 만료되는 비공개 첨부 파일 링크

</td>
</tr>
<tr>
<td width="33%" valign="top">

**연동**
- 전송 로그가 있는 서명된 웹훅
- 범위가 지정된 토큰의 REST API
- 같은 프로세스에서 실행되는 TypeScript 플러그인
- 데이터 일괄 가져오기

</td>
<td width="33%" valign="top">

**실시간**
- Transmit을 통한 브로드캐스팅
- 꺼져 있을 때는 폴링으로 대체

</td>
<td width="33%" valign="top">

**언어**
- 공유 로케일 패키지의 문자열
- 호스트별 재정의

</td>
</tr>
</table>

<p align="center"><sub><a href="../features.md">모든 기능 자세히 보기</a></sub></p>

<p align="center">
  <a href="https://adonisjs.com"><img src="https://img.shields.io/badge/AdonisJS_7-5A45FF?style=for-the-badge&logo=adonisjs&logoColor=white" alt="AdonisJS 7"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js_24+-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 24+"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://inertiajs.com"><img src="https://img.shields.io/badge/Inertia-9553E9?style=for-the-badge&logo=inertia&logoColor=white" alt="Inertia"></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue 3"></a>
</p>

## 빠른 시작

```bash
npm install @escalated-dev/escalated-adonis
npm install @escalated-dev/escalated
node ace configure @escalated-dev/escalated-adonis
node ace migration:run
```

그런 다음 `/support`에 접속하세요. AdonisJS v7과 Node.js 24 이상이 필요합니다. 필요한 다른 Adonis 패키지는 [시작 가이드](../getting-started.md)에, SLA와 에스컬레이션을 실행하는 예약 명령은 [설정](../configuration.md)에 정리되어 있습니다.

## 더 알아보기

- [전체 기능](../features.md) · [시작하기](../getting-started.md) · [설정과 예약 명령](../configuration.md)
- [아키텍처, 페이지, 라우트, 이벤트](../architecture.md) · [커스터마이징](../customization.md)
- [접근 제어](../access-control.md) · [SSO](../sso.md) · [티켓 접근과 라우팅](../ticket-access-and-routing.md)
- [수신 이메일](../inbound-email.md) · [위젯 임베드](../embedding-the-widget.md) · [게스트 접근](../guest-access.md) · [비공개 첨부 파일](../private-attachments.md)
- [상담원 패널](../agent-panel.md) · [관리자 화면 임베드](../embedding-admin.md)
- [플러그인 SDK](../plugin-sdk.md) · [플러그인](../plugins.md) · [뉴스레터](../newsletters.md) · [의존성 보안](../dependency-security.md)

Escalated는 [Laravel](https://github.com/escalated-dev/escalated-laravel), [Rails](https://github.com/escalated-dev/escalated-rails), [Django](https://github.com/escalated-dev/escalated-django), [NestJS](https://github.com/escalated-dev/escalated-nestjs), [Symfony](https://github.com/escalated-dev/escalated-symfony), [Phoenix](https://github.com/escalated-dev/escalated-phoenix), [Go](https://github.com/escalated-dev/escalated-go), [.NET](https://github.com/escalated-dev/escalated-dotnet), [Spring](https://github.com/escalated-dev/escalated-spring), [WordPress](https://github.com/escalated-dev/escalated-wordpress), [Filament](https://github.com/escalated-dev/escalated-filament)용으로도 제공됩니다. UI는 [escalated](https://github.com/escalated-dev/escalated)에 있습니다.

## 라이선스

MIT. Copyright (c) Escalated.dev. [LICENSE](../../LICENSE)를 참고하세요.
