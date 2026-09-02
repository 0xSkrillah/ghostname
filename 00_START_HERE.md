# Start Here — One Claude Session

## Critical date correction

The final submission deadline is **Saturday 5 September 2026 at 09:00 Amsterdam time**, not Sunday. Treat **Friday night, 4 September** as the engineering deadline.

## In Claude's setup screen

1. Paste the entire contents of `01_GOAL_CONDITION.txt` into the **Goal condition** field.
2. Upload these files into the same session:
   - `02_GHOSTNAME_MASTER_SPEC.md`
   - `03_BUILD_STATUS.md`
   - `04_DEMO_AND_SUBMISSION.md`
3. Give Claude access to the project repository/workspace.
4. Send the opening message below as the first chat message.

## First message to Claude

```text
Read 02_GHOSTNAME_MASTER_SPEC.md, 03_BUILD_STATUS.md and
04_DEMO_AND_SUBMISSION.md in full before changing code.

Treat the Goal condition as the definition of success and the master spec as
the implementation contract. Inspect the repository and current git state.
Then:

1. summarise the P0 finish line in no more than 10 bullets;
2. propose the directory structure and exact dependencies;
3. diagram the ERC-5564 scheme-1 data flow;
4. identify the five largest implementation risks;
5. define the smallest milestone proving generate → derive → recognise →
   recover end-to-end;
6. write the plan and current state into 03_BUILD_STATUS.md;
7. immediately implement that milestone.

Do not begin visual polish, Mobula or Swarm work before the cryptographic
tests pass. After every milestone run typecheck, tests and production build,
record the result in 03_BUILD_STATUS.md, and commit the working state.

Do not ask broad product questions. Ask only before requesting a secret/API
key, risking a real asset, or making an irreversible/mainnet transaction.
Never modify the established mainnet ENS identity used as demo input; it is read-only and is configured only through VITE_DEMO_MAINNET_NAME in a local, uncommitted .env. Never hard-code a personal ENS name.
```

## Keep everything in one effective session

The chat is not the only memory. Require Claude to maintain
`03_BUILD_STATUS.md` after every milestone. That file must always state:

- what works;
- what failed;
- commands that currently pass;
- current deployed URLs/contracts/test names;
- unresolved risks;
- the exact next task.

If the model context is compacted or you reopen the workspace, send:

```text
Recover project state from 03_BUILD_STATUS.md, git log, the current test
results and the master spec. Re-run the documented verification commands,
then continue from NEXT ACTION. Do not restart planning from zero.
```

## Do not upload the full research report as the primary instruction

The distilled master spec is deliberately more useful for implementation.
The full report can be attached as optional background, but Claude should
treat the numbered files in this bundle as authoritative.
