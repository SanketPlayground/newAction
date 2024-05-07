const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { Octokit } = require('@octokit/rest');
const xlsx = require('xlsx');
const core = require('@actions/core');

async function getAllRepos(org, token) {
  const octokit = new Octokit({ auth: token });
  const response = await octokit.repos.listForOrg({ org });
  return response.data.map(repo => repo.name);
}

async function getSecretScanningAlerts(org, repo, token) {
  const octokit = new Octokit({ auth: token });
  const response = await octokit.paginate(octokit.rest.secretScanning.listAlertsForRepo, {
    owner: org,
    repo
  });
  return response.map(alert => [
    alert.html_url || '',
    alert.secret_type || '',
    alert.secret || '',
    alert.state || '',
    alert.resolution || ''
  ]);
}

async function generateExcel(data, org, repo) {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(data);
  xlsx.utils.book_append_sheet(wb, ws, `${repo}-secret-scanning-alerts`);
  const outputPath = path.join(__dirname, `${repo}-alerts.xlsx`);
  xlsx.writeFile(wb, outputPath);
  return outputPath;
}

async function createZip(org, token) {
  const repos = await getAllRepos(org, token);
  const zipName = `${org}-secret-scanning-alerts.zip`;
  const output = fs.createWriteStream(zipName);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(output);
  
  for (const repo of repos) {
    const alerts = await getSecretScanningAlerts(org, repo, token);
    const excelPath = await generateExcel(alerts, org, repo);
    archive.file(excelPath, { name: `${repo}-alerts.xlsx` });
    fs.unlinkSync(excelPath); // remove the generated Excel file after adding to zip
  }

  archive.finalize();
  return zipName;
}

async function run() {
  try {
    const org = core.getInput('organization');
    const token = core.getInput('token');
    if (!org || !token) {
      throw new Error('Organization or token is not provided.');
    }
    const zipFilePath = await createZip(org, token);
    core.setOutput('zip-file', zipFilePath);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
