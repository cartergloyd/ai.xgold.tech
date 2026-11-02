# LinkedIn and future Sales Navigator capability

The owner currently has no Sales Navigator subscription or additional CRM users.
The current acceptance target is an available import/integration foundation.
No live Sales Navigator connection or automatic synchronization is configured.

## Available now

Twenty has native LinkedIn link fields on both People and Companies, plus name,
email, job title, company and company-domain fields. Authenticated REST writes and
reads of synthetic company/person LinkedIn URLs were verified on 2026-10-27;
the test records were removed afterward.

Use Twenty's People or Companies view → Import data to import a CSV you already
have, mapping columns in the preview before committing. Header-only templates
are in `crm/import-templates/`. A company relation should be selected from an
existing imported company; preview the relation mapping in the importer.
Import a small sample first and reconcile duplicates using email and LinkedIn
URL before loading a larger file. Do not assume every source produces a CSV.

Future server-side integrations can use Twenty's authenticated REST API privately
at http://127.0.0.1:3020/rest. Keep credentials in a private server-only file and
use a dedicated least-privilege key for any new integration. Browser code must
not receive the existing assessment-sync key. Cloudflare REST/GraphQL bypasses
are unnecessary for the existing local assessment bridge.

## When Sales Navigator is available

Confirm the actual plan, required direction of synchronization, and approved
source/integration access. LinkedIn documents CRM integrations and CRM Sync for
Advanced Plus and supported CRM partners. Twenty is not listed in the linked
supported-CRM table, so native Sales Navigator CRM Sync must not be promised
for this installation. Plan eligibility alone does not establish Twenty support.

A future integration can map authorized source data into Twenty's existing
People/Companies LinkedIn fields using the authenticated API. Live validation
requires the owner's account and a supported integration/API authorization.
Manual import remains available without buying a subscription.

References:
- https://www.linkedin.com/help/sales-navigator/answer/a106005
- https://www.linkedin.com/help/sales-navigator/answer/a8037044
- https://twenty.com/releases (CSV imports and relation mapping)

This is capability preparation, not a claim of a live Sales Navigator sync.
