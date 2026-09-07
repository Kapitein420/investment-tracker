# Security policy

This is an internal Dils investor-portal app (not a public product), but the
`/sign/[token]` document-signing flow is reachable without a login, so we
welcome reports on it same as any public surface.

## Reporting a vulnerability

Email **privacy.netherlands@dils.com** with a description, reproduction
steps, and impact. See [`/.well-known/security.txt`](../public/.well-known/security.txt)
for the machine-readable version (RFC 9116).

This is the same mailbox as our privacy contact — there is no dedicated
security inbox yet. A dedicated `security@` alias would be worth setting up
once the mailbox exists.

## What to expect

- Acknowledgement within 5 business days.
- No bug bounty — this is not a paid disclosure programme.
- Please don't test against production data belonging to real investors;
  report the class of issue instead of exploiting it further.
