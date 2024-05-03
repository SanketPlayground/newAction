const core = require('@actions/core');
const github = require('@actions/github');
var fetch = require('node-fetch');
try {
  // `who-to-greet` input defined in action metadata file
  const nameToGreet = core.getInput('who-to-greet');
  console.log(`Hello ${nameToGreet}!`);
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}


try {
    var organization = core.getInput('organization');
    var accessToken = core.getInput('token');
    
    function fetchRepositories() {
      try {
        fetch(`https://api.github.com/orgs/${organization}/repos`, {
          headers: {
            Authorization: `token ${accessToken}`,
          },
        })
        .then(function(response) {
          if (!response.ok) {
            throw new Error(`Failed to fetch repositories: ${response.status} ${response.statusText}`);
          }
          return response.json();
        })
        .then(function(repositories) {
          console.log("Repositories in the organization:");
          repositories.forEach(function(repo) {
            console.log(repo.name);
          });
        })
        .catch(function(error) {
          console.error('Error:', error.message);
        });
      } catch (error) {
        core.setFailed(error.message);
      }
    }
    
    fetchRepositories();
    
} catch (error) {
  core.setFailed(error.message);
}
