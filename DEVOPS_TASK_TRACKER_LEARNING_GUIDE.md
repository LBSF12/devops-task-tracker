# DevOps Task Tracker — Learning Guide and Project Documentation

**Project:** DevOps Task Tracker  
**Repository:** https://github.com/LBSF12/devops-task-tracker  
**Platform:** Node.js 24, GitHub Actions, Microsoft Azure App Service (Linux)  
**Document date:** 24 October 2026  
**Current milestone:** Application deployed and `/health` verified healthy  
**Status:** Phase 1 complete; Docker and Kubernetes for this application are planned

> This is a learning record based on the steps and evidence shared during our project. Example configuration snippets are educational references; compare them with the actual repository before copying them. Do not publish credentials, tenant-specific secrets, or diagnostic tokens.

---

## 1. Why we started this project

We started **DevOps Task Tracker** to rebuild DevOps fundamentals from the beginning, using a small JavaScript application instead of memorizing commands or blindly following instructions. We had previously built a Python-based Azure Security Audit Dashboard with GitHub Actions, Docker, Docker Compose, PostgreSQL, and local Kubernetes, but wanted a second project to make the underlying concepts stick.

### Learning objectives

1. Understand what a web application is and how Node.js runs JavaScript on a server.
2. Practice Git and GitHub as the source-of-truth for application code.
3. Write automated tests and understand continuous integration (CI).
4. Deploy code to Azure App Service through a repeatable continuous deployment (CD) pipeline.
5. Understand identity, trust, and authorization between GitHub and Azure using OpenID Connect (OIDC) and Microsoft Entra ID.
6. Diagnose the difference between successful deployment and a healthy running application.
7. Progress to Docker, image registries, Kubernetes, infrastructure as code, and production-grade release engineering.

**Learning method:** concept → reason for the service → small implementation → verify → troubleshoot → explain back → document.

---

## 2. Application overview

The application is a simple **Node.js / Express REST API** for tracking learning tasks. It currently demonstrates a small collection of tasks and HTTP endpoints.

### Confirmed application behaviors

| Endpoint | Purpose | Evidence |
|---|---|---|
| `GET /` | Return application information, including name and version | Tested locally; response included `DevOps Task Tracker` and version `1.0.0` |
| `GET /health` | Return a basic health response | Tested locally and on Azure; Azure returned `{"status":"healthy"}` |
| `GET /tasks` | Return the in-memory task list | Tested locally; three example learning tasks were returned |

The project also included learning about adding tasks to an in-memory list. **Important:** An in-memory list is not a database. New or modified tasks are not durably saved; restarting the process resets state to what the application initializes at startup. We have **not** yet implemented persistent storage for this Node.js project.

### Local project structure (observed)

```text
 devops-task-tracker/
 ├── .github/
 │   └── workflows/
 │       └── ci.yml
 ├── tests/
 ├── .gitignore
 ├── app.js
 ├── server.js
 ├── package.json
 └── package-lock.json
```

- **`app.js`**: defines the Express application and routes.
- **`server.js`**: starts the HTTP listener, using the Express app.
- **`package.json`**: describes the project, dependencies, and npm scripts.
- **`package-lock.json`**: records the dependency resolution for reproducible installation.
- **`tests/`**: contains automated tests.
- **`.gitignore`**: excludes files that should not be committed, especially `node_modules/`.
- **`.github/workflows/ci.yml`**: describes the automated CI/CD pipeline.

We used Node.js **v24.14.1**, npm **11.11.0**, and Git **2.53.0** locally when checking prerequisites.

---

## 3. Architecture — from developer to running application

```text
 Windows PC / VS Code
       |
       | edit code; npm test; git push
       v
 GitHub repository (main)
       |
       | push event
       v
 GitHub Actions workflow
       |
       +--> Job 1: TEST
       |      checkout source
       |      configure Node.js
       |      npm ci
       |      npm test
       |
       +--> Job 2: DEPLOY [only after TEST succeeds]
              checkout source
              request GitHub OIDC token
              exchange identity with Microsoft Entra ID
              Azure RBAC authorizes deployment
              deploy source to Azure App Service
                          |
                          v
              Azure App Service (Linux, Node.js 24)
              build/install dependencies as configured
              start Node.js process
                          |
                          v
                    Public HTTPS URL
                          |
                          v
                  GET /health => healthy
```

