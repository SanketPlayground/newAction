const core = require('@actions/core');
const github = require('@actions/github');
var axios = require('axios')
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
    
    axios.get(`https://api.github.com/orgs/${organization}/repos`)
    .then(function(response) {
      console.log("Repositories in the organization:");
      response.data.forEach(function(repo) {
        console.log(repo.name);
      });
      if(accessToken){
        console.log("accessToken");
      }
    })
    .catch(function(error) {
      console.error('Error:', error.message);
    });
    
} catch (error) {
  core.setFailed(error.message);
}
