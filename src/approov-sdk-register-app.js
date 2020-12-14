const {executeCommand} = require('./helpers');

module.exports = function (hookArgs) {
    let {packageFilePath} = hookArgs;
    return new Promise(async (resolve, reject) => {
        try {
            const res = await executeCommand('approov', 'registration', '-add', packageFilePath);
            console.log('Signed => ', res);
            resolve();
        } catch (e) {
            reject(e);
        }
    });
}
