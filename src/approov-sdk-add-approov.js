const fsExtra = require('fs-extra');
const PACKAGE_NAME = require('./package.json').name;
const {executeCommand} = require('./helpers');
const path = require('path');
const fs = require('fs');
const VERSION = process.env.APPROV_SDK_LIBRARY_ID || undefined;
const ANDROID_SDK_NAME = 'approov.aar';
const IOS_SDK_NAME = 'approov.zip';
const IOS_FRAMEWORK_NAME = 'Approov.framework';

module.exports = function (projectData, hookArgs) {
    const platform = (hookArgs.platform || (hookArgs.prepareData && hookArgs.prepareData.platform)).toLowerCase();
    return platform === 'android' ? addApproovSdkForAndroid(projectData) : addApproovSdkForIOS(projectData);
}

function addApproovSdkForIOS(projectData) {
    return new Promise(async (resolve, reject) => {
        const copyPath = path.join(projectData.projectDir, 'node_modules', PACKAGE_NAME, 'platforms', 'ios').toString();
        try {
            if (VERSION) {
                await executeCommand('approov', 'sdk', '-getLibrary', IOS_SDK_NAME, '-libraryID', VERSION);
            } else {
                await executeCommand('approov', 'sdk', '-getLibrary', IOS_SDK_NAME);
            }
            fsExtra.ensureDirSync(copyPath);

            await executeCommand('mv', `${projectData.projectDir}/${IOS_SDK_NAME}`, `${copyPath}/${IOS_SDK_NAME}`);
            if (fs.existsSync(`${copyPath}/${IOS_FRAMEWORK_NAME}`)) {
                return resolve();
            }
            await executeCommand('unzip', '-d', copyPath, `${copyPath}/${IOS_SDK_NAME}`);
            resolve();
        } catch (e) {
            reject(e);
        }
    });
}

function addApproovSdkForAndroid(projectData) {
    return new Promise(async (resolve, reject) => {
        const copyPath = path.join(projectData.projectDir, 'node_modules', PACKAGE_NAME, 'platforms', 'android').toString();
        try {
            if (VERSION) {
                await executeCommand('approov', 'sdk', '-getLibrary', ANDROID_SDK_NAME, '-libraryID', VERSION);
            } else {
                await executeCommand('approov', 'sdk', '-getLibrary', ANDROID_SDK_NAME);
            }
            fsExtra.ensureDirSync(copyPath);
            await executeCommand('mv', `${projectData.projectDir}/${ANDROID_SDK_NAME}`, `${copyPath}/${ANDROID_SDK_NAME}`);
            resolve();
        } catch (e) {
            reject(e);
        }

    });
}
