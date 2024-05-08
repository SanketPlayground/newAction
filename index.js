const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const core = require('@actions/core');

async function getAllRepos(org, token) {
    const octokit = new Octokit({ auth: token });

    try {
        const response = await octokit.rest.repos.listForOrg({
            org: org,
            per_page: 100 // Increase if you have more than 100 repos
        });
        return response.data.map(repo => repo.name);
    } catch (error) {
        console.error('Error fetching repositories:', error);
        throw error;
    }
}

async function triggerCodeScanning(owner, repo, token) {
    const octokit = new Octokit({ auth: token });

    try {
        await octokit.request('POST /repos/{owner}/{repo}/code-scanning/suites', {
            owner: owner,
            repo: repo
        });
        console.log(`Code scanning triggered for ${owner}/${repo}.`);
    } catch (error) {
        console.error(`Failed to trigger code scanning for ${owner}/${repo}:`, error);
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
                await triggerCodeScanning(org, repo, token);
            } catch (error) {
                console.error('Failed to process repo:', repo, error);
            }
        }

        console.log('Code scanning triggered for all repositories in the organization.');
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
