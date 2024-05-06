const core = require('@actions/core');
const axios = require('axios');

try {
    const organization = core.getInput('organization');
    const accessToken = core.getInput('token');
    
    // Validate inputs
    if (!organization || !accessToken) {
        throw new Error("Organization and access token are required.");
    }

    axios.get(`https://api.github.com/orgs/${organization}/repos`, {
        headers: {
            Authorization: `token ${accessToken}`,
        },
    })
    .then(function(response) {
        console.log("Repositories in the organization:");
        response.data.forEach(function(repo) {
            console.log(repo);
        });
    })
    .catch(function(error) {
        console.error('Error fetching repositories:', error.message);
        core.setFailed('Failed to fetch repositories. Check the error logs for details.');
    });
} catch (error) {
    console.error('Error:', error.message);
    core.setFailed(error.message);
}
