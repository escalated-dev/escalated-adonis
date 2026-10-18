# Dependency security

Last reviewed: 2026-10-18.

The repository's locked development graph includes AdonisJS and its tooling so
the package can be built and tested against a real host framework. Run `npm ci`
and `npm audit` when reviewing updates. CI uses the committed lockfile and rejects
unsupported engines and peer combinations.

## Patched dependencies

The lockfile uses `brace-expansion` 5.0.12, `source-map-js` 1.2.2 and Nodemailer
9.1.1. These are updates within the upstream dependency ranges. Nodemailer 9.1.1
patches the legacy `resolveContent()` content-access bypass, but does not resolve
all of Nodemailer's published advisories.

Compatibility tests use Adonis Mail's real SMTP transport with a local test
server, including recipients, attachments, headers, bodies, BCC privacy and
rejection. They also load the built-in JSON, SMTP, Brevo, Resend, Mailgun,
SparkPost, Cloudflare and Postmark adapters. The package's Adonis peer ranges
remain unchanged. These checks do not cover every provider's actual delivery
API or a host's delivery configuration.

## Nodemailer upgrade blocked by provider compatibility

Adonis Mail 10.4.0 requests Nodemailer `^9.0.3`. A trial override to Nodemailer
10.1.2 passed the SMTP tests, but loading Adonis's Postmark adapter failed:

```text
nodemailer/lib/mime-funcs/index.js does not provide an export named 'default'
```

The Postmark adapter uses a default import from that internal entry point.
Nodemailer 10 changes its module layout. The override was rejected to preserve
all supported transports, and no override is committed. The DNS-cache and
address-parser advisories affecting 9.1.1 remain open. Track an Adonis Mail
release compatible with patched Nodemailer, then repeat the transport tests
and test the host's configured provider before updating.

Host applications control their own dependency lockfiles. Updating this
package alone does not update a host's Adonis Mail/Nodemailer installation.

## Remaining unpatched braces advisory

[`braces` GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
affects all published versions through 3.0.3; no patched release is available.
It remains in the locked development graph through `micromatch`, used by the
Adonis ESLint plugin and `fast-glob` in Adonis's assembler. The full audit reports
this package and its dependent chains as high severity. The alert remains open;
the dependency review is not a claim that the complete graph is vulnerability
free.

Track a patched upstream release or a compatible upstream replacement, then
refresh the lockfile and rerun the full audit, build, linter and test matrix.
The audit's proposed downgrade to Adonis Core 5 does not satisfy this package's
AdonisJS 7 contract. No audit exceptions or forced dependency downgrades are used.
