const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const runSpeedometer2 = require('./workloads/speedometer2.js');
const runWebXPRT3 = require('./workloads/webxprt3.js');
const settings = require('../config.json');


/*
* Sort the score object array by specific key and get the medium one.
*/
function sortScores(scoresArray, score, propertyName) {
  scoresArray.sort((a, b) => {
    Number.parseFloat(a[score][propertyName]) - Number.parseFloat(b[score][propertyName]);
  });

  return scoresArray;
}

/*
* Run a workload several times and sort 
*/
async function runWorkload(workload, executor) {
  let scoresArray = [];

  for (let i = 0; i < workload.run_times; i++) {
    let thisScore = await executor(workload);
    scoresArray.push(thisScore);

    await new Promise(resolve => setTimeout(resolve, 5000)); // sleep for 5s before next time running
  }

  sortScores(scoresArray, 'scores', 'Total Score');
  const middleIndex = Math.floor(workload.run_times - 1) / 2;

  return Promise.resolve(scoresArray[middleIndex]);
}

/*
*   Generate a JSON file to store this test result
*   Return: The absolute pathname of the JSON file
*/
async function storeTestData(deviceInfo, workload, jsonData) {
  let testResultsDir = path.join(process.cwd(), 'results', workload.name);
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, {recursive: true});
  }

  let cpu = deviceInfo['CPU'].replace('\u00ae', '').replace('\u2122', '').replace(/\s/g, '-'); // Remove the (R) and (TM) unicode characters
  let date = new Date();
  let isoDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  let jsonDate = isoDate.toISOString().split('.')[0].replace(/T|-|:/g, '');
  let browser = deviceInfo['Browser']
  let jsonFilename = jsonDate + '_' + cpu + '_' + browser + '.json';
  let absJSONFilename = path.join(testResultsDir, jsonFilename);

  await fsPromises.writeFile(absJSONFilename, JSON.stringify(jsonData, null, 4));
  return Promise.resolve(absJSONFilename);
}

/*
* Call a workload and generate the JSON file to store the test results
* Return: The absolute path name of the JSON file.
*/

async function genWorkloadResult(deviceInfo, workload, executor) {

  let results = await runWorkload(workload, executor);
  let jsonData = {
    'workload': workload.name,
    'device_info': deviceInfo,
    'test_result': results.scores,
    'execution_date': results.date
  }
  console.log(JSON.stringify(jsonData, null, 4));

  let jsonFilename = await storeTestData(deviceInfo, workload, jsonData);
  return Promise.resolve(jsonFilename);
}

/*
* Run all the workloads defined in ../config.json and 
* generate the results to the ../results directory.
* Return: an object like {
*   'Speedometer2': 'path/to/json/file',
*   ...
* }
*/
async function genWorkloadsResults(deviceInfo) {

  let results = {};
  let executors = {
    'Speedometer2': runSpeedometer2,
    'WebXPRT3': runWebXPRT3
  };

  for (const workload of settings.workloads) {
    let executor = executors[workload.name];
    results[workload.name] = await genWorkloadResult(deviceInfo, workload, executor);
  }

  return Promise.resolve(results);
}


module.exports = {
  genWorkloadsResults: genWorkloadsResults
}