### Responsibilities: who does what?

| Service/tool | What it is | Why we use it |
|---|---|---|
| Node.js | JavaScript runtime | Runs JavaScript outside the browser on a server |
| Express | Node.js web framework | Defines HTTP routes and request/response behavior |
| npm | Package manager | Installs dependencies and runs scripts |
| Git | Version control | Records local code changes as commits |
| GitHub | Remote repository | Stores code and triggers automation |
| GitHub Actions | CI/CD automation platform | Runs tests and deployment jobs after pushes |
| Microsoft Entra ID | Cloud identity platform | Validates the GitHub workload identity |
| App registration | Application identity in Entra ID | Represents the deployment automation to Azure |
| Federated credential | Trust rule for external OIDC tokens | Defines which GitHub workflow identity Entra will accept |
| Azure RBAC | Authorization system | Determines what the application identity may do to Azure resources |
| Azure App Service | Managed web application hosting | Runs our Node.js app without managing an Azure VM |
| App Service Plan | Hosting compute allocation and tier | Defines capacity, region, and supported features |
| Log Stream | Runtime diagnostic viewer | Helps investigate startup errors and application output |

---

## 4. Phase 1A — Learn Node.js and HTTP

### What does `node app.js` mean?

Node.js is a **runtime**, not a web server by itself. The Node.js runtime executes JavaScript. Our code, using Express and the Node.js networking stack, implements the web server behavior.

We separated application definition (`app.js`) from server startup (`server.js`) to make testing easier. For the current project, the startup script uses `node server.js`.

### Verify locally

Start the application using its configured npm start script:

```powershell
npm start
```

In another terminal:

```powershell
curl.exe http://localhost:3000/
curl.exe http://localhost:3000/health
curl.exe http://localhost:3000/tasks
```

**Observed local responses:**

```json
{"application":"DevOps Task Tracker","version":"1.0.0","message":"Hello from Node.js!"}
```

```json
{"status":"healthy"}
```

The task endpoint returned three initial entries: **Learn Node.js**, **Learn GitHub Actions**, and **Learn Docker**.

### Key lesson: memory is not persistent storage

When a request modifies an array in a running Node.js process, it changes the process's memory, **not the JavaScript source file**. After restarting, the process recreates its initial data. To keep tasks across restarts, a later phase should introduce a database or other durable storage.

**Checkpoint question:** Why does restarting the Node.js process lose a task that was added only to an in-memory array?

---

## 5. Phase 1B — Automated tests and CI

We added automated tests and used the built-in Node.js test runner (`node --test`). The tests included checks for:

- `GET /health` returning a healthy status.
- `GET /tasks` returning a list.

### Run tests locally

```powershell
npm test
```

**Observed result:** 2 tests passed, 0 failed.

### Why automate tests?

Tests act as a repeatable **quality gate**. They catch regressions early, before deployment. They do **not** prove that the cloud environment is configured correctly or that the production app is healthy. Tests should eventually expand to cover task creation, input validation, failures, and integration behavior.

### GitHub Actions CI steps

1. **Checkout repository:** place the committed source code in the temporary runner's workspace.
2. **Set up Node.js:** install/select the required Node.js version on the runner.
3. **`npm ci`:** install exact dependencies using the lockfile; useful for repeatable CI environments.
4. **`npm test`:** execute the automated tests.

**Why not commit `node_modules/`?** It is generated dependency content that can be recreated from the package manifests. Excluding it reduces repository size and avoids committing platform-specific files.

We confirmed the initial `Node.js CI` workflow ran successfully on GitHub.

---

## 6. Phase 1C — Azure App Service (Portal-first)

We created a new Azure Web App through the **Azure Portal**, deliberately avoiding Azure CLI for resource creation so we could understand each setting.

### Observed Azure configuration

| Setting | Value |
|---|---|
| Resource group | `rg-security-audit-devops` |
| Web App name | `devops-task-lbsf12` |
| Publish | Code |
| Runtime | Node.js 24 LTS |
| Operating system | Linux |
| Region | Japan West |
| App Service Plan | Existing `asp-security-audit-f1` |
| Plan tier | Free F1 |

**What is an App Service Plan?** It is the underlying hosting compute tier shared by apps assigned to that plan. The plan determines capacity, quotas, supported features, and billing characteristics. The Portal's **1 GB memory** description refers to RAM/capacity, not a promise of 1 GB of persistent database storage.

