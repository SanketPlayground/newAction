import * as core from '@actions/core'
import * as xlsx from 'xlsx'
import { Octokit } from '@octokit/rest'
import Pivot from 'quick-pivot'
import { graphql } from '@octokit/graphql'

async function generateSecurityReportForRepo(repo: string, token: string): Promise<void> {
  try {
    if (!token) {
      core.error('Please set the INPUT_TOKEN env variable')
      return
    }

    const octokit = new Octokit({ auth: token })
    let login = ''
    let repoName = ''

    if (repo) {
      login = repo.split('/')[0]
      repoName = repo.split('/')[1]
    } else {
      core.error('Could not find repo, please set the GITHUB_REPOSITORY env variable')
      return
    }

    const dgIssues: string[][] = await getDependabotReport(login, repoName, token)
    const csIssues: string[][] = await getCodeScanningReport(login, repoName, octokit)
    const dgInfo: string[][] = await getDependencyGraphReport(login, repoName, token)
    const secretScanningAlerts: string[][] = await getSecretScanningReport(octokit, login, repoName)

    const dgPivotData: string[][] = generatePivot(
      ['manifest'],
      ['licenseInfo'],
      'packageName',
      'count',
      dgInfo
    )
    const csPivotData: string[][] = generatePivot(
      ['cwe'],
      ['severity'],
      'html_url',
      'count',
      csIssues
    )

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.aoa_to_sheet(csIssues)
    const ws1 = xlsx.utils.aoa_to_sheet(dgInfo)
    const ws2 = xlsx.utils.aoa_to_sheet(dgPivotData)
    const ws3 = xlsx.utils.aoa_to_sheet(csPivotData)
    const ws4 = xlsx.utils.aoa_to_sheet(secretScanningAlerts)
    const ws5 = xlsx.utils.aoa_to_sheet(dgIssues)

    xlsx.utils.book_append_sheet(wb, ws, 'code-scanning-issues')
    xlsx.utils.book_append_sheet(wb, ws1, 'dependencies-list')
    xlsx.utils.book_append_sheet(wb, ws2, 'dependencies-license-pivot')
    xlsx.utils.book_append_sheet(wb, ws3, 'code-scanning-Pivot')
    xlsx.utils.book_append_sheet(wb, ws4, 'secret-scanning-alerts')
    xlsx.utils.book_append_sheet(wb, ws5, 'software-composition-analysis')

    xlsx.writeFile(wb, `${repo.replace('/', '-')}-alerts.xlsx`)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function getSecretScanningReport(
  octokit: Octokit,
  login: string,
  repoName: string
): Promise<string[][]> {
  try {
    const csvData: string[][] = []
    const secretScanningAlerts = await octokit.paginate(
      octokit.rest.secretScanning.listAlertsForRepo,
      {
        owner: login,
        repo: repoName
      }
    )

    const header: string[] = [
      'html_url',
      'secret_type',
      'secret',
      'state',
      'resolution'
    ]

    csvData.push(header)
    for (const alert of secretScanningAlerts) {
      const row: string[] = [
        alert.html_url!,
        alert.secret_type!,
        alert.secret!,
        alert.state!,
        alert.resolution!
      ]
      csvData.push(row)
    }
    return csvData
  } catch (error) {
    if (error instanceof Error) {
      core.error(error.message)
      return [[error.message, '', '', '', '']]
    }
    return [[]]
  }
}

function generatePivot(
  rowHeader: string[],
  colHeader: string[],
  aggregationHeader: string,
  aggregator: string,
  dgInfo: string[][]
): string[][] {
  const aggregationDimensions = [`${aggregationHeader}`]
  const pivot = new Pivot(
    dgInfo,
    rowHeader,
    colHeader,
    aggregationDimensions,
    aggregator
  )

  const pivotData: string[][] = []
  for (const row of pivot.data.table) {
    const pivotRow: string[] = []
    for (const col of row.value) {
      pivotRow.push(col)
    }
    pivotData.push(pivotRow)
  }
  return pivotData
}

async function getCodeScanningReport(
  login: string,
  repoName: string,
  octokit: Octokit
): Promise<string[][]> {
  try {
    const data = await octokit.paginate(
      octokit.rest.codeScanning.listAlertsForRepo,
      {
        owner: login,
        repo: repoName
      }
    )

    const csvData: string[][] = []
    const header: string[] = [
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
    ]

    csvData.push(header)
    for (const alert of data) {
      const rule: any = alert.rule
      let securitySeverity = ''
      let securityCwe = ''
      if (rule.security_severity_level) {
        securitySeverity = rule.security_severity_level
      } else {
        securitySeverity = rule.severity
      }
      for (const cwe of rule.tags) {
        if (cwe.includes('external/cwe/cwe')) {
          securityCwe = `${securityCwe}${cwe}, `
        }
      }
      securityCwe = securityCwe.replace(/,\s*$/, '')
      const _alert: any = alert
      const row: string[] = [
        alert.tool.name!,
        alert.tool.version!,
        alert.number.toString(),
        alert.html_url,
        alert.state,
        rule.id,
        securityCwe,
        securitySeverity,
        alert.most_recent_instance.location!.path,
        alert.most_recent_instance.location!.start_line,
        alert.most_recent_instance.location!.end_line,
        alert.created_at,
        _alert.updated_at,
        _alert.fixed_at,
        alert.dismissed_at,
        alert.dismissed_by
      ]

      csvData.push(row)
    }

    return csvData
  } catch (error) {
    if (error instanceof Error) {
      core.error(error.message)
      return [[error.message]]
    }
    return [[]]
  }
}

async function getDependencyGraphReport(
  login: string,
  repoName: string,
  token: string
): Promise<string[][]> {
  try {
    const response: { repository: any } = await graphql(
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
          authorization: `token ${token}`,
          accept: 'application/vnd.github.hawkgirl-preview+json'
        }
      }
    )

    const csvData: string[][] = []
    const header: string[] = [
      'manifest',
      'packageName',
      'packageManager',
      'requirements',
      'licenseInfo'
    ]

    csvData.push(header)
    for (const dependency of response.repository.dependencyGraphManifests.edges) {
      for (const dependencyEdge of dependency.node.dependencies.edges) {
        let licenseInfo = ''
        if (
          dependencyEdge.node &&
          dependencyEdge.node.repository &&
          dependencyEdge.node.repository.licenseInfo
        ) {
          licenseInfo = dependencyEdge.node.repository.licenseInfo.name
        }
        const row: string[] = [
          dependency.node.filename,
          dependencyEdge.node.packageName,
          dependencyEdge.node.packageManager,
          dependencyEdge.node.requirements,
          licenseInfo
        ]

        csvData.push(row)
      }
    }
    return csvData
  } catch (error) {
    if (error instanceof Error) {
      core.error(error.message)
      return [[error.message]]
    }
    return [[]]
  }
}

