# GitHub to Azure Container Apps

Status: deployment foundation only. The Python bootstrap serves /healthz and returns 503 on all assessment routes. No questions, answers, admin login, or SQL integration exist in this bootstrap. Do not enable production deployment for a recruitment round until those features and load tests are complete.

## Flow

Use the existing develop and main branches. Develop and pull requests into main run CI, including a Docker build and startup probe. After an approved merge to main, the deployment workflow can build an image, push it to ghcr.io/srf-official/recruitment using the workflow's temporary GITHUB_TOKEN, and update the existing ca-turnb-recruitment app. Each image is tagged with the full commit SHA.

Deployment is disabled unless repository variable RECRUITMENT_DEPLOY_ENABLED is exactly true. No workflow runs on develop may deploy. Manual dispatch also requires main. Do not use pull_request_target.

## Setup status

Completed on 2026-10-23 after approval: deployment managed identity created, github-main federated credential saved with immutable owner/repository IDs, and Container Apps Contributor assigned at the single app resource scope. Actions secrets, GHCR package publication, PR merge and deployment enablement remain pending. The live app still runs the Microsoft starter image.

## Setup checklist

1. Approve publishing the container package as public. Source repository visibility does not make GHCR packages public automatically. The image must contain only application code and dependencies. Keep recruitment questions, candidate data, passwords, .env files and SQL credentials out of images and Git.
2. Create an Azure user-assigned managed identity named id-turnb-recruitment-deploy in rg-turnb-recruitment, Central India. This is deployment authentication, separate from the eventual custom administrator login.
3. Add a federated credential with issuer https://token.actions.githubusercontent.com, subject repo:srf-official@317729210/Recruitment@1430666934:ref:refs/heads/main and audience api://AzureADTokenExchange. This authorizes only main-branch jobs from this repository to use the identity; it does not permit develop or pull-request jobs.
4. Grant the identity Container Apps Contributor on this single resource only:
   /subscriptions/4b23b718-8f1c-427f-ae39-f940627739cc/resourceGroups/rg-turnb-recruitment/providers/Microsoft.App/containerApps/ca-turnb-recruitment
   No subscription-wide role and no role-assignment permission are needed. Review role availability and effective permissions in Azure before granting it.
5. Store AZURE_CLIENT_ID (identity's client ID), AZURE_TENANT_ID and AZURE_SUBSCRIPTION_ID as repository Actions secrets. No Azure client password is required. Tenant: 1862453f-d9dc-484f-b927-c88a7bec8928. Subscription: 4b23b718-8f1c-427f-ae39-f940627739cc.
6. After approving a first controlled bootstrap deployment, merge the PR and set RECRUITMENT_DEPLOY_ENABLED=true. Dispatch Deploy to Azure Container Apps from main. The first push creates a PRIVATE package by default. Its anonymous-pull verification should fail safely before Azure is changed. In GitHub's package settings, review the contents and change ONLY this package to public after explicit approval. Rerun the deployment. Leave other packages and repository visibility unchanged.
7. Deployment updates ingress from the Microsoft starter's port 80 to Python port 8000, retains the existing public HTTPS endpoint, and sets min replicas 0 / max replicas 2. The application URL remains the same. No SQL settings are added by this workflow.
8. Replace the bootstrap with the finished Python recruitment app through another reviewed develop-to-main change. Update startup and CI checks appropriately when assessment routes become available.

## Costs and operations

Standard GitHub runners in the current public repository are free. GHCR container storage/bandwidth is currently free under GitHub's published policy. This workflow creates no Azure Container Registry. Azure runtime, logging and network charges still apply beyond applicable allowances. Replica limits are not a monetary spending cap. Check shared monthly allowance and use Azure budget alerts; alerts are not automatic hard stops.

The container uses 0.25 vCPU / 0.5 GiB initially inherited from the starter. Revisit CPU, memory, replicas and SQL capacity after load-testing the finished assessment with 50-75 clients. Keep one replica warm before actual scheduled sessions if needed; that usage counts toward billing. Do not change capacity while an assessment is running.

For rollback, select a previously verified ready revision in Azure and route traffic to it. Record the working revision/image SHA before releases. In-flight requests and assessment correctness must be tested before release; a ready container alone does not prove the assessment works. The deployment workflow fails if the new revision does not become ready; it does not automatically roll back.

## References

- https://learn.microsoft.com/en-us/azure/container-apps/github-actions
- https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect
- https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
