const core = require('@actions/core');
const xlsx = require('xlsx');
const { Octokit } = require('@octokit/rest');
const Pivot = require('quick-pivot');
const { graphql } = require('@octokit/graphql');

async function run() {
  try {
    const token = core.getInput('token');
    if (!token) {
      core.error('Please set the INPUT_TOKEN env variable');
      return;
    }

    const octokit = new Octokit({
      auth: token
    });

    let repo = core.getInput('repo');
    let login = '';
    let repoName = '';
    if (!repo) {
      repo = process.env.GITHUB_REPOSITORY;
    }

    if (repo) {
      [login, repoName] = repo.split('/');
    } else {
      core.error('Could not find repo, please set the GITHUB_REPOSITORY env variable');
      return;
    }

    const dgIssues = await getDependabotReport(login, repoName);
    const csIssues = await getCodeScanningReport(login, repoName, octokit);
    const dgInfo = await getDependencyGraphReport(login, repoName);
    const secretScanningAlerts = await getSecretScanningReport(octokit, login, repoName);

    const dgPivotData = generatePivot(
      ['manifest'],
      ['licenseInfo'],
      'packageName',
      'count',
      dgInfo
    );

    const csPivotData = generatePivot(
      ['cwe'],
      ['severity'],
      'html_url',
      'count',
      csIssues
    );

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(csIssues);
    const ws1 = xlsx.utils.aoa_to_sheet(dgInfo);
    const ws2 = xlsx.utils.aoa_to_sheet(dgPivotData);
    const ws3 = xlsx.utils.aoa_to_sheet(csPivotData);
    const ws4 = xlsx.utils.aoa_to_sheet(secretScanningAlerts);
    const ws5 = xlsx.utils.aoa_to_sheet(dgIssues);

    xlsx.utils.book_append_sheet(wb, ws, 'code-scanning-issues');
    xlsx.utils.book_append_sheet(wb, ws1, 'dependencies-list');
    xlsx.utils.book_append_sheet(wb, ws2, 'dependencies-license-pivot');
    xlsx.utils.book_append_sheet(wb, ws3, 'code-scanning-Pivot');
    xlsx.utils.book_append_sheet(wb, ws4, 'secret-scanning-alerts');
    xlsx.utils.book_append_sheet(wb, ws5, 'software-composition-analysis');

    xlsx.writeFile(wb, 'alerts.xlsx');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

run();

async function getSecretScanningReport(octokit, login, repoName) {
  const csvData = [];
  try {
    const secretScanningAlerts = await octokit.paginate(
      octokit.rest.secretScanning.listAlertsForRepo,
      {
        owner: login,
        repo: repoName
      }
    );

    const header = [
      'html_url',
      'secret_type',
      'secret',
      'state',
      'resolution'
    ];

    csvData.push(header);
    for (const alert of secretScanningAlerts) {
      const row = [
        alert.html_url,
        alert.secret_type,
        alert.secret,
        alert.state,
        alert.resolution
      ];
      csvData.push(row);
    }
    return csvData;
  } catch (error) {
    core.error(error.message);
    csvData.push([error.message, '', '', '', '']);
    return csvData;
  }
}

function generatePivot(rowHeader, colHeader, aggregationHeader, aggregator, dgInfo) {
  const aggregationDimensions = [aggregationHeader];
  const pivot = new Pivot(
    dgInfo,
    rowHeader,
    colHeader,
    aggregationDimensions,
    aggregator
  );

  const pivotData = [];
  for (const row of pivot.data.table) {
    const pivotRow = [];
    for (const col of row.value) {
      pivotRow.push(col);
    }
    pivotData.push(pivotRow);
  }
  return pivotData;
}

async function getCodeScanningReport(login, repoName, octokit) {
  const data = await octokit.paginate(
    octokit.rest.codeScanning.listAlertsForRepo,
    {
      owner: login,
      repo: repoName
    }
  );

  const csvData = [];
  const header = [
    'toolName',
    'toolVersion',
    'alertNumber',
    'htmlUrl',
    'state',
    'rule',
    'cwe',
    'severity',
    'location',
    'start-line',
    'end-line',
    'createdAt',
    'updatedAt',
    'fixedAt',
    'dismissedAt',
    'dismissedBy'
  ];

  csvData.push(header);
  for (const alert of data) {
    let securitySeverity = '';
    let securityCwe = '';
    if (alert.rule.security_severity_level) {
      securitySeverity = alert.rule.security_severity_level;
    } else {
      securitySeverity = alert.rule.severity;
    }
    for (const cwe of alert.rule.tags) {
      if (cwe.includes('external/cwe/cwe')) {
        securityCwe = `${securityCwe}${cwe}, `;
      }
    }
    securityCwe = securityCwe.replace(/,\s*$/, '');
    const row = [
      alert.tool.name,
      alert.tool.version,
      alert.number.toString(),
      alert.html_url,
      alert.state,
      alert.rule.id,
      securityCwe,
      securitySeverity,
      alert.most_recent_instance.location.path,
      alert.most_recent_instance.location.start_line,
      alert.most_recent_instance.location.end_line,
      alert.created_at,
      alert.updated_at,
      alert.fixed_at,
      alert.dismissed_at,
      alert.dismissed_by
    ];

    csvData.push(row);
  }

  return csvData;
}

async function getDependencyGraphReport(login, repoName) {
  const { repository } = await graphql(
    `
      {
        repository(owner: "${login}", name: "${repoName}") {
          name
          licenseInfo {
            name
          }
          dependencyGraphManifests {
            totalCount
            edges {
              node {
                filename
                dependencies {
                  edges {
                    node {
                      packageName
                      packageManager
                      requirements
                      repository {
                        licenseInfo {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    {
      headers: {
        authorization: `token ${core.getInput('token')}`,
        accept: 'application/vnd.github.hawkgirl-preview+json'
      }
    }
  );

  const csvData = [];
  const header = [
    'manifest',
    'packageName',
    'packageManager',
    'requirements',
    'licenseInfo'
  ];

  csvData.push(header);
  for (const dependency of repository.dependencyGraphManifests.edges) {
    for (const dependencyEdge of dependency.node.dependencies.edges) {
      let licenseInfo = '';
      if (
        dependencyEdge.node &&
        dependencyEdge.node.repository &&
        dependencyEdge.node.repository.licenseInfo
      ) {
        licenseInfo = dependencyEdge.node.repository.licenseInfo.name;
      }
      const row = [
        dependency.node.filename,
        dependencyEdge.node.packageName,
        dependencyEdge.node.packageManager,
        dependencyEdge.node.requirements,
        licenseInfo
      ];

      csvData.push(row);
    }
  }
  return csvData;
}

async function getDependabotReport(login, repoName) {
  const csvData = [];
  const header = [
    'ghsaId',
    'packageName',
    'packageManager',
    'severity',
    'firstPatchedVersion',
    'description'
  ];

  csvData.push(header);

  try {
    let response;
    let after = '';
    do {
      response = await fetchAPIResults(login, repoName, after);
      after = response.repository.vulnerabilityAlerts.pageInfo.endCursor;
      for (const dependency of response.repository.vulnerabilityAlerts.nodes) {
        let version = 'na';
        if (dependency.securityVulnerability.firstPatchedVersion != null) {
          version =
            dependency.securityVulnerability.firstPatchedVersion.identifier;
        }

        const row = [
          dependency.securityVulnerability.advisory.ghsaId,
          dependency.securityVulnerability.package.name,
          dependency.securityVulnerability.package.ecosystem,
          dependency.securityVulnerability.advisory.severity,
          version,
          dependency.securityVulnerability.advisory.description
        ];

        csvData.push(row);
      }
    } while (response.repository.vulnerabilityAlerts.pageInfo.hasNextPage);

    return csvData;
  } catch (error) {
    core.error(error.message);
    csvData.push([error.message, '', '', '', '']);
    return csvData;
  }
}

async function fetchAPIResults(login, repoName, after) {
  const response = await graphql(getQuery(login, repoName, after), {
    headers: {
      authorization: `token ${core.getInput('token')}`,
      accept: 'application/vnd.github.hawkgirl-preview+json'
    }
  });
  return response;
}

function getQuery(login, repoName, after) {
  const query = `
      {
        repository(owner: "${login}", name: "${repoName}") {
          vulnerabilityAlerts(first: 100 ${after ? `, after: "${after}"` : ''}) {
            nodes {
              createdAt
              dismissedAt
              securityVulnerability {
                package {
                  name
                  ecosystem
                }
                advisory {
                  description
                  permalink
                  severity
                  ghsaId
                }
                firstPatchedVersion {
                  identifier
                }
              }
            }
            totalCount
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