async function getDependabotReport(
  login: string,
  repoName: string,
  token: string
): Promise<string[][]> {
  try {
    const csvData: string[][] = []
    const header: string[] = [
      'ghsaId',
      'packageName',
      'packageManager',
      'severity',
      'firstPatchedVersion',
      'description'
    ]

    csvData.push(header)

    let response
    let after = ''
    do {
      response = await fetchAPIResults(login, repoName, after, token)
      after = response.repository.vulnerabilityAlerts.pageInfo.endCursor
      for (const dependency of response.repository.vulnerabilityAlerts.nodes) {
        let version = 'na'
        if (dependency.securityVulnerability.firstPatchedVersion != null)
          version =
            dependency.securityVulnerability.firstPatchedVersion.identifier

        const row: string[] = [
          dependency.securityVulnerability.advisory.ghsaId,
          dependency.securityVulnerability.package.name,
          dependency.securityVulnerability.package.ecosystem,
          dependency.securityVulnerability.advisory.severity,
          version,
          dependency.securityVulnerability.advisory.description
        ]

        csvData.push(row)
      }
    } while (response.repository.vulnerabilityAlerts.pageInfo.hasNextPage)

    return csvData
  } catch (error) {
    if (error instanceof Error) {
      core.error(error.message)
      return [[error.message]]
    }
    return [[]]
  }
}

async function fetchAPIResults(
  login: string,
  repoName: string,
  after: string,
  token: string
): Promise<any> {
  try {
    const response: any = await graphql(getQuery(login, repoName, after), {
      headers: {
        authorization: `token ${token}`,
        accept: 'application/vnd.github.hawkgirl-preview+json'
      }
    })
    return response
  } catch (error) {
    if (error instanceof Error) {
      core.error(error.message)
      return {}
    }
    return {}
  }
}

function getQuery(login: string, repoName: string, after: string): string {
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
    `
  return query
}

async function generateSecurityReportForOrganization(organization: string, token: string): Promise<void> {
  try {
    if (!token) {
      core.error('Please set the INPUT_TOKEN env variable')
      return
    }

    const octokit = new Octokit({ auth: token })

    const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
      org: organization
    })

    for (const repo of repos) {
      const repoName = `${repo.owner.login}/${repo.name}`
      await generateSecurityReportForRepo(repoName, token)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function run(): Promise<void> {
  const token = core.getInput('token')
  const organization = core.getInput('organization')

  if (!organization) {
    core.error('Please provide the organization name')
    return
  }

  await generateSecurityReportForOrganization(organization, token)
}

run()
