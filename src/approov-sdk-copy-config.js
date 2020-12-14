const {executeCommand} = require('./helpers');
const fsExtra = require('fs-extra');
const INITIAL_CONFIG = process.env.APPROV_SDK_CONFIG || 'approov-initial.config';

module.exports = function (projectData, hookArgs) {
  const platform = (hookArgs.platform || (hookArgs.prepareData && hookArgs.prepareData.platform)).toLowerCase();
  return platform === 'android' ? copyConfigForAndroid(projectData) : copyConfigForIOS(projectData);
}

function copyConfigForIOS(projectData) {
  return new Promise(async (resolve, reject) => {
    const assetsPath = `${projectData.platformsDir}/ios/${projectData.projectName}/app/assets`;
    try {
      await copyConfig(assetsPath, projectData);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function copyConfigForAndroid(projectData) {
  return new Promise(async (resolve, reject) => {
    const assetsPath = `${projectData.platformsDir}/android/app/src/main/assets/app/assets`;
    try {
      await copyConfig(assetsPath, projectData);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

async function copyConfig(assetsPath, projectData) {
  fsExtra.ensureDirSync(assetsPath);
  await executeCommand('approov', 'sdk', '-getConfig', INITIAL_CONFIG);
  console.log('Generated Approov Config');
  await executeCommand('mv', `${projectData.projectDir}/${INITIAL_CONFIG}`, `${assetsPath}/${INITIAL_CONFIG}`);
  console.log('Copied Approov config to assets');
}