**Cost awareness:** We reused the existing Free F1 plan to avoid upgrading to paid compute. Free-tier apps have quotas and limitations. Avoid changing tiers or adding paid Azure services without reviewing cost first.

### Why the Deployment tab was disabled during creation

The Azure Portal indicated that configuring GitHub Actions during app creation was not supported with the chosen OS/plan combination. We therefore created the Web App first and configured deployment afterward. This is a valid approach.

### Deployment slots

- **Production:** live version used by customers.
- **Staging slot:** an additional running slot where a release can be tested before swapping to production.
- **Slot swap:** promotes tested content/configuration according to Azure slot-swap behavior.

**Our Free F1 plan does not support deployment slots.** Standard and higher supported tiers provide this capability, but would add cost. For future practice, we can discuss a second free-tier Web App or local staging as a learning simulation; these are **not equivalent** to native App Service slots and do not provide slot swaps.

---

## 7. Phase 1D — OIDC: secure GitHub-to-Azure authentication

This was one of the most important lessons in the project.

### The problem OIDC solves

GitHub Actions must prove its identity before deploying to Azure. A traditional approach is to store a long-lived client secret. Instead, we configured **OpenID Connect federation** so GitHub can request a short-lived identity token that Microsoft Entra ID validates.

### Authentication vs authorization

- **Authentication:** Who is requesting access? Entra ID validates the GitHub OIDC token against the app registration's federated credential.
- **Authorization:** What is that identity allowed to do? Azure RBAC evaluates its role assignment and scope.

A successful OIDC login does not automatically grant permission to deploy; the identity also needs appropriate RBAC permissions.

### What we configured in Azure Portal

1. Opened **Microsoft Entra ID → App registrations**.
2. Created an app registration named **`github-devops-task-tracker`**.
3. Opened **Certificates & secrets → Federated credentials**.
4. Added a credential named **`github-main-oidc`** for the GitHub repository's main branch.
5. Corrected the credential's **subject identifier** to match GitHub's actual customized OIDC token subject.
6. Assigned an appropriate Azure RBAC role at the relevant scope for deployment to the Web App.

### Federated credential matching

Three important token properties must match the Entra configuration:

| Property | Purpose | Value used/observed |
|---|---|---|
| Issuer | Who issued the token? | `https://token.actions.githubusercontent.com` |
| Audience | Who is the token intended for? | `api://AzureADTokenExchange` |
| Subject | Which specific GitHub identity/workflow context is trusted? | Customized subject shown below |

The GitHub run showed the subject:

```text
repo:LBSF12@44965874/devops-task-tracker@1429509355:ref:refs/heads/main
```

The ordinary default GitHub branch subject would be:

```text
repo:LBSF12/devops-task-tracker:ref:refs/heads/main
```

**These are not interchangeable.** Our GitHub token used a customized subject with numeric organization/repository IDs. Entra must trust the **actual** subject GitHub sends.

### GitHub repository variables

Under **GitHub repository → Settings → Secrets and variables → Actions → Variables**, we configured:

- `AZURE_CLIENT_ID`: identifies the Entra application.
- `AZURE_TENANT_ID`: identifies the Entra directory.
- `AZURE_SUBSCRIPTION_ID`: identifies the Azure subscription used for deployment.

These identifiers are **not passwords**; repository variables are suitable for these values. Sensitive credentials should use secrets, but our OIDC workflow does not require a long-lived Azure client secret.

### What happens during an OIDC login?

```text
GitHub Actions job
   |
   | id-token: write allows requesting an OIDC token
   v
GitHub OIDC provider issues signed token
   |
   v
azure/login@v2 presents token to Microsoft Entra ID
   |
   | Entra checks issuer + audience + subject
   v
Entra issues an Azure access token for the app identity
   |
   v
Azure RBAC checks deployment permissions
   |
   v
Azure App Service deployment API
```

**Security insight:** `id-token: write` authorizes the job to request an OIDC token. It does **not** by itself grant Azure permissions. The federated credential establishes trust; Azure RBAC limits actions.

---

## 8. Phase 1E — CI/CD workflow

We initially had a CI-only `ci.yml`. A GitHub run showed only the `test` job, even though we intended to deploy. We inspected the committed YAML and discovered the `deploy` job was missing.

