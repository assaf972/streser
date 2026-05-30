# Sentry Performance Observability — Configuration Templates

This folder contains **configuration templates** for integrating Sentry into
the Labguru application for production performance observability.

> **Important:** Sentry is NOT a test runner. It does not generate load.
> It observes real production traffic and provides:
>
> - Transaction tracing (browser → Rails → Sidekiq → ChemWiz → MySQL)
> - Automatic p50/p75/p95/p99 percentiles
> - Web Vitals (LCP, FID, CLS) for compound pages
> - Alerts on performance regressions

## Files

| File | Purpose |
|------|---------|
| `sentry_rails.rb` | Rails initializer — transaction tracing for compound registration (PR-1, PR-4) |
| `sentry_react.ts` | React SDK init — Web Vitals for Ketcher pages (PR-7) |
| `sentry_alerts.yml` | Alert rule definitions — regression detection for key PRs |

## How to use

1. Copy `sentry_rails.rb` to `config/initializers/sentry.rb`
2. Copy `sentry_react.ts` to your React entry point (or merge with existing Sentry init)
3. Configure alert rules in the Sentry UI (or via Terraform using `sentry_alerts.yml`)
4. Set environment variables:

```bash
export SENTRY_DSN="https://xxx@sentry.io/yyy"
export REACT_APP_SENTRY_DSN="https://xxx@sentry.io/zzz"
```
