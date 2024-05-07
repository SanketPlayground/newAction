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

        return response.data;
    } catch (error) {
        console.error('Failed to fetch secret scanning alerts:', error);
        throw error;
    }
}

async function run() {
    try {
        const org = core.getInput('organization');
        const token = core.getInput('token');
        if (!org || !token) {
            throw new Error('Organization or token is not provided.');
        }

        const repos = await getAllRepos(org, token);
        for (const repo of repos) {
            try {
                // const alerts = await getSecretScanningAlerts(org, repo, token);
                console.log(`Secret scanning alerts for ${repo}:`, "alerts");
            } catch (error) {
                console.error('Failed to process repo:', repo, error);
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
