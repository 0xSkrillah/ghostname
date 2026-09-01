# Claude Repository Instructions

Before changing code, read these files in order:

1. `02_GHOSTNAME_MASTER_SPEC.md`
2. `03_BUILD_STATUS.md`
3. `04_DEMO_AND_SUBMISSION.md`

Treat the session Goal condition as the definition of success and the master
spec as the implementation contract.

Non-negotiable priority:

```text
P0 ENS + ERC-5564 generate → publish/read → derive → send/announce → recognise → recover
P1 privacy-exit and threat-model UI
P2 Mobula exposure panel
P3 Swarm deployment/encrypted TESTNET recovery
```

Do not begin P2 or P3 until all P0 acceptance tests pass. Never modify
`skrillah.eth`; it is read-only mainnet demo input. Never expose private keys
or make a mainnet write without explicit human approval.

After every milestone, run typecheck, tests and production build, then update
`03_BUILD_STATUS.md` with exact results and the next action.
