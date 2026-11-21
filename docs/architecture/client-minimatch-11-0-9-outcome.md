# Client minimatch 11.0.9 qualification outcome

November 21, 2026 Eastern. Implementation of the
[approved design](client-minimatch-11-0-9-design.md).

The exact client override is now minimatch 11.0.9. The lock changes two
development package records, minimatch and its nonrecursive matcher from
1.0.3 to 1.1.0. Their integrity values agree with npm metadata. Both
workspace overrides continue to use glob 14.0.3. The client compiler patch,
remaining overrides and install authorization stay on their existing pins.
Strict install and the full client package-tree check passed.

The existing explicit expansion limit now has one exact refusal expectation
for the two workspaces and both module formats. Admitted matches, glob
cancellation and real EditorConfig and beautifier behavior still match their
fixtures. The new installed ESLint check asserts both the scoped rule result
and omission of the globally ignored file. All 30 matcher controls passed.

The client lint and type checks, production build and 29 Chromium checks
passed. Those include keyboard and focus controls and the production route
asset budget. These are scoped interaction checks. W3C recommends combining
tooling with knowledgeable human evaluation for accessibility conformance.
[W3C evaluation guidance](https://www.w3.org/WAI/test-evaluate/)

Both matcher versions passed the same 7,592 cases in 488 files in the
controlled full coverage comparison. The case names and outcomes matched.
The first coverage run, which overlapped the browser checks, reported 7,591
passes. The code-health suite creates cases dynamically from JSON files,
including two generated Playwright result files when they are present. The
first run's individual case inventory was unavailable. The paired runs used
stable artifacts and ruled out a case difference between the pins in that
environment. The joint coverage ratchet passed with verified server evidence.

Full npm audits reported zero findings for root, server and client. The
reviewed OSV Scanner container reported no issues on the three lockfiles.
It still reported the deprecated config field and the unused withdrawn
advisory entry. The existing scanner policy was used for this run.

## Next recommended item

Make code-health JSON discovery exclude generated browser results. Verify
that it still rejects malformed authored JSON and selects the same cases
before and after the browser suite writes its reports.
[Current code-health discovery](../../client/src/__tests__/codeHealth.test.js)
