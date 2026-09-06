# Recovery status — 2026-09-06

## Recovered
- Full earlier source checkpoint from `last-light-bay-checkpoint.zip`, version 8, saved 2026-09-05 10:30:45 UTC (383,622,333 bytes).
- All decodable text files from that checkpoint: source, scripts, manifests, reviews, measurements and 91 preexisting Markdown files.
- Runtime public assets, losslessly archived in `recovery/asset-parts/`. Run `python3 recovery/restore-assets.py` from the repository root before installing/building.
- Original user build prompt (26,750 bytes) and all project follow-up prompts visible in the current context. Missing earlier transcript content is explicitly marked, never invented.
- Small historical screenshot ZIP in `recovery/last-light-bay-screenshots.zip`.

## Newer source exists but was not recovered
Sites project `appgprj_6a9b6e5ab4fc819189390e9ed1504847`.
Source branch `work/realism-recovered`, head `1badffc5176d623b1e2a770c12703f44dd980b73`.
Normal, shallow and filtered clone attempts all failed with HTTP 500 while receiving packfile. The server ignored filtering. This is a service failure, not evidence the newer source is gone.
Use Sites source-repository credentials in the owning account to clone that branch when the service recovers; compare before replacing files. Credentials intentionally omitted. The GitHub target was empty before this handoff.

The later progress summary records changes beyond the recovered ZIP. Those later changes are NOT claimed to be present here. In particular, the final reported sand integration was still awaiting its build result in the supplied transcript.

## Historical image evidence
The large original checkpoint also contains full PNG study outputs. To keep this credit-limited handoff efficient, these bulk historical image binaries are not duplicated here; their text reviews/JSON and the small screenshot ZIP are included. Recover the complete checkpoint from its existing saved file if needed: `libfile_f939d98f812081918f95b3762d24fe34`, version 8. Local paths mentioned by old reviews may have been removed by automated workspace maintenance.

## Validation scope
Handoff verified archive recovery, source inventory, absence of obvious embedded credential patterns in exported text, and GitHub write access. No fresh visual acceptance, browser QA, final video export or public deployment occurred. Preserve honest failed/pending gates. The source snapshot remains unfinished.
