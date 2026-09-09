# Agent Note: First-run provider picker

Status: implemented

English | [中文](2026-09-09-first-run-provider-picker.zh.md)

## Problem

First-run onboarding asked only for the official DeepSeek API key. Users who wanted OpenAI, a local gateway, or another catalog route could not start without that key, even though any usable provider already ended the step.

## Decision

The `settings.onboarding` step `deepseek-official` projects `choose-provider` from the shared Models join whenever no row is usable, settings are writable, credentials can be described, and either a configurable directory row exists or `llm-pi-ai` is mounted. The dialog lists those rows in a searchable picker and offers **Add a custom provider** when the pi-ai schema names protocols. Choosing a row opens `ProviderEditor`; the custom action opens `CustomProviderCard`. Official DeepSeek is one optional row. A keyed provider still requires a newly entered key before Save. Configure later and Back return without writing. Any usable provider, a failed join, a read-only settings document, a credential-describe failure, or a join with no configurable address and no `llm-pi-ai` namespace completes the step without rendering.

## Alternatives considered

**Keep the DeepSeek-only credential form and add side links.** Side links still present DeepSeek as the default required path and hide the catalog until the user looks away from the key field.

**Open the Models page instead of a modal.** The onboarding ledger must complete or skip in order; sending the user to Settings would leave the coordinator blocking the product or skip the step before a provider exists.

**Require a key for every catalog row.** Some routes authenticate without a stored reference (Bedrock, Vertex, a keyless gateway). The editor already allows a blank key in those cases.

## Consequences

First-run no longer fails closed on a missing DeepSeek key. Users can dismiss the picker and remain without a model until they configure one in Models. The slot id stays `deepseek-official` so existing shell registration does not change.

## Testing

`packages/client/ui-settings-models/tests/readiness.client.spec.ts` covers `choose-provider` versus skip reasons. `tests/onboarding-dialog.client.spec.tsx` covers the picker, search, editor key requirement, custom card, later, and skip paths. `apps/web/tests/onboarding-deepseek-config.e2e.ts` and `onboarding-usable-provider.e2e.ts` wait on the picker title, then select DeepSeek or Configure later.
