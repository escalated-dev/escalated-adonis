# Private attachments

Attachments are private. The package never hands out a Drive URL for one: every
page and API answer carries a short-lived link to a single download route, and
that route checks who is asking, against the ticket, on every request. This
ports escalated-laravel's private attachment delivery.

## Where files are written

New uploads (web forms, the guest form, inbound email) go to `storage.disk` in
`config/escalated.ts`, or to the application's default Drive disk when it is not
set, under `storage.path` (default `escalated/attachments`). They are written
with `visibility: 'private'`.

That disk must not be readable from outside the application: no `serveFiles`,
no public bucket policy, no CDN in front of it. A dedicated disk is the simplest
way to be sure:

```ts
// config/drive.ts
const driveConfig = defineConfig({
  default: 'fs',
  services: {
    fs: services.fs({ /* ... */ }),
    escalated: services.fs({
      location: app.makePath('storage/escalated'),
      visibility: 'private',
      // no serveFiles
    }),
  },
})

// config/escalated.ts
storage: {
  disk: 'escalated',
  path: 'escalated/attachments',
}
```

## The download route

`GET {prefix}/attachments/:attachment/download?token=...`, named
`escalated.attachments.download`. It is registered with the core routes, so it
exists with `ui.enabled: false` too.

The `token` is encrypted with the application key, names one attachment and
expires after `storage.downloadTtlMinutes` (default 10, clamped to 1 to 60).
A missing, altered or expired token answers 403, for agents too; refresh the
page for a new link.

With a valid token, the route allows:

- **Agents and admins** who can see the ticket (ticket access rules apply):
  every attachment, internal-note attachments included.
- **The requester** (the host session's user): the ticket's attachments and
  those on its public replies, never internal-note attachments.
- **Guests**: links issued by the guest ticket page, bound to the ticket's
  active grant (see [guest access](guest-access.md)). They open without a
  session, only for that ticket's public attachments, never outlive the grant,
  and stop working when it is renewed, revoked or expires.
- **API clients** sending their Escalated bearer token (`Authorization: Bearer`).
  An invalid or expired token answers 401 and never falls back to the session.

A missing attachment, a deleted ticket or reply, or a missing file answers 404.

Responses use `Content-Disposition: attachment` with a sanitised file name,
`X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store, max-age=0`
and `Referrer-Policy: no-referrer`. The stored content type is kept only for
PDF, GIF, JPEG, PNG, WebP and plain text; everything else is sent as
`application/octet-stream`.

## Serialized attachments

An attachment serializes with `url` (the download link) and without `disk` or
`path`. Controllers sign links with `signAttachments()` or
`attachmentDownloadUrl()` from `support/attachment_access`; an unsigned
attachment's `url` is `null`.

## Files stored by earlier releases

Earlier releases wrote to the `public` disk by default. Those rows keep their
`disk` and `path`, and the download route reads them from there, so existing
attachments keep working through the route. Their files are still reachable at
their old public URLs until you act:

1. Stop serving them: turn off `serveFiles` for that disk, or block
   `/<routeBasePath>/escalated/attachments/` at the web server or CDN.
2. Or move them: copy each file to the private disk under the same path,
   update the row's `disk`, verify, then delete the public copy.

Clear any CDN copies and check that an old public URL no longer returns the
file.
