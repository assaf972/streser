# Jenkins CI for Labguru Performance Testing

> **Version:** 1.0 | **Date:** 2026-05-24 | **Status:** Draft  
> **Scope:** Running the full stress-test suite (k6, Playwright, Cypress, Lighthouse CI, Ruby scripts) on a Windows Server via Jenkins

---

## Table of Contents

| # | Section |
|---|---------|
| 1 | [Solution Overview](#1-solution-overview) |
| 2 | [Architecture Diagram](#2-architecture-diagram) |
| 3 | [Jenkins Installation on Windows Server](#3-jenkins-installation-on-windows-server) |
| 4 | [Required Jenkins Plugins](#4-required-jenkins-plugins) |
| 5 | [Global Tool Configuration](#5-global-tool-configuration) |
| 6 | [Credentials Setup](#6-credentials-setup) |
| 7 | [Pipeline: k6 API Load Tests](#7-pipeline-k6-api-load-tests) |
| 8 | [Pipeline: Playwright UI Performance Tests](#8-pipeline-playwright-ui-performance-tests) |
| 9 | [Pipeline: Cypress Functional Regression Tests](#9-pipeline-cypress-functional-regression-tests) |
| 10 | [Pipeline: Lighthouse CI Frontend Audits](#10-pipeline-lighthouse-ci-frontend-audits) |
| 11 | [Pipeline: Ruby Support Scripts](#11-pipeline-ruby-support-scripts) |
| 12 | [Master Orchestration Pipeline](#12-master-orchestration-pipeline) |
| 13 | [Shared Library Structure](#13-shared-library-structure) |
| 14 | [Results & Reporting](#14-results--reporting) |
| 15 | [Scheduled Runs & Triggers](#15-scheduled-runs--triggers) |
| 16 | [Maintenance & Troubleshooting](#16-maintenance--troubleshooting) |

---

## 1. Solution Overview

Jenkins will serve as the central CI orchestrator for all Labguru performance tests. The approach:

1. **One Jenkinsfile per tool** — each tool (k6, Playwright, Cypress, Lighthouse, Ruby) gets its own pipeline definition with tool-specific stages.
2. **One master orchestration pipeline** — a top-level `Jenkinsfile` that calls the individual pipelines in the correct order (seed → load test → UI test → report).
3. **Windows Server as the Jenkins controller** — Jenkins runs as a Windows service. All tools are installed natively on the same machine (no Docker required, though Docker is supported as an option).
4. **Parameterized builds** — every pipeline accepts parameters for environment (`staging` / `performance`), scale (`100k` / `500k` / `1m`), and molecule tier (`simple` / `standard` / `complex`).
5. **Artifact archival** — all test results (k6 JSON, Playwright HTML reports, Cypress videos, Lighthouse reports) are archived as Jenkins build artifacts.
6. **Threshold-based pass/fail** — k6 and Lighthouse exit with non-zero codes when thresholds fail, which Jenkins interprets as a failed build.

### Why Jenkins?

- Already in use across the organization
- Native Windows service support
- Rich plugin ecosystem for reporting (HTML Publisher, Performance Plugin)
- Parameterized pipelines allow running specific tests or full suites
- Credential management for API tokens
- Scheduled builds (nightly, weekly) via cron syntax

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Windows Server (Jenkins)                      │
│                                                                 │
│  ┌──────────────────────┐   ┌──────────────────────────────┐    │
│  │  Jenkins Controller   │   │  Installed Tools              │    │
│  │  (Windows Service)    │   │                              │    │
│  │                      │   │  • k6 (k6.exe)               │    │
│  │  Port: 8080          │   │  • Node.js 22 LTS            │    │
│  │  JENKINS_HOME:       │   │  • Playwright + Chromium      │    │
│  │  C:\Jenkins          │   │  • Cypress                   │    │
│  │                      │   │  • Lighthouse CI (@lhci/cli)  │    │
│  │  Plugins:            │   │  • Ruby 3.4 (via RubyInstaller│    │
│  │  • Pipeline          │   │    or WSL)                    │    │
│  │  • HTML Publisher     │   │                              │    │
│  │  • Performance        │   └──────────────────────────────┘    │
│  │  • Credentials        │                                      │
│  │  • NodeJS             │                                      │
│  └──────────┬───────────┘                                      │
│             │                                                   │
│  ┌──────────▼───────────┐                                      │
│  │  Workspace            │                                      │
│  │  C:\Jenkins\workspace │                                      │
│  │    └─ stress-tests\   │                                      │
│  │        └─ perf\       │                                      │
│  │           ├─ k6\      │                                      │
│  │           ├─ playwright\                                     │
│  │           ├─ cypress\  │                                      │
│  │           ├─ lighthouse\                                     │
│  │           ├─ scripts\  │                                      │
│  │           └─ results\  │                                      │
│  └──────────────────────┘                                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS
                ┌───────────▼──────────┐
                │  perf.labguru.com     │
                │  (Performance Env)    │
                └──────────────────────┘
```

---

## 3. Jenkins Installation on Windows Server

### 3.1 Prerequisites

| Requirement | Minimum | Notes |
|---|---|---|
| Windows Server | 2019 or 2022 | 64-bit |
| RAM | 8 GB (16 GB recommended) | k6 + Chromium are memory-hungry |
| Disk | 50 GB free | For Jenkins home, test artifacts, browser caches |
| Java (JDK) | 17 or 21 LTS | Jenkins 2.462+ requires Java 17+ |
| Network | Outbound HTTPS to perf.labguru.com | Firewall must allow port 443 outbound |

### 3.2 Install Java

Download and install **Eclipse Temurin JDK 21** (recommended):

```powershell
# Option 1: winget (Windows 11 / Server 2022)
winget install EclipseAdoptium.Temurin.21.JDK

# Option 2: Chocolatey
choco install temurin21jdk -y

# Option 3: Manual
# Download from https://adoptium.net/temurin/releases/
# Run the MSI installer, check "Set JAVA_HOME" and "Add to PATH"
```

Verify:

```powershell
java -version
# Expected: openjdk version "21.x.x"
```

### 3.3 Install Jenkins

```powershell
# Option 1: Windows MSI installer (recommended)
# Download from https://www.jenkins.io/download/
# → LTS release → Windows
# Run the MSI installer

# Option 2: Chocolatey
choco install jenkins -y

# Option 3: Manual WAR file
mkdir C:\Jenkins
cd C:\Jenkins
curl -LO https://get.jenkins.io/war-stable/latest/jenkins.war
```

### 3.4 Configure as Windows Service (MSI installer does this automatically)

If using the WAR file, create a Windows service manually:

```powershell
# Using NSSM (Non-Sucking Service Manager)
choco install nssm -y

nssm install Jenkins "C:\Program Files\Eclipse Adoptium\jdk-21\bin\java.exe"
nssm set Jenkins AppParameters "-Xmx2g -jar C:\Jenkins\jenkins.war --httpPort=8080"
nssm set Jenkins AppDirectory "C:\Jenkins"
nssm set Jenkins AppEnvironmentExtra "JENKINS_HOME=C:\Jenkins\home"
nssm set Jenkins DisplayName "Jenkins CI"
nssm set Jenkins Start SERVICE_AUTO_START

# Start the service
nssm start Jenkins
```

### 3.5 Initial Setup

1. Open `http://localhost:8080` in a browser
2. Retrieve the initial admin password:

   ```powershell
   type C:\Jenkins\home\secrets\initialAdminPassword
   ```

3. Install **suggested plugins** (Pipeline, Git, Credentials, etc.)
4. Create an admin user
5. Set the Jenkins URL to `http://<server-ip>:8080`

### 3.6 Install Test Tools on the Windows Server

#### k6

```powershell
# Chocolatey
choco install k6 -y

# Or manual: download k6-windows-amd64.zip from
# https://github.com/grafana/k6/releases
# Extract k6.exe to C:\tools\k6\ and add to PATH

k6 version
```

#### Node.js

```powershell
choco install nodejs-lts -y
# Or: winget install OpenJS.NodeJS.LTS

node --version   # Expected: v22.x.x
npm --version    # Expected: 10.x.x
```

#### Playwright (browser binaries)

```powershell
cd C:\Jenkins\workspace\stress-tests\perf\playwright
npm install
npx playwright install chromium
# Installs Chromium to %LOCALAPPDATA%\ms-playwright
```

#### Cypress

```powershell
cd C:\Jenkins\workspace\stress-tests\perf\cypress
npm install
# Cypress binary downloads automatically during npm install
```

#### Lighthouse CI

```powershell
cd C:\Jenkins\workspace\stress-tests\perf\lighthouse
npm install
# Or install globally:
npm install -g @lhci/cli
```

#### Ruby (optional — for seeding scripts)

```powershell
# Option 1: RubyInstaller (native Windows)
choco install ruby -y
# Ruby 3.4.x installs to C:\Ruby34-x64

# Option 2: WSL (Windows Subsystem for Linux)
# If the Rails application is Linux-only, use WSL:
wsl --install -d Ubuntu-22.04
# Then install Ruby inside WSL via rbenv or mise
```

### 3.7 Environment Variables (System-wide)

Add these to the system PATH and environment:

```powershell
# Ensure all tools are on PATH
[Environment]::SetEnvironmentVariable("Path",
  "$env:Path;C:\tools\k6;C:\Ruby34-x64\bin",
  "Machine")

# Set JENKINS_HOME if using WAR deployment
[Environment]::SetEnvironmentVariable("JENKINS_HOME",
  "C:\Jenkins\home", "Machine")
```

---

## 4. Required Jenkins Plugins

Install these from **Manage Jenkins → Plugins → Available plugins**:

| Plugin | Purpose |
|---|---|
| **Pipeline** (`workflow-aggregator`) | Declarative & scripted pipeline support. Core requirement. |
| **Pipeline: Stage View** (`pipeline-stage-view`) | Visual stage progress in the build page. |
| **Git** (`git`) | SCM checkout for the stress-tests repository. |
| **NodeJS** (`nodejs`) | Manages Node.js installations for Playwright, Cypress, Lighthouse. |
| **Credentials Binding** (`credentials-binding`) | Injects API tokens and passwords as environment variables. |
| **HTML Publisher** (`htmlpublisher`) | Publishes Playwright HTML reports, Lighthouse reports, Cypress screenshots. |
| **Performance** (`performance`) | Parses k6 JSON output, generates trend charts for response times. |
| **JUnit** (`junit`) | Parses Playwright JUnit XML output for test result tracking. |
| **Timestamper** (`timestamper`) | Adds timestamps to console output (useful for correlating with test timings). |
| **Email Extension** (`email-ext`) | Send failure notifications with attached reports. |
| **Parameterized Trigger** (`parameterized-trigger`) | Trigger downstream jobs with parameters from the master pipeline. |
| **Workspace Cleanup** (`ws-cleanup`) | Clean workspace before/after builds to prevent disk bloat. |
| **PowerShell** (`powershell`) | Run PowerShell scripts natively on Windows (instead of `bat`). |
| **Pipeline Utility Steps** (`pipeline-utility-steps`) | `readJSON`, `writeJSON`, `findFiles` — useful for parsing results. |
| **Slack Notification** (`slack`) | *(Optional)* Send build status to Slack channels. |
| **Blue Ocean** (`blueocean`) | *(Optional)* Modern pipeline visualization UI. |

### Install via Jenkins CLI

```powershell
# Bulk-install plugins from the command line
java -jar C:\Jenkins\home\war\WEB-INF\jenkins-cli.jar `
  -s http://localhost:8080/ `
  -auth admin:YOUR_API_TOKEN `
  install-plugin `
    workflow-aggregator pipeline-stage-view git nodejs `
    credentials-binding htmlpublisher performance junit `
    timestamper email-ext parameterized-trigger ws-cleanup `
    powershell pipeline-utility-steps
```

---

## 5. Global Tool Configuration

Navigate to **Manage Jenkins → Tools**:

### NodeJS Installation

| Setting | Value |
|---|---|
| Name | `NodeJS-22` |
| Install automatically | ✅ |
| Version | `22.x.x` (latest LTS) |
| Global npm packages | `@lhci/cli` |

### Git

| Setting | Value |
|---|---|
| Name | `Default` |
| Path to Git executable | `C:\Program Files\Git\bin\git.exe` (or auto-detect) |

### k6 (Custom Tool)

k6 is not a built-in Jenkins tool — it's called directly from the PATH.  
Ensure `k6.exe` is on the system PATH (see Section 3.6).

---

## 6. Credentials Setup

Navigate to **Manage Jenkins → Credentials → System → Global credentials**:

| Credential ID | Type | Description |
|---|---|---|
| `perf-token-user-a` | Secret text | API token for User A (primary test user) |
| `perf-token-user-b` | Secret text | API token for User B (cross-user degradation tests) |
| `perf-login-email` | Secret text | Login email for Cypress/Playwright browser tests |
| `perf-login-password` | Secret text | Login password for browser tests |
| `lhci-auth-cookie` | Secret text | Authenticated session cookie for Lighthouse CI |
| `slack-webhook` | Secret text | *(Optional)* Slack webhook URL for notifications |

---

## 7. Pipeline: k6 API Load Tests

Create a pipeline job named **`perf-k6-load-tests`**.

### Jenkinsfile: `perf/jenkins/Jenkinsfile.k6`

```groovy
pipeline {
    agent any

    parameters {
        choice(name: 'ENVIRONMENT', choices: ['performance', 'staging'],
               description: 'Target environment')
        choice(name: 'TIER', choices: ['simple', 'standard', 'complex', 'beyond'],
               description: 'Molecule complexity tier')
        choice(name: 'SCALE', choices: ['100k', '500k', '1m'],
               description: 'Dataset scale point')
        string(name: 'SCENARIO', defaultValue: 'all',
               description: 'Specific scenario filename (e.g. pr1-api-create.js) or "all"')
    }

    environment {
        PERF_BASE_URL = "${params.ENVIRONMENT == 'performance' ?
                          'https://perf.labguru.com' :
                          'https://staging.labguru.com'}"
    }

    options {
        timestamps()
        timeout(time: 3, unit: 'HOURS')
        buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Prepare Results Directory') {
            steps {
                powershell '''
                    if (-not (Test-Path "perf\\results\\k6")) {
                        New-Item -ItemType Directory -Path "perf\\results\\k6" -Force
                    }
                '''
            }
        }

        stage('Run k6 Scenarios') {
            steps {
                withCredentials([
                    string(credentialsId: 'perf-token-user-a', variable: 'PERF_TOKEN_A'),
                    string(credentialsId: 'perf-token-user-b', variable: 'PERF_TOKEN_B')
                ]) {
                    script {
                        def scenarios = []
                        if (params.SCENARIO == 'all') {
                            // Find all .js files in k6/scenarios
                            def files = findFiles(glob: 'perf/k6/scenarios/*.js')
                            scenarios = files.collect { it.name }
                        } else {
                            scenarios = [params.SCENARIO]
                        }

                        def results = [:]
                        for (scenario in scenarios) {
                            def scenarioName = scenario.replace('.js', '')
                            stage("k6: ${scenarioName}") {
                                def exitCode = powershell(
                                    returnStatus: true,
                                    script: """
                                        k6 run "perf\\k6\\scenarios\\${scenario}" `
                                          -e BASE_URL=${PERF_BASE_URL} `
                                          -e TOKEN=${PERF_TOKEN_A} `
                                          -e TOKEN_B=${PERF_TOKEN_B} `
                                          -e TIER=${params.TIER} `
                                          -e SCALE=${params.SCALE} `
                                          --out json="perf\\results\\k6\\${scenarioName}.json" `
                                          --summary-export="perf\\results\\k6\\${scenarioName}-summary.json"
                                    """
                                )
                                results[scenarioName] = exitCode == 0 ? 'PASS' : 'FAIL'
                                // k6 exits 99 when thresholds fail — don't abort entire pipeline
                                if (exitCode != 0 && exitCode != 99) {
                                    error "k6 scenario ${scenarioName} crashed (exit ${exitCode})"
                                }
                            }
                        }

                        // Write summary
                        writeJSON file: 'perf/results/k6/run-summary.json', json: results
                    }
                }
            }
        }
    }

    post {
        always {
            // Archive k6 results
            archiveArtifacts artifacts: 'perf/results/k6/**', allowEmptyArchive: true

            // Parse k6 JSON for Performance Plugin trend charts
            perfReport(
                sourceDataFiles: 'perf/results/k6/*-summary.json',
                errorFailedThreshold: 5,
                errorUnstableThreshold: 3
            )
        }
        failure {
            echo 'k6 load tests failed — check threshold violations in the results.'
        }
    }
}
```

---

## 8. Pipeline: Playwright UI Performance Tests

Create a pipeline job named **`perf-playwright-ui-tests`**.

### Jenkinsfile: `perf/jenkins/Jenkinsfile.playwright`

```groovy
pipeline {
    agent any

    parameters {
        choice(name: 'ENVIRONMENT', choices: ['performance', 'staging'],
               description: 'Target environment')
        string(name: 'TEST_FILE', defaultValue: '',
               description: 'Specific test file (e.g. pr7-ready.spec.ts) or empty for all')
    }

    environment {
        BASE_URL = "${params.ENVIRONMENT == 'performance' ?
                     'https://perf.labguru.com' :
                     'https://staging.labguru.com'}"
        CI = 'true'
    }

    options {
        timestamps()
        timeout(time: 1, unit: 'HOURS')
        buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
    }

    tools {
        nodejs 'NodeJS-22'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                dir('perf/playwright') {
                    powershell '''
                        npm ci
                        npx playwright install chromium
                    '''
                }
            }
        }

        stage('Run Playwright Tests') {
            steps {
                withCredentials([
                    string(credentialsId: 'perf-token-user-a', variable: 'PERF_TOKEN'),
                    string(credentialsId: 'perf-login-email',  variable: 'PERF_EMAIL'),
                    string(credentialsId: 'perf-login-password', variable: 'PERF_PASSWORD')
                ]) {
                    dir('perf/playwright') {
                        powershell """
                            \$testArg = if ('${params.TEST_FILE}') { '${params.TEST_FILE}' } else { '' }
                            npx playwright test \$testArg `
                              --reporter=html,json,junit `
                              --output=..\\results\\playwright
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            // Publish Playwright HTML report
            publishHTML(target: [
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'perf/playwright/playwright-report',
                reportFiles: 'index.html',
                reportName: 'Playwright Performance Report'
            ])

            // Archive JSON results
            archiveArtifacts artifacts: 'perf/results/playwright-results.json',
                             allowEmptyArchive: true

            // Parse JUnit XML for test result tracking
            junit testResults: 'perf/playwright/test-results/*.xml',
                  allowEmptyResults: true
        }
        failure {
            echo 'Playwright UI performance tests failed.'
        }
    }
}
```

---

## 9. Pipeline: Cypress Functional Regression Tests

Create a pipeline job named **`perf-cypress-functional`**.

### Jenkinsfile: `perf/jenkins/Jenkinsfile.cypress`

```groovy
pipeline {
    agent any

    parameters {
        choice(name: 'ENVIRONMENT', choices: ['performance', 'staging'],
               description: 'Target environment')
        string(name: 'SPEC', defaultValue: '',
               description: 'Specific spec file or empty for all')
    }

    environment {
        CYPRESS_BASE_URL = "${params.ENVIRONMENT == 'performance' ?
                             'https://perf.labguru.com' :
                             'https://staging.labguru.com'}"
    }

    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
    }

    tools {
        nodejs 'NodeJS-22'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                dir('perf/cypress') {
                    powershell 'npm ci'
                }
            }
        }

        stage('Run Cypress Tests') {
            steps {
                withCredentials([
                    string(credentialsId: 'perf-login-email',    variable: 'CYPRESS_PERF_EMAIL'),
                    string(credentialsId: 'perf-login-password', variable: 'CYPRESS_PERF_PASSWORD')
                ]) {
                    dir('perf/cypress') {
                        powershell """
                            \$specArg = if ('${params.SPEC}') {
                                "--spec `"e2e/${params.SPEC}`""
                            } else { '' }

                            npx cypress run `
                              --config-file cypress.config.js `
                              --browser chrome `
                              --reporter junit `
                              --reporter-options "mochaFile=results/cypress-[hash].xml" `
                              \$specArg
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            // Publish Cypress videos & screenshots
            archiveArtifacts artifacts: 'perf/cypress/cypress/videos/**,perf/cypress/cypress/screenshots/**',
                             allowEmptyArchive: true

            // Parse JUnit results
            junit testResults: 'perf/cypress/results/*.xml',
                  allowEmptyResults: true
        }
        failure {
            echo 'Cypress functional regression tests failed.'
        }
    }
}
```

---

## 10. Pipeline: Lighthouse CI Frontend Audits

Create a pipeline job named **`perf-lighthouse-audits`**.

### Jenkinsfile: `perf/jenkins/Jenkinsfile.lighthouse`

```groovy
pipeline {
    agent any

    parameters {
        choice(name: 'ENVIRONMENT', choices: ['performance', 'staging'],
               description: 'Target environment')
    }

    environment {
        LHCI_BASE_URL = "${params.ENVIRONMENT == 'performance' ?
                          'https://perf.labguru.com' :
                          'https://staging.labguru.com'}"
    }

    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
    }

    tools {
        nodejs 'NodeJS-22'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                dir('perf/lighthouse') {
                    powershell 'npm ci'
                }
            }
        }

        stage('Run Lighthouse CI') {
            steps {
                withCredentials([
                    string(credentialsId: 'lhci-auth-cookie', variable: 'LHCI_AUTH_COOKIE')
                ]) {
                    dir('perf/lighthouse') {
                        powershell '''
                            npx lhci autorun --config=lighthouserc.js
                        '''
                    }
                }
            }
        }
    }

    post {
        always {
            // Publish Lighthouse HTML report
            publishHTML(target: [
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'perf/results/lighthouse',
                reportFiles: '*.html',
                reportName: 'Lighthouse CI Report'
            ])

            archiveArtifacts artifacts: 'perf/lighthouse/.lighthouseci/**',
                             allowEmptyArchive: true
        }
        failure {
            echo 'Lighthouse CI budget assertion failed — check LCP, TTI, TBT, CLS, or bundle size.'
        }
    }
}
```

---

## 11. Pipeline: Ruby Support Scripts

Create a pipeline job named **`perf-ruby-scripts`**.

### Jenkinsfile: `perf/jenkins/Jenkinsfile.ruby`

```groovy
pipeline {
    agent any

    parameters {
        choice(name: 'SCRIPT', choices: [
            'seed_compounds',
            'generate_sdf',
            'generate_excel',
            'monitor_sidekiq',
            'verify_dedup'
        ], description: 'Which Ruby script to run')

        string(name: 'TARGET_COUNT', defaultValue: '100000',
               description: 'For seed_compounds: target record count')
        choice(name: 'SIZE', choices: ['1k', '10k', '100k'],
               description: 'For generate_sdf / generate_excel: file size')
    }

    options {
        timestamps()
        timeout(time: 4, unit: 'HOURS')
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Run Ruby Script') {
            steps {
                script {
                    // Determine which script and arguments
                    def scriptPath = "perf\\scripts\\${params.SCRIPT}.rb"
                    def args = ''
                    switch (params.SCRIPT) {
                        case 'seed_compounds':
                            args = "TARGET_COUNT=${params.TARGET_COUNT}"
                            break
                        case 'generate_sdf':
                        case 'generate_excel':
                            args = "SIZE=${params.SIZE}"
                            break
                    }

                    // On Windows, Ruby scripts that need Rails
                    // should be run via WSL if the app is Linux-only.
                    // Adjust the command based on your setup:
                    if (params.SCRIPT in ['seed_compounds', 'monitor_sidekiq', 'verify_dedup']) {
                        // These require Rails runner — run via SSH to the
                        // performance app server, or via WSL
                        powershell """
                            Write-Host "NOTE: This script requires Rails runner."
                            Write-Host "Run on the performance app server:"
                            Write-Host "  RAILS_ENV=performance ${args} bundle exec rails runner ${scriptPath}"
                        """
                    } else {
                        // Standalone Ruby scripts (generate_sdf, generate_excel)
                        powershell """
                            \$env:${args -replace '=', " = '"}' -replace '$', "'"
                            ruby ${scriptPath}
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'perf/k6/data/generated-*',
                             allowEmptyArchive: true
        }
    }
}
```

> **Note:** Ruby scripts that require `rails runner` (seed, monitor, verify) must run on a machine with access to the Rails application. If the Jenkins server doesn't have the Rails app installed, these scripts should be triggered via SSH to the performance app server or run inside WSL.

---

## 12. Master Orchestration Pipeline

Create a pipeline job named **`perf-full-suite`** that runs the complete test cycle.

### Jenkinsfile: `perf/jenkins/Jenkinsfile`

```groovy
pipeline {
    agent any

    parameters {
        choice(name: 'ENVIRONMENT', choices: ['performance', 'staging'],
               description: 'Target environment')
        choice(name: 'TIER', choices: ['simple', 'standard', 'complex'],
               description: 'Molecule complexity tier')
        choice(name: 'SCALE', choices: ['100k', '500k', '1m'],
               description: 'Dataset scale point')
        booleanParam(name: 'RUN_K6',         defaultValue: true,  description: 'Run k6 API load tests')
        booleanParam(name: 'RUN_PLAYWRIGHT', defaultValue: true,  description: 'Run Playwright UI tests')
        booleanParam(name: 'RUN_CYPRESS',    defaultValue: true,  description: 'Run Cypress functional tests')
        booleanParam(name: 'RUN_LIGHTHOUSE', defaultValue: true,  description: 'Run Lighthouse CI audits')
    }

    options {
        timestamps()
        timeout(time: 6, unit: 'HOURS')
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '5'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('k6 API Load Tests') {
            when { expression { params.RUN_K6 } }
            steps {
                build job: 'perf-k6-load-tests', parameters: [
                    string(name: 'ENVIRONMENT', value: params.ENVIRONMENT),
                    string(name: 'TIER',        value: params.TIER),
                    string(name: 'SCALE',       value: params.SCALE),
                    string(name: 'SCENARIO',    value: 'all')
                ], propagate: false, wait: true
            }
        }

        stage('Playwright UI Performance Tests') {
            when { expression { params.RUN_PLAYWRIGHT } }
            steps {
                build job: 'perf-playwright-ui-tests', parameters: [
                    string(name: 'ENVIRONMENT', value: params.ENVIRONMENT)
                ], propagate: false, wait: true
            }
        }

        stage('Cypress Functional Regression') {
            when { expression { params.RUN_CYPRESS } }
            steps {
                build job: 'perf-cypress-functional', parameters: [
                    string(name: 'ENVIRONMENT', value: params.ENVIRONMENT)
                ], propagate: false, wait: true
            }
        }

        stage('Lighthouse CI Audits') {
            when { expression { params.RUN_LIGHTHOUSE } }
            steps {
                build job: 'perf-lighthouse-audits', parameters: [
                    string(name: 'ENVIRONMENT', value: params.ENVIRONMENT)
                ], propagate: false, wait: true
            }
        }

        stage('Aggregate Results') {
            steps {
                powershell '''
                    Write-Host "=== Build Results ==="
                    Write-Host "Environment: $env:ENVIRONMENT"
                    Write-Host "Tier: $env:TIER"
                    Write-Host "Scale: $env:SCALE"
                    Write-Host "Check individual job results for details."
                '''
            }
        }
    }

    post {
        always {
            echo "Full performance suite completed. Review individual job reports."
        }
    }
}
```

---

## 13. Shared Library Structure

For code reuse across pipelines, create a Jenkins Shared Library:

```
jenkins-shared-library/
├── vars/
│   ├── perfK6Run.groovy           # Reusable k6 run step
│   ├── perfPublishResults.groovy  # Archive + publish HTML reports
│   └── perfNotify.groovy          # Slack / email notification
└── resources/
    └── perf/
        └── email-template.html    # Email template for failure reports
```

### `vars/perfK6Run.groovy`

```groovy
def call(Map config) {
    // config: scenario, baseUrl, tokenCredId, tier, scale, outputDir
    withCredentials([string(credentialsId: config.tokenCredId, variable: 'TOKEN')]) {
        def exitCode = powershell(
            returnStatus: true,
            script: """
                k6 run "perf\\k6\\scenarios\\${config.scenario}" `
                  -e BASE_URL=${config.baseUrl} `
                  -e TOKEN=\$env:TOKEN `
                  -e TIER=${config.tier ?: 'simple'} `
                  -e SCALE=${config.scale ?: '100k'} `
                  --summary-export="${config.outputDir}\\${config.scenario.replace('.js','')}-summary.json"
            """
        )
        return exitCode
    }
}
```

### `vars/perfPublishResults.groovy`

```groovy
def call(Map config) {
    archiveArtifacts artifacts: config.artifacts, allowEmptyArchive: true
    if (config.htmlReportDir) {
        publishHTML(target: [
            allowMissing: true,
            alwaysLinkToLastBuild: true,
            keepAll: true,
            reportDir: config.htmlReportDir,
            reportFiles: 'index.html',
            reportName: config.reportName ?: 'Performance Report'
        ])
    }
}
```

---

## 14. Results & Reporting

### Artifact Structure

After each build, Jenkins archives the following:

```
Build Artifacts/
├── k6/
│   ├── pr1-api-create.json              # Raw k6 stream output
│   ├── pr1-api-create-summary.json      # k6 summary with p95/p99
│   ├── pr2b-text-search-summary.json
│   └── run-summary.json                 # Overall pass/fail per scenario
├── playwright-results.json              # Playwright JSON results
├── playwright-report/
│   └── index.html                       # Interactive HTML report
├── cypress/
│   ├── videos/                          # Test run recordings
│   └── screenshots/                     # Failure screenshots
└── lighthouse/
    └── *.html                           # Lighthouse score reports
```

### Performance Trend Charts

The **Performance Plugin** parses k6 summary JSON files and generates:

- Response time trend charts (p95, p99, avg) over build numbers
- Error rate trend charts
- Threshold pass/fail history

### HTML Reports

The **HTML Publisher Plugin** makes these reports available directly in the Jenkins UI:

- Playwright interactive report (timeline, traces, screenshots)
- Lighthouse scores (LCP, TTI, CLS, TBT)

---

## 15. Scheduled Runs & Triggers

Configure triggers in each pipeline or in the master orchestration job:

### Nightly Full Suite (weekdays at 2 AM)

```groovy
triggers {
    cron('H 2 * * 1-5')
}
```

### Weekly Soak Test (Saturday at midnight, 1M scale)

```groovy
triggers {
    parameterizedCron('''
        H 0 * * 6 % ENVIRONMENT=performance;SCALE=1m;TIER=complex
    ''')
}
```

### On-Demand (Manual)

All pipelines support "Build with Parameters" for ad-hoc runs.

### Post-Deploy Trigger

Add a webhook in your deployment pipeline to trigger `perf-full-suite` after each deploy to the performance environment:

```groovy
// In your deploy pipeline, after successful deploy:
stage('Trigger Perf Tests') {
    steps {
        build job: 'perf-full-suite', parameters: [
            string(name: 'ENVIRONMENT', value: 'performance'),
            string(name: 'TIER', value: 'standard'),
            string(name: 'SCALE', value: '100k')
        ], wait: false
    }
}
```

---

## 16. Maintenance & Troubleshooting

### Common Issues on Windows

| Issue | Solution |
|---|---|
| `k6.exe` not found | Ensure `C:\tools\k6` is in the system PATH. Restart Jenkins service after PATH changes. |
| Playwright browser not found | Run `npx playwright install chromium` under the Jenkins service user account (not your personal account). |
| `npm ci` fails with permissions | Run Jenkins as a service account with write access to `%APPDATA%\npm-cache`. |
| Chromium crashes in headless mode | Ensure Windows Server has the latest Visual C++ Redistributable. Add `--disable-gpu` to Playwright launch options. |
| k6 exits 99 (threshold fail) | This is expected — k6 exit 99 means a threshold was violated. The pipeline handles this gracefully. |
| Long path errors (`MAX_PATH`) | Enable long paths: `reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f` |
| Jenkins workspace grows too large | The `ws-cleanup` plugin deletes old workspaces. Also set `artifactNumToKeepStr` in `buildDiscarder`. |

### Updating Tools

```powershell
# Update k6
choco upgrade k6 -y

# Update Node.js
choco upgrade nodejs-lts -y

# Update Playwright browsers (after npm update)
cd perf\playwright
npm update @playwright/test
npx playwright install chromium

# Update Cypress
cd perf\cypress
npm update cypress

# Update Jenkins plugins
# Manage Jenkins → Plugins → Updates → Select All → Update
```

### Backup

```powershell
# Backup Jenkins configuration (run weekly)
$timestamp = Get-Date -Format "yyyyMMdd"
Compress-Archive -Path "C:\Jenkins\home\jobs", "C:\Jenkins\home\*.xml" `
                 -DestinationPath "D:\backups\jenkins-config-$timestamp.zip"
```

### Service Recovery

```powershell
# Restart Jenkins service
Restart-Service Jenkins

# Check Jenkins logs
Get-Content "C:\Jenkins\home\logs\jenkins.log" -Tail 100

# Verify all tools
k6 version
node --version
npx playwright --version
npx cypress version
ruby --version
```
