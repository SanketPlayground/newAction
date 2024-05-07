const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const xlsx = require('xlsx');
const core = require('@actions/core');
const axios = require('axios'); // Import Axios

async function getAllRepos(org, token) {
    try {
      const url = `https://api.github.com/orgs/${org}/repos`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `token ${token}`
        }
      });
  
      const data = response.data;
      return data.map(repo => repo.name);
    } catch (error) {
      console.error('Error fetching repositories:', error);
      throw error;
    }
  }
  
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
          alert.html_url || '',
          alert.secret_type || '',
          alert.secret || '',
          alert.state || '',
          alert.resolution || ''
        ];
        csvData.push(row);
      }
      return csvData;
    } catch (error) {
      if (error instanceof Error) {
        core.error(error.message);
        csvData.push([error.message, '', '', '', '']);
      }
      return csvData;
    }
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
    const alerts = await getSecretScanningReport(org, repo, token);
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
