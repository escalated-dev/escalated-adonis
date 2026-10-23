# Single sign-on (SAML and JWT)

`SsoService` validates what an identity provider sends and returns the user's
`email`, `name` and `role`. Escalated does not register an SSO login or ACS
route: the host calls the service from its own routes and signs the returned
user in.

The settings live under **Admin > Settings > SSO** (`sso_*` keys in
`escalated_settings`); `SsoService.saveConfig()` writes them too.

## SAML

### Settings

| Key | Meaning |
|---|---|
| `sso_certificate` | The IdP's signing certificate. Required. |
| `sso_entity_id` | The IdP's entity ID. When set, the assertion's `Issuer` must equal it. |
| `sso_sp_entity_id` | **Our** service provider entity ID, as registered at the IdP. Required: the assertion's `Audience`. |
| `sso_acs_url` | **Our** Assertion Consumer Service URL, exactly as the IdP posts to it. Required: the `Destination` and `Recipient`. |
| `sso_allow_idp_initiated` | `1` to accept IdP-initiated (unsolicited) responses. Default `0`. |
| `sso_clock_skew` | Seconds of clock skew allowed on every validity window. Default `120`, at most `300`. |

While `sso_certificate`, `sso_sp_entity_id` or `sso_acs_url` is empty, every
SAML response is refused.

### Sign-in flow

Issue a request ID when sending the user to the IdP, keep it in the session,
and hand it back when the response arrives:

```ts
import SsoService, { SsoValidationError } from '@escalated-dev/escalated-adonis/services/sso_service'

// Login route: build the AuthnRequest with this ID.
const requestId = await new SsoService().createSamlRequestId()
session.put('saml_request_id', requestId)
// ... redirect to the IdP with <samlp:AuthnRequest ID="${requestId}" ...>

// ACS route (sso_acs_url):
const user = await new SsoService().validateSamlAssertion(request.input('SAMLResponse'), {
  requestId: session.pull('saml_request_id'),
})
```

`createSamlRequestId(ttlSeconds = 600)` stores the ID in
`escalated_saml_message_ids` for ten minutes. Passing `requestId` is optional
but recommended: without it any request ID we issued is accepted, with it the
response must answer the request this browser started.

### What is checked

A SAML response is accepted only when all of these hold:

- **Signature.** The assertion or the whole `Response` is signed with RSA
  (`rsa-sha1`, `rsa-sha256`, `rsa-sha512`; verified by
  [`xml-crypto`](https://github.com/node-saml/xml-crypto), HMAC disabled)
  by the key in `sso_certificate`. The certificate may be pasted as PEM
  (`-----BEGIN CERTIFICATE-----`), as the bare base64 body most IdP metadata
  shows, or as a PEM public key. A certificate carried inside the message's
  `KeyInfo` is ignored: only the configured one is trusted.
- **One plain assertion.** The user and everything below are read from the XML
  the signature covers, not from the document as received. A response with
  more than one assertion, or with an encrypted assertion, is refused.
- **Issuer.** When `sso_entity_id` is set, it must equal the assertion's
  `Issuer`.
- **Audience.** The assertion's `Conditions` must hold at least one
  `AudienceRestriction`, and every one of them must list `sso_sp_entity_id`.
- **Destination.** A `Destination` on the `Response` must equal
  `sso_acs_url`.
- **Recipient.** The assertion must carry a bearer `SubjectConfirmation`
  whose `SubjectConfirmationData` has `Recipient` equal to `sso_acs_url` and a
  `NotOnOrAfter`. This is the signed binding to our ACS URL when only the
  assertion is signed.
- **Validity window.** `NotBefore` / `NotOnOrAfter` on `Conditions` and on the
  `SubjectConfirmationData` must hold now, give or take `sso_clock_skew`.
- **InResponseTo.** The confirmation's `InResponseTo` (and the Response's,
  which must agree) must name a request ID from `createSamlRequestId()` that
  has not expired or been answered; it is removed when answered. With
  `requestId` passed, it must be that ID. A response without `InResponseTo` is
  IdP-initiated: refused unless `sso_allow_idp_initiated` is on, and always
  refused when `requestId` was passed.
- **Replay.** The assertion's `ID` must not have been accepted before. Used
  IDs are kept in `escalated_saml_message_ids` until the later of the
  assertion's and the confirmation's `NotOnOrAfter`, plus the clock skew, by
  which time the assertion would be refused as expired anyway. Expired rows
  are removed as new ones are written.

Every refusal is an `SsoValidationError`.

## JWT

`validateJwtToken` verifies an HMAC-signed token (`HS256`, `HS384`, `HS512`)
with `sso_jwt_secret` and checks `exp` / `nbf` with 60 seconds of skew. It
refuses every token while no secret is configured.
