# Policy Authoring Starter Template Role Reset

Status: superseded by the implemented [Policy Starter Template Intent
Boundary](policy-starter-template-intent-boundary.md).

The earlier role reset correctly removed raw template detail, weighting,
strictness, and scoring controls. Its remaining optional selection accelerator
has now also been removed. Raw template selection created a second policy
authority path and was inconsistent with library-first, hands-off authoring.

Current behavior:

- server-owned workflow context may derive bounded, source-labelled candidate
  values from a template;
- an operator can accept an eligible candidate only as a typed intent signal
  command;
- a new policy cannot attach a raw starter template;
- an existing policy's preset attachment is compatibility context only and
  retains its stored value solely through the legacy draft bridge.

The normal authoring surface contains neither a template browser nor a raw
template suggestion endpoint.
