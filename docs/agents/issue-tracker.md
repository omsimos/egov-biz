# Issue tracker: Local Markdown

Issues and PRDs for this repo live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The PRD is `.scratch/<feature-slug>/PRD.md`
- Implementation issues are `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- An issue may use a `Status:` line when its workflow needs one; no repository-wide triage vocabulary is configured
- Comments and conversation history append under a `## Comments` heading

## When a skill says “publish to the issue tracker”

Create a file under `.scratch/<feature-slug>/`, creating the directory if necessary.

## When a skill says “fetch the relevant ticket”

Read the referenced local Markdown file. The user will normally provide its path or issue number.

## Wayfinding operations

- Map: `.scratch/<effort>/map.md`
- Child ticket: `.scratch/<effort>/issues/<NN>-<slug>.md`
- A `Type:` line may use `research`, `prototype`, `grilling`, or `task`
- A `Status:` line uses `claimed` or `resolved`
- Dependencies use `Blocked by: NN, NN`
- Claim work by setting `Status: claimed`
- Resolve work by adding an `## Answer`, setting `Status: resolved`, and updating the map
