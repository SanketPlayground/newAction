const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const xlsx = require('xlsx');
const core = require('@actions/core');
const axios = require('axios');

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

async function getSecretScanningAlerts(org, repo, token) {
    try {
        const url = `https://api.github.com/repos/${org}/${repo}/secret-scanning/alerts`;
        const response = await axios.get(url, {
            headers: {
                Authorization: `token ${token}`
            }
        });

        return response.data.map(alert => [
            alert.html_url || '',
            alert.secret_type || '',
            alert.secret || '',
            alert.state || '',
            alert.resolution || ''
        ]);
    } catch (error) {
        console.error('Failed to fetch secret scanning alerts:', error);
        throw error;
    }
}

async function generateExcel(data, org, repo) {
    // Specify the output directory
    const outputDir = path.join(__dirname, 'output');

    // Create the output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    // Specify the output file path within the output directory
    const outputPath = path.join(outputDir, `${repo}-alerts.xlsx`);

    // Create the Excel workbook
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(data);
    const sheetName = `${repo.substring(0, 30)}-secret-scanning-alerts`;
    xlsx.utils.book_append_sheet(wb, ws, sheetName);

    // Write the workbook to the output file
    xlsx.writeFile(wb, outputPath);

    // Return the path of the generated Excel file
    return outputPath;
}




async function createZip(org, token) {
    const repos = await getAllRepos(org, token);
    const zipName = `${org}-secret-scanning-alerts.zip`;
    const output = fs.createWriteStream(zipName);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);

    for (const repo of repos) {
        try {
            const alerts = await getSecretScanningAlerts(org, repo, token);
            const excelPath = await generateExcel(alerts, org, repo);
            archive.file(excelPath, { name: `${repo}-alerts.xlsx` });
            fs.unlinkSync(excelPath); // remove the generated Excel file after adding to zip
        } catch (error) {
            console.error('Failed to process repo:', repo, error);
        }
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
