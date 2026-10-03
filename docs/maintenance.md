# Maintenance checklist

## Every change

- Open an issue for the intended behavior.
- Add or update a test for the behavior.
- Run backend tests and the frontend production build locally.
- Review the diff before merging.

## Each release

- Confirm `/health` responds successfully.
- Review application logs for errors.
- Verify the deployed frontend can load the API.
- Record user-visible changes in `CHANGELOG.md`.
- Create a Git tag after the main branch is green.

## Recovery

The local SQLite file is disposable during development. Production backup,
restore, and rollback commands are documented in
[`deployment.md`](deployment.md). Test restoration against a separate Neon
branch or database before relying on the procedure.
