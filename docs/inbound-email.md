# Inbound email

## Inbound Email

Enable inbound email processing by setting `inboundEmail.enabled: true` in your config. Point your email provider's webhook to:

```
POST /support/inbound/mailgun
POST /support/inbound/postmark
POST /support/inbound/ses
```

The system will:
1. Parse incoming email from the adapter's format
2. Match to an existing ticket. With `inboundEmail.replySecret` set, only the signed Reply-To address (`reply+{id}.{hmac8}@domain`) identifies a ticket. Without a secret, the subject pattern (`[ESC-00001]`) and In-Reply-To/References headers are used instead
3. Check the sender: a matched email becomes a reply only when the `From` address (case-insensitive) is the ticket's requester, either the guest email or the requester user's email. The reply is posted as that requester. Identity is never taken from `From`, so an email naming an agent's address is not posted as that agent; agents reply in the app
4. Otherwise (no match, or a sender who is not the requester) create a new ticket, so mail is never dropped. Only an accepted reply reopens a resolved or closed ticket
5. Process attachments (with blocked extension filtering)
6. Log the inbound email for audit trail

Escalated does not send ticket notification mail itself. If your notifications should thread by the signed address, set `ESCALATED_INBOUND_REPLY_SECRET` and use the same key with `EmailThreadingService.buildSignedReplyTo(ticketId, domain, secret)` as the Reply-To of the mail you send. `From` can still be forged for the requester's own address, so also have your inbound provider enforce SPF/DKIM/DMARC.
