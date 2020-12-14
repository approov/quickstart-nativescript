const {executeCommand} = require('./helpers');

module.exports = function (hookArgs) {
    let {packageFilePath} = hookArgs;
    return new Promise(async (resolve) => {
        try {
            const res = await executeCommand('approov', 'registration', '-add', packageFilePath);
            console.log('Signed => ', res);
            resolve();
        } catch (e) {
            console.warn(e);
            console.warn('{NS} did not find the IPA path. Approov App registration failed.');
            console.warn('Application will not receive valid tokens. Try removing platforms directory and build app again.');
            resolve();
        }
    });
}