We then updated the workflow to include **two jobs**:

- `test`: install dependencies and run automated tests.
- `deploy`: depend on successful tests, authenticate using OIDC, and deploy the code to Azure.

### Reference workflow

```yaml
name: Node.js CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Run automated tests
        run: npm test

  deploy:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      - name: Login to Azure using OIDC
        uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      - name: Deploy to Azure App Service
        uses: azure/webapps-deploy@v3
        with:
          app-name: devops-task-lbsf12
          package: .
```

**Key ideas:**

- `on: push`: run the workflow after a push to `main`.
- `pull_request`: test proposed changes before merging.
- `needs: test`: deployment waits for tests to pass.
- `if: ... push ... main`: deployment does not run for pull requests.
- `id-token: write`: allow requesting a GitHub OIDC token.
- `azure/login@v2`: authenticate to Azure without storing a client secret.
- `azure/webapps-deploy@v3`: deploy the repository's application content to the named Web App.

**Why are dependencies installed in CI if Azure also installs them?** The CI runner and Azure App Service are different environments. Installing packages on the temporary CI runner is for testing; it does not automatically install packages into the deployed runtime.

**Note on action versions:** The workflow above reflects the versions used during the lab. GitHub later displayed warnings about underlying action runtimes and runner-image changes. Review and upgrade action versions deliberately in a future maintenance phase rather than changing working components blindly.

---

## 9. Phase 1F — Deployment builds and Node.js startup

### Why the Azure setting matters

In Azure App Service we configured the application setting:

