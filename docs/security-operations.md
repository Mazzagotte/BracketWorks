# Security operations

## Rotate the production signing secret

The JWT signing key must live in the deployment platform's secret manager, never in Git, build arguments, images, tickets, or logs.

1. Generate at least 32 cryptographically random bytes directly inside the secret-management environment.
2. Replace the production `SECRET_KEY` secret without printing its value.
3. Restart every backend instance so all instances use the same new key.
4. Revoke all active rows in `auth_sessions` (or mark them revoked) to force a clean sign-in.
5. Confirm that an access token issued before rotation receives `401` and a new login succeeds.
6. Remove old secret versions after the rollback window closes.

Treat any signing key that has appeared in a terminal transcript, support bundle, backup, or shared workspace as compromised and rotate it again.

## Dependency gates

Pull requests must pass both vulnerability scans without ignored advisory IDs:

- `pip-audit` for `apps/api/requirements.txt`
- `npm audit --audit-level=high --omit=dev` for the frontend lockfile

Exceptions require a written applicability assessment, owner, and expiration date.

## Production rate limiting

Production startup requires `REDIS_URL`. Sensitive routes fail closed when Redis cannot enforce a shared limit. Monitor Redis availability and alert on API `429` spikes caused by limiter unavailability.
