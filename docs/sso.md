# Single sign-on (SAML, OAuth 2 / OIDC, JWT)

Escalated signs users in at `GET {prefix}/sso/login` through the provider an
admin chooses in **Admin > Settings > SSO**, while the install-level switch
`access.sso` (`ESCALATED_SSO`) is on. The switch, the routes, user matching,
roles and the install-level options are described in
[access-control.md](access-control.md#single-sign-on). This page lists the
settings and exactly what each provider checks.

## Settings

Stored as `sso_*` keys in `escalated_settings` and edited on the SSO page
(`SsoService.saveConfig()` writes them too).

| Key | Used by | Meaning |
|---|---|---|
| `sso_provider` | all | `none`, `saml`, `oauth` or `jwt` |
| `sso_entity_id` | SAML, OAuth | The IdP's entity ID: the SAML `Issuer`; for OIDC, the ID token issuer (default: the authorize URL's origin) |
| `sso_login_url` | SAML, JWT | IdP sign-in URL (`sso_url` is the older single URL, still read) |
| `sso_certificate` | SAML | The IdP's signing certificate. Required. |
| `sso_jwt_secret` | JWT | HMAC secret, or the RS* public key / certificate (PEM) |
| `sso_jwt_algorithm` | JWT | `HS256` (default), `HS384`, `HS512`, `RS256`, `RS384`, `RS512` |
| `sso_oauth_authorize_url`, `sso_oauth_token_url`, `sso_oauth_userinfo_url` | OAuth | The provider's endpoints |
| `sso_oauth_client_id`, `sso_oauth_client_secret`, `sso_oauth_scopes` | OAuth | The client (scopes default `openid profile email`) |
| `sso_attr_email`, `sso_attr_name`, `sso_attr_role` | all | Attribute / claim names (default `email`, `name`, `role`) |

Our SP entity ID, ACS URL, IdP-initiated sign-in and clock skew are
install-level options (`sso.spEntityId`, `sso.acsUrl`,
`sso.allowIdpInitiated`, `sso.clockSkew` in `config/escalated.ts`), not
settings. The `sso_sp_entity_id`, `sso_acs_url`, `sso_allow_idp_initiated` and
`sso_clock_skew` settings earlier releases read are ignored.

## SAML

`GET {prefix}/sso/login` sends the browser to `sso_login_url` with an
AuthnRequest (HTTP-Redirect binding). Its ID is stored in
`escalated_sso_message_ids` for ten minutes. The IdP posts the response to
`POST {prefix}/sso/saml/acs`. A response is accepted only when all of these
hold:

- **Signature.** The assertion itself is signed with RSA (`rsa-sha1`,
  `rsa-sha256`, `rsa-sha512`; verified by
  [`xml-crypto`](https://github.com/node-saml/xml-crypto), HMAC disabled) by
  the key in `sso_certificate`. A signed Response around an unsigned
  assertion is refused. The certificate may be pasted as PEM, as the bare
  base64 body most IdP metadata shows, or as a PEM public key. A certificate
  carried inside the message's `KeyInfo` is ignored.
- **One plain assertion.** The user and everything below are read from the XML
  the signature covers. A response with more than one assertion, or with an
  encrypted assertion, is refused.
- **Issuer** equals `sso_entity_id`; without it every response is refused.
- **Audience.** `Conditions` hold at least one `AudienceRestriction`, and every
  one lists the SP entity ID.
- **Destination.** A `Destination` on the `Response` equals the ACS URL.
- **Recipient.** A bearer `SubjectConfirmation` whose `SubjectConfirmationData`
  has `Recipient` equal to the ACS URL and a `NotOnOrAfter`. This is the signed
  binding to our ACS URL.
- **Validity window.** `NotBefore` / `NotOnOrAfter` on `Conditions` and on the
  `SubjectConfirmationData` hold now, give or take `sso.clockSkew`.
- **InResponseTo** (the confirmation's, and the Response's, which must agree)
  names an AuthnRequest we issued that has not expired or been answered; it is
  removed when answered. A response without it is IdP-initiated: refused
  unless `sso.allowIdpInitiated` is on.
- **Replay.** The assertion `ID` has not been accepted before. Used IDs are
  kept until the assertion would be refused as expired anyway.

`GET {prefix}/sso/saml/metadata` serves our SP metadata (entity ID, HTTP-POST
ACS, `WantAssertionsSigned="true"`).

## OAuth 2 / OIDC

Through [`openid-client`](https://github.com/panva/openid-client):
authorization-code flow with a single-use `state` kept in the session and PKCE
(`S256`). The callback refuses a missing or mismatched `state` or an IdP
`error`, exchanges the code at the token URL with the PKCE verifier, and reads
the profile from the userinfo URL with the access token. A profile with
`email_verified: false` is refused.

## JWT

`GET {prefix}/sso/login` sends the browser to `sso_login_url` (or `sso_url`)
with `return_to` set to `{prefix}/sso/jwt/callback`; the IdP sends it back with
a `jwt` parameter (GET or POST). Verified by
[`jose`](https://github.com/panva/jose):

- the algorithm is pinned to `sso_jwt_algorithm`, so `alg: none` and
  algorithm switching are refused;
- `exp`, `aud` (= `sso.jwtAudience`, default the base URL) and `jti` are
  required; `nbf` / `iat` are honoured with the clock skew;
- a `jti` works once (kept in `escalated_sso_message_ids` until `exp`).

## Using the service directly

`SsoService` (`@escalated-dev/escalated-adonis/services/sso_service`) exposes
`validateSamlAssertion(response, { requestId })`, `createSamlRequestId()`,
`validateJwtToken(token)`, `oauthStart()` and `oauthIdentity(query, state,
verifier)`. Each returns `{ email, name, role }` or throws an
`SsoValidationError`. The routes above use them; most hosts need nothing more
than the switch.
