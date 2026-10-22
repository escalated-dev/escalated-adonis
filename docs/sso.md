# Single sign-on (SAML and JWT)

`SsoService` validates what an identity provider sends and returns the user's
`email`, `name` and `role`. Escalated does not register an SSO login or ACS
route: the host calls the service from its own route and signs the returned
user in.

```ts
import SsoService, { SsoValidationError } from '@escalated-dev/escalated-adonis/services/sso_service'

const user = await new SsoService().validateSamlAssertion(request.input('SAMLResponse'))
```

The settings live under **Admin > Settings > SSO** (`sso_*` keys in
`escalated_settings`).

## SAML

A SAML response is accepted only when its signature verifies against the IdP
certificate saved as `sso_certificate`:

- **No certificate, no sign-in.** With `sso_certificate` empty every SAML
  response is refused, signed or not.
- The certificate may be pasted as PEM (`-----BEGIN CERTIFICATE-----`), as the
  bare base64 body most IdP metadata shows, or as a PEM public key.
- Either the assertion or the whole `Response` must be signed with RSA
  (`rsa-sha1`, `rsa-sha256`, `rsa-sha512`; verified by
  [`xml-crypto`](https://github.com/node-saml/xml-crypto), HMAC disabled). A
  certificate carried inside the message's `KeyInfo` is ignored: only the
  configured one is trusted.
- The user is read from the XML the signature covers, not from the document as
  received. A response with more than one assertion, or with an encrypted
  assertion, is refused.
- After the signature, `sso_entity_id` (when set) must equal the assertion's
  `Issuer`, and `Conditions` `NotBefore` / `NotOnOrAfter` are checked with two
  minutes of clock skew.

Not checked by the service: `Audience`, `Destination`, `InResponseTo` and
replay of an assertion that is still valid. Hosts that need those should check
them in their ACS route, or use a full SAML service-provider library.

## JWT

`validateJwtToken` verifies an HMAC-signed token (`HS256`, `HS384`, `HS512`)
with `sso_jwt_secret` and checks `exp` / `nbf` with 60 seconds of skew. It
refuses every token while no secret is configured.
