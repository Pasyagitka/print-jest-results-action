const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');

const main = async () => {
    const token = core.getInput('github-token');
    const octokit = github.getOctokit(token);
    const pathToJson = core.getInput('results-file');

    // Read Jest test results from JSON file
    const testResults = JSON.parse(fs.readFileSync(pathToJson, 'utf8'));

    // Extract relevant information from the JSON test results
    const testFailures = testResults.testResults
                            .filter(testResult => testResult.status === 'failed')
                            .map(testResult => ({
                                testFile: testResult.name,
                                message: testResult.message,
                                // You can extract more information like line numbers, etc. if available in your JSON format
                            }));

    // List of test files
    const testFiles = testResults.testResults.map(testResult => testResult.name);

    // Create status check
    await octokit.rest.checks.create({
        ...github.context.repo,
        name: 'Jest Tests',
        head_sha: github.context.sha,
        status: 'completed',
        conclusion: testFailures.length > 0 ? 'failure' : 'success',
        output: {
        title: testFailures.length > 0 ? 'Jest Tests Failed' : 'Jest Tests Passed',
        summary: testFailures.length > 0 
            ? 'Some of the Jest tests failed. See details for more information.'
            : 'All Jest tests passed successfully.',
        text: testFailures.length > 0 
            ? `Failed Tests:\n${testFailures.map(failure => ` - ${failure.testFile}: ${failure.message}`).join('\n')}`
            : '',
        },
    });

    // Create a pull request comment listing test files
    const testFilesComment = `### Jest Test Files\n\n${testFiles.map(file => `- ${file}`).join('\n')}`;
    await octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: github.context.payload.pull_request.number,
        body: testFilesComment,
    });
}
main().catch(err => core.setFailed(err.message));