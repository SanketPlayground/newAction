const core = require('@actions/core');
const axios = require('axios');
const { Octokit } = require('@octokit/rest');

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

async function getSecretScanningReport(octokit, owner, repo) {
    const csvData = [];

    try {
        const secretScanningAlerts = await octokit.paginate(
            octokit.rest.secretScanning.listAlertsForRepo,
            {
                owner: owner,
                repo: repo
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
        console.error(error.message);
        csvData.push([error.message, '', '', '', '']);
        return csvData;
    }
}


async function run() {
    try {
        const org = core.getInput('organization');
        const token = core.getInput('token');
        if (!org || !token) {
            throw new Error('Organization or token is not provided.');
        }

        const octokit = new Octokit({
            auth: token
        });

        const repos = await getAllRepos(org, token);
        for (const repo of repos) {
            try {
                const secretScanningReport = await getSecretScanningReport(octokit, org, repo);
                console.log(`Secret scanning alerts for ${repo}:`, secretScanningReport);
            } catch (error) {
                console.error('Failed to process repo:', repo, error);
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}


run();
