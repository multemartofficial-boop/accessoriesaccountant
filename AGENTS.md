<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Git push target

- Always push to the `deploy` remote
  (https://github.com/multemartofficial-boop/accessoriesaccountant), branch `main`:
  `git push deploy main`.
- Do not push to `origin` (AdritoAshraf/garment-trade-flow) unless the user asks.

## Verification

- `npx tsc --noEmit -p .`
- `npx eslint <changed files>` (prettier is enforced via eslint; fix with `npx prettier --write <file>`)
