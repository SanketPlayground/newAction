const core = require('@actions/core');
const xlsx = require('xlsx');
const { Octokit } = require('@octokit/rest');
const Pivot = require('quick-pivot');
const { graphql } = require('@octokit/graphql');

async function getDependabotReport(org, repo, token) {
    const query = `
      {
        repository(owner: "${org}", name: "${repo}") {
          vulnerabilityAlerts(first: 100) {
            nodes {
              securityVulnerability {
                advisory {
                  ghsaId
                  description
                }
                package {
                  ecosystem
                  name
                }
                severity
              }
            }
          }
        }
      }
    `;

    try {
        const response = await graphql(query, {
            headers: {
                authorization: `token ${token}`,
                accept: 'application/vnd.github.v3+json'
            }
        });

        const csvData = [['ghsaId', 'packageName', 'packageManager', 'severity', 'description']];
        const nodes = response.repository.vulnerabilityAlerts.nodes;
        for (const node of nodes) {
            const alert = node.securityVulnerability;
            csvData.push([
                alert.advisory.ghsaId,
                alert.package.name,
                alert.package.ecosystem,
                alert.severity,
                alert.advisory.description
            ]);
        }

        return csvData;
    } catch (error) {
        console.error('Error fetching Dependabot report:', error);
        return [];
    }
}

async function getCodeScanningReport(org, repo, octokit) {
    try {
        const data = await octokit.request('GET /repos/{owner}/{repo}/code-scanning/alerts', {
            owner: org,
            repo: repo
        });

        const csvData = [['ruleId', 'ruleSeverity', 'ruleDescription', 'file', 'line', 'tool', 'toolVersion', 'state']];
        for (const alert of data.data.alerts) {
            csvData.push([
                alert.rule_id,
                alert.rule_severity,
                alert.rule_description,
                alert.file,
                alert.line,
                alert.tool_name,
                alert.tool_version,
                alert.state
            ]);
        }

        return csvData;
    } catch (error) {
        console.error('Error fetching Code Scanning report:', error);
        return [];
    }
}

async function getDependencyGraphReport(org, repo, token) {
    const query = `
      {
        repository(owner: "${org}", name: "${repo}") {
          dependencyGraphManifests(first: 100) {
            nodes {
              dependencies(first: 100) {
                nodes {
                  packageName
                  packageManager
                  requirements
                }
              }
            }
          }
        }
      }
    `;

    try {
        const response = await graphql(query, {
            headers: {
                authorization: `token ${token}`,
                accept: 'application/vnd.github.hawkgirl-preview+json'
            }
        });

        const csvData = [['packageName', 'packageManager', 'requirements']];
        const nodes = response.repository.dependencyGraphManifests.nodes;
        for (const node of nodes) {
            for (const dep of node.dependencies.nodes) {
                csvData.push([dep.packageName, dep.packageManager, dep.requirements]);
            }
        }

        return csvData;
    } catch (error) {
        console.error('Error fetching Dependency Graph report:', error);
        return [];
    }
}

async function getSecretScanningReport(org, repo, octokit) {
    try {
        const alerts = await octokit.paginate('GET /repos/{owner}/{repo}/secret-scanning/alerts', {
            owner: org,
            repo: repo
        });

        const csvData = [['secretType', 'secret', 'state', 'resolution']];
        for (const alert of alerts) {
            csvData.push([alert.secret_type, alert.secret, alert.state, alert.resolution]);
        }

        return csvData;
    } catch (error) {
        console.error('Error fetching Secret Scanning report:', error);
        return [];
    }
}

async function fetchAPIResults(org, repo, after, token) {
    const query = `
      {
        repository(owner: "${org}", name: "${repo}") {
          vulnerabilityAlerts(first: 100 ${after ? `, after: "${after}"` : ''}) {
            nodes {
              securityVulnerability {
                advisory {
                  ghsaId
                  description
                }
                package {
                  ecosystem
                  name
                }
                severity
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    try {
        const response = await graphql(query, {
            headers: {
                authorization: `token ${token}`,
                accept: 'application/vnd.github.v3+json'
            }
        });

        return response;
    } catch (error) {
        console.error('Error fetching API results:', error);
        return null;
    }
}

function getQuery(org, repo, after) {
    const query = `
      {
        repository(owner: "${org}", name: "${repo}") {
          vulnerabilityAlerts(first: 100 ${after ? `, after: "${after}"` : ''}) {
            nodes {
              securityVulnerability {
                advisory {
                  ghsaId
                  description
                }
                package {
                  ecosystem
                  name
                }
                severity
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    return query;
}

async function run() {
    try {
        const token = core.getInput('token');
        if (!token) {
            core.error('Please set the INPUT_TOKEN environment variable');
            return;
        }

        const octokit = new Octokit({ auth: token });

        const org = core.getInput('organization');
        if (!org) {
            core.error('Please provide the organization name');
            return;
        }

        const repos = await getAllReposInOrg(org, octokit);
        if (!repos || repos.length === 0) {
            core.error(`No repositories found in the organization ${org}`);
            return;
        }

        for (const repo of repos) {
            const dgIssues = await getDependabotReport(org, repo, token);
            const csIssues = await getCodeScanningReport(org, repo, octokit);
            const dgInfo = await getDependencyGraphReport(org, repo, token);
            const secretScanningAlerts = await getSecretScanningReport(org, repo, octokit);

            let dgPivotData = [];
            let csPivotData = [];


            dgPivotData = generatePivot(['packageName'], ['packageManager'], 'requirements', 'count', dgInfo);
            csPivotData = generatePivot(['ruleId'], ['ruleSeverity'], 'file', 'count', csIssues);

            const wb = xlsx.utils.book_new();
            const ws1 = xlsx.utils.aoa_to_sheet(dgInfo);
            const ws2 = xlsx.utils.aoa_to_sheet(dgPivotData);
            const ws3 = xlsx.utils.aoa_to_sheet(csIssues);
            const ws4 = xlsx.utils.aoa_to_sheet(csPivotData);
            const ws5 = xlsx.utils.aoa_to_sheet(secretScanningAlerts);

            xlsx.utils.book_append_sheet(wb, ws1, 'dependencies-list');
            xlsx.utils.book_append_sheet(wb, ws2, 'dependencies-pivot');
            xlsx.utils.book_append_sheet(wb, ws3, 'code-scanning-issues');
            xlsx.utils.book_append_sheet(wb, ws4, 'code-scanning-pivot');
            xlsx.utils.book_append_sheet(wb, ws5, 'secret-scanning-alerts');

            xlsx.writeFile(wb, `${repo}_reports.xlsx`);

            console.log('dgInfo:', dgInfo);
            console.log('csIssues:', csIssues);
            console.log('dgPivotData:', dgPivotData);
            console.log('csPivotData:', csPivotData);
            console.log('secretScanningAlerts:', secretScanningAlerts);
        }
    } catch (error) {
        console.error('Error:', error);
        core.setFailed(error.message);
    }
}

function generatePivot(rowHeader, colHeader, aggregationHeader, aggregator, data) {
    const pivot = new Pivot(data, rowHeader, colHeader, [aggregationHeader], aggregator);
    return pivot.table;
}

async function getAllReposInOrg(org, octokit) {
    const repos = [];
    let page = 1;
    let response;
    do {
        response = await octokit.repos.listForOrg({
            org: org,
            per_page: 100,
            page: page++
        });
        repos.push(...response.data.map(repo => repo.name));
    } while (response.data.length === 100);
    return repos;
}

run();
