# Contributing Guidelines

This is a proprietary private project. Contributions are accepted only from authorized collaborators with explicit permission from the owner.

## Access Rules

- Do not fork, clone, download, mirror, redistribute, or reuse this repository unless the owner has explicitly authorized it.
- Do not share repository access, source code, screenshots of private implementation details, credentials, or internal documentation with third parties.
- Do not use this codebase for external commercial work, derivative products, client projects, training material, or public examples without written permission.

## Development Workflow

1. Create a branch from the protected base branch.
2. Use a clear branch name, for example `feature/technician-pricing-ui` or `fix/payment-confirmation-cache`.
3. Keep pull requests focused and small enough to review.
4. Include screenshots or screen recordings for UI changes.
5. Include validation notes in the pull request.
6. Request review from the CODEOWNERS.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Use PowerShell on Windows:

```powershell
Copy-Item .env.example .env
npm run dev
```

Never commit the `.env` file.

## Required Checks

Run these checks before opening or merging a pull request:

```bash
npm run build
npm test
npm run lint
npm audit
```

If a check cannot be run, document the reason in the pull request.

## Code Standards

- Follow the existing React, TypeScript, Tailwind, shadcn/ui, and service-client patterns.
- Keep API calls centralized through the existing API helpers where practical.
- Keep backend secrets out of client code.
- Prefer typed interfaces over `any`.
- Keep generated build output, logs, APK files, and local artifacts out of commits unless the owner explicitly asks for them.
- Update README and `.env.example` when environment variables or setup steps change.

## Security

- Report vulnerabilities privately according to `SECURITY.md`.
- Do not run destructive tests against production.
- Do not commit secrets, credentials, database exports, signing keys, private certificates, or real customer data.
- Rotate any credential that is accidentally committed or shared.
