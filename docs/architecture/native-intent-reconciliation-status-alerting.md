# Native Intent Reconciliation Status And Alerting

## Status

Implemented as Phase 8R, Task 8R.3.2.6.2 on July 16, 2026.

## Decision

Automatic native-intent reconciliation remains the only conversion execution
path. Administrators receive a read-only status contract and narrowly targeted
in-app alerts. Neither surface can select policies, start a conversion batch,
or override normal reconciliation controls.

The contract reads existing reconciliation control, run-ledger, and unresolved
state records. It returns only:

- the most recent completed run's correlation ID, safe state/reason IDs, and
  bounded counters;
- current automation and circuit state;
- bounded unresolved-state counts and at most twelve state/reason groups;
- the next expected scheduler boundary; and
- the count of recent failed runs used for alert evaluation.

It excludes policy names, legacy payloads, credentials, sessions, exception
text, stack traces, and mutable actions.

## Alert Policy

The system evaluates exactly three conditions after every reconciliation result:

1. the automatic reconciliation circuit is open;
2. unresolved reconciliation inventory has persisted for at least 24 hours; or
3. three or more system-level reconciliation failures occurred in one hour.

Each condition has a durable `firing` or `resolved` record in
`policy_native_intent_reconciliation_alert_states`. This gives a newly started
process the same six-hour notification cooldown as the process that detected
the prior condition. A resolved condition that later fires again is a new
incident and does not retain its prior notification timestamp.

The alert transaction locks existing alert rows, writes any required lifecycle
state, and inserts the existing global in-app notification together. Repeated
scheduled runs therefore cannot create notification noise through a race or a
restart. The status and alert evaluator use only static notification text and
safe IDs. A later notification-channel adapter, such as Discord, can consume
the same durable lifecycle state without changing reconciliation execution.

Alert evaluation is observational. If it cannot read or persist its own data,
the completed reconciliation result remains truthful and unchanged. The failure
is logged as a bounded `alert_evaluation` operational event without a raw stack
or exception message.

## Research And Recommendation

Google SRE recommends alerting on symptoms that require a response and using a
dashboard for information that is useful but not immediately actionable. Its
guidance also favors aggregation over a stream of low-value component alerts.
Prometheus Alertmanager similarly groups and deduplicates alerts using stable
labels. This design therefore makes the bounded status contract the dashboard
surface and alerts only three high-consequence conditions.

NIST log-management guidance supports retaining operationally useful evidence,
while OWASP API inventory guidance requires intentional, documented endpoints.
The administrator-only status endpoint is explicit and stable; it is not a
hidden conversion endpoint or a raw ledger export.

### Options Considered

| Option | Advantages | Disadvantages |
| --- | --- | --- |
| Logs only | No API or storage change | Operators must search logs; no safe status overview or restart-safe deduplication |
| Read-only status with in-memory cooldown | Simple implementation | Restarts re-notify and replicas can duplicate alerts |
| Read-only status with durable typed alert state | Actionable status, restart-safe cooldown, bounded stored data | Adds one small lifecycle table and endpoint |

### Final Recommendation Stack

1. Preserve scheduler-owned reconciliation; do not reintroduce manual apply.
2. Expose the administrator-only, read-only status contract at
   `GET /api/policies/native-intent-reconciliation/status`.
3. Retain only typed alert lifecycle state, fixed notification text, and
   bounded stable identifiers.
4. Notify only for open circuit, prolonged unresolved inventory, and repeated
   systemic failure, with durable six-hour deduplication.
5. Treat unresolved `requires_maintenance` records as a future compatibility
   deletion gate, not as an alert acknowledgement workflow.

## Verification

Automated coverage verifies the status contract, safe route access, alert
condition/cooldown evaluation, transaction behavior, reopened-incident state
handling, and that alert failure cannot change a reconciliation result.

## Sources

- [Google SRE: Practical Alerting](https://sre.google/sre-book/practical-alerting/)
- [Prometheus Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Prometheus Alerts API](https://prometheus.io/docs/alerting/latest/alerts_api/)
- [NIST SP 800-92: Guide to Computer Security Log Management](https://www.nist.gov/publications/guide-computer-security-log-management)
- [OWASP API9: Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