```text
SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

For supported source-code deployment flows, this asks Azure's deployment/build tooling to perform the application build, which can include installing npm dependencies. The setting name must be exact.

We initially believed the setting had been applied, but it had not been **saved**. The deployed app could not find `express`, even though the GitHub deployment action reported success. After saving the setting, we redeployed and the application became healthy.

### Application startup

The application uses a Node.js start script to launch `server.js`. The server should listen on the port appropriate for its hosting environment, for example:

```javascript
const app = require('./app');
const port = process.env.PORT || 3000;

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
```

This is an **illustrative startup pattern**, not a verbatim copy of the project's actual `server.js`.

### Why redeploy after saving the setting?

Changing an App Service build setting does not retroactively install dependencies into an already-deployed package. We reran the GitHub Actions pipeline so a new deployment could use the updated build configuration.

---

## 10. Troubleshooting record — real issues we solved

### Incident A — CI passed, but no deploy job appeared

**Symptom:** GitHub Actions showed a green workflow with only `test`.

**Root cause:** The committed `.github/workflows/ci.yml` contained only the CI job.

**Fix:** Added a `deploy` job at the same YAML indentation level as `test`, with `needs: test` and an appropriate push-to-main condition.

**Lesson:** GitHub executes the **committed workflow**, not the workflow we intended to create. Inspect the actual YAML and the job graph.

### Incident B — OIDC authentication failed

**Symptom:** `azure/login@v2` returned:

```text
AADSTS700213: No matching federated identity record found
```

**Root cause:** GitHub's actual token subject contained customized numeric organization/repository IDs, but Entra's federated credential initially trusted a different subject.

**Fix:** Updated the Entra federated credential subject to match the subject printed in the GitHub Actions login logs. Reran the workflow.

**Result:** OIDC login succeeded, and the deploy job advanced.

**Lesson:** Issuer, audience, and subject are precise identity checks. The client/tenant/subscription IDs identify the target but do not establish trust on their own.

### Incident C — Deployment succeeded, but the website returned HTTP 503

**Symptom:** GitHub Actions showed `test` and `deploy` as successful, but the public URL returned **503 Service Unavailable**.

**Evidence from runtime diagnostics:** Azure tried to execute the Node.js start script, then reported:

```text
Error: Cannot find module 'express'
code: 'MODULE_NOT_FOUND'
```

**Root cause identified in the lab:** `SCM_DO_BUILD_DURING_DEPLOYMENT=true` had not been saved as intended, so the deployment did not have the needed Express dependency available at runtime.

**Fix:** Saved the setting, reran the CI/CD workflow, and checked the live endpoint.

**Final verification:** The Azure-hosted `/health` endpoint returned:

```json
{"status":"healthy"}
```

**Lesson:** A green deployment step confirms the deployment action completed; it does **not** guarantee the application started or responds to requests. Always verify runtime health after deployment.

---

## 11. Final verification and current achievements

### Live application

**Base URL:**  
https://devops-task-lbsf12-dre5akhbdzfgdued.japanwest-01.azurewebsites.net/

**Health endpoint:**  
https://devops-task-lbsf12-dre5akhbdzfgdued.japanwest-01.azurewebsites.net/health

**Confirmed on 24 October 2026:** Browser displayed `{"status":"healthy"}` at `/health`.

### Completed milestones

- [x] Created a new JavaScript/Node.js application for learning.
- [x] Learned the difference between Node.js runtime, Express routes, and server startup.
- [x] Tested local HTTP endpoints using `curl.exe`.
- [x] Understood the limitations of in-memory task storage.
- [x] Added automated tests and verified 2 passing tests locally.
- [x] Created a GitHub repository and committed the project.
- [x] Implemented GitHub Actions continuous integration.
- [x] Created an Azure Linux Node.js Web App using the Portal.
- [x] Reused the existing Free F1 App Service Plan.
- [x] Created an Entra app registration for deployment automation.
- [x] Configured a GitHub federated credential with the correct customized OIDC subject.
- [x] Assigned an Azure RBAC role for deployment.
- [x] Added GitHub repository variables for Azure identifiers.
- [x] Implemented a two-job CI/CD workflow.
- [x] Resolved an OIDC subject mismatch.
- [x] Diagnosed a 503 startup failure and missing Express dependency.
- [x] Saved the Azure build setting and redeployed.
- [x] Verified the live `/health` endpoint returns healthy.

### Not yet completed for this Node.js project

- [ ] Persistent task database.
- [ ] Expanded tests and input validation.
- [ ] Dockerfile and local container for this app.
- [ ] Docker image publication to a registry.
- [ ] Kubernetes manifests and deployment for this app.
- [ ] Staging/release approval workflow.
- [ ] Terraform infrastructure as code.
- [ ] Production monitoring, alerts, and hardened security controls.

---

## 12. Useful commands — quick reference

### Local development

```powershell
node --version
npm --version
npm ci
npm test
npm start
```

### Test HTTP endpoints

```powershell
curl.exe http://localhost:3000/health
curl.exe http://localhost:3000/tasks
```

### Git workflow

```powershell
git status
git add .
git commit -m "Describe the change"
git push origin main
```

### Inspect GitHub Actions workflow locally

```powershell
Get-Content .github\workflows\ci.yml
Get-ChildItem .github\workflows\
```

### Check the deployed health endpoint

```powershell
curl.exe https://devops-task-lbsf12-dre5akhbdzfgdued.japanwest-01.azurewebsites.net/health
```

### Azure Portal navigation

- **Web App:** Azure Portal → App Services → `devops-task-lbsf12`.
- **App settings:** Web App → Settings → Environment variables → App settings.
- **Runtime logs:** Web App → Monitoring → Log stream.
- **OIDC credential:** Microsoft Entra ID → App registrations → `github-devops-task-tracker` → Certificates & secrets → Federated credentials.
- **RBAC:** Web App → Access control (IAM) → Role assignments.
- **Workflow:** GitHub repository → Actions → Node.js CI/CD.

---

## 13. What comes next — from beginner to advanced DevOps

We will keep using **the same Node.js Task Tracker** so that each new tool solves a problem we already understand. Avoid jumping to new technologies before we can explain the previous step.

| Phase | Main concept | Practical lab | Definition of done |
|---|---|---|---|
| **2 — Docker** | Container, image, Dockerfile, build, run, port mapping | Containerize Task Tracker locally | `/health` works through a Docker-published port |
| **3 — Registry + CI** | Image tags, immutable versions, registry authentication | Build/test/push image via GitHub Actions to GHCR | A versioned image can be pulled and run on another environment |
| **4 — Kubernetes locally** | Pod, Deployment, ReplicaSet, Service, health probes | Deploy Task Tracker to Docker Desktop Kubernetes | Multiple replicas respond through a Service; failed Pod is replaced |
| **5 — Data and configuration** | Database, environment variables, secrets, persistent volumes | Add persistent task storage in local development | Tasks survive app restarts; secrets are not committed |
| **6 — Release engineering** | Staging, approvals, rollback, smoke tests | Add a staging-style release path and post-deploy `/health` check | A failed release is detected and can be reverted |
| **7 — Infrastructure as Code** | Terraform providers, state, plan, apply, drift | Reproduce selected infrastructure in a controlled lab | Infrastructure changes are reviewed and repeatable |
| **8 — Security and observability** | Least privilege, dependency scanning, logs, metrics, alerts | Harden pipeline and monitor app | Failures and risky changes are visible and actionable |
| **9 — Advanced platform engineering** | Kubernetes networking, ingress, autoscaling, GitOps, Helm | Extend the lab after fundamentals are stable | Explain and operate the system, not just copy manifests |

**Azure cost rule:** Continue with local Docker/Kubernetes and free/low-cost learning environments where possible. Do not create paid ACR, ACI, AKS, or higher App Service tiers without an explicit cost decision and cleanup plan.

### Next hands-on lab: Docker, one concept at a time

1. Explain the difference between an **image** and a **container**.
2. Write a minimal `Dockerfile` for Node.js.
3. Build the image locally.
4. Run it with a host-to-container port mapping.
5. Verify `/health` using `curl.exe`.
6. Stop/remove the test container without deleting source code.
7. Explain how the container includes dependencies and how this differs from the App Service source deployment.

Do **not** begin with Kubernetes YAML yet; Docker fundamentals come first.

---

## 14. Concept review — explain in your own words

1. What is the difference between **Node.js** and **Express**?
2. Why do we commit `package-lock.json` but not `node_modules/`?
3. What is the difference between **CI** and **CD**?
4. What does `needs: test` protect us from?
5. Why do GitHub Actions tests pass even if Azure is missing an npm dependency?
6. What is the difference between **OIDC authentication** and **Azure RBAC authorization**?
7. What does a federated credential's **subject** identify?
8. Why did `AADSTS700213` happen in our lab?
9. Why did GitHub Actions show deployment success while the website returned HTTP 503?
10. Why did saving `SCM_DO_BUILD_DURING_DEPLOYMENT=true` require a new deployment?
11. What does `/health` prove, and what does it **not** prove?
12. How would a Docker image change the way we package our application?

### One-page mental model

> **Git** tracks changes. **GitHub** stores them. **GitHub Actions** tests and deploys them. **OIDC** proves the workflow identity. **Entra ID** verifies trust. **RBAC** authorizes actions. **App Service** runs the application. **Log Stream** helps explain runtime failures. **Health checks** verify that the deployed app responds.

---

## 15. Portfolio notes and recommended next repository improvements

This project already demonstrates more than a basic “Hello World” application because it includes **automated testing, cloud identity federation, least-privilege deployment concepts, troubleshooting, and a verified live deployment**.

Recommended repository improvements:

1. Add a short root `README.md` explaining the project, endpoints, setup, CI/CD, and current status.
2. Store this detailed guide under `docs/DEVOPS_LEARNING_GUIDE.md` or link to it from the root README.
3. Include a simple architecture diagram and a sanitized screenshot of the successful GitHub Actions jobs.
4. Include a sanitized screenshot of the Azure `/health` response.
5. Keep a troubleshooting section that records the OIDC mismatch and missing Express dependency.
6. Never commit `.env` files, credentials, tokens, or raw sensitive log output.
7. Add a post-deployment smoke test in CI/CD so future releases fail visibly if `/health` is not healthy.

### Suggested short README introduction

> **DevOps Task Tracker** is a hands-on learning project that uses a small Node.js/Express REST API to explore real DevOps workflows. It includes automated tests with GitHub Actions, secure passwordless deployment to Azure App Service using GitHub OIDC and Microsoft Entra ID, and runtime verification through a health endpoint. The project will expand incrementally into Docker, container registries, Kubernetes, infrastructure as code, and release engineering.

---

## 16. Final takeaway

The most important achievement is **not just that the application works**. We can now explain the chain from a local code change to a running cloud application, and we have debugged failures at different layers:

- **Workflow definition:** a job was absent from the YAML.
- **Identity federation:** GitHub's OIDC subject did not match Entra's trust rule.
- **Runtime dependencies:** Express was unavailable after deployment.
- **Verification:** the `/health` endpoint confirmed the running application responded.

That is the foundation of a DevOps engineer's approach: **understand the system, automate repeatable work, observe failures, and verify outcomes**.

**Next milestone:** Dockerize this same Node.js application locally, with a small lab and an explanation of every line.
