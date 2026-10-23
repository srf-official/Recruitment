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

Microsoft .NET application stack, Azure hosting, and Azure SQL Database. Central India is the target region for the backend and database. Final hosting configuration is pending approval.

Administrator authentication will use an application-specific email/password account. Candidate entry requires a name and student ID, without Microsoft sign-in.

## Repository contents

This repository currently contains project documentation and repository configuration. Application code, automated build/test checks, and deployment workflows will be added separately. No live deployment is configured by this initial setup.

## Data and configuration

Keep passwords, connection strings, deployment tokens, candidate details, response exports, and live assessment questions outside Git. Store secrets in protected deployment settings and assessment records in the application database.
