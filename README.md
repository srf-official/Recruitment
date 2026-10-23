# TurnB Recruitment

A web application for running TurnB recruitment assessments.

## Planned workflow

Administrators edit assessment questions, create named test sessions, generate candidate links, monitor submissions, stop a session, and export Word documents.

Candidates enter their name and student ID using a session link. Each session has a shared 30-minute window. Late arrivals receive only the remaining time. Drafts are saved automatically; submitted or ended attempts are locked.

## Branches

- `main`: stable, production-ready code.
- `develop`: ongoing development and testing.

Make changes on `develop`, test them, then open a pull request into `main`. Use release tags such as `v1.0.0` to identify released versions. Additional long-lived branches are not required.

## Technology direction

Python on Azure Container Apps Consumption, with Azure SQL Database in Central India. The existing Azure app currently runs the Microsoft starter image. GitHub Actions and GHCR are the selected build and image delivery services.

Administrator authentication will use an application-specific email/password account. Candidate entry requires a name and student ID, without Microsoft sign-in.

## Repository contents

This change adds a Python deployment bootstrap, Dockerfile, CI and a gated deployment workflow. It does not implement recruitment features yet. The bootstrap exposes /healthz and returns 503 for assessment routes. Production deployment remains disabled until explicitly enabled after identity, registry access and release approval. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Data and configuration

Keep passwords, connection strings, deployment tokens, candidate details, response exports, and live assessment questions outside Git. Store secrets in protected deployment settings and assessment records in the application database.
