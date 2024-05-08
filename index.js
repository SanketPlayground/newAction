const core = require('@actions/core');
const axios = require('axios');
const { Octokit } = require('@octokit/rest');
const { graphql } = require('@octokit/graphql');

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

async function getSecretScanningAlerts(owner, repo, token) {
    const octokit = new Octokit({ auth: token });

    try {
        const alerts = await octokit.rest.secretScanning.listAlertsForRepo({
            owner: owner,
            repo: repo
        });
        return alerts.data.alerts;
    } catch (error) {
        console.error(`Failed to retrieve secret scanning alerts for ${owner}/${repo}:`, error);
        return [];
    }
}


async function run() {
    try {
        const csvFilePath = 'copilot.csv';
        const org = core.getInput('organization');
        const token = core.getInput('token');
        if (!org || !token) {
            throw new Error('Organization or token is not provided.');
        }

        const repos = await getAllRepos(org, token);
        for (const repo of repos) {
            try {
                const alerts = await getSecretScanningAlerts(org, repo, token);
                console.log(`Secret scanning alerts for ${org}/${repo}:`, alerts);
                appendToCSV(` ${org}/${repo} ${alerts} \n`, csvFilePath);
                core.setOutput('csvArtifactPath', csvFilePath);
            } catch (error) {
                console.error('Failed to process repo:', repo, error);
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
