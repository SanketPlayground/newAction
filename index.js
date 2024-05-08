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

async function getRepoReadme(owner, repo, token) {
    const octokit = new Octokit({ auth: token });

    try {
        const response = await octokit.rest.repos.getReadme({
            owner: owner,
            repo: repo
        });
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
    } catch (error) {
        console.error(`Failed to retrieve README for ${owner}/${repo}:`, error);
        return '';
    }
}

async function run() {
    try {
        const reportFilePath = 'repo_readmes_report.txt';
        const org = core.getInput('organization');
        const token = core.getInput('token');

        if (!org || !token) {
            throw new Error('Organization or token is not provided.');
        }

        function appendToReport(data, filePath) {
            fs.appendFileSync(filePath, data, 'utf8');
        }

        const repos = await getAllRepos(org, token);
        for (const repo of repos) {
            try {
                const readmeContent = await getRepoReadme(org, repo, token);
                appendToReport(`Repository: ${org}/${repo}\n\n${readmeContent}\n\n`, reportFilePath);
                console.log(`Added README for ${org}/${repo} to the report.`);
            } catch (error) {
                console.error('Failed to process repo:', repo, error);
            }
        }

        core.setOutput('reportArtifactPath', reportFilePath);
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
