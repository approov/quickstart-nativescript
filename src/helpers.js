const {execSync} = require('child_process');

/**
 * Executes a shell command and returns the response
 *
 * @param {string} command
 * @param {string} args
 *
 * @return {Promise<any>}
 */
function executeCommand(command, ...args) {
    return new Promise((resolve, reject) => {
        try {
            const process = execSync(`${command} ${args.join(' ')}`, {encoding: 'UTF-8'});
            resolve(process);
        } catch (e) {
            reject(e);
        }
    });
}

module.exports = {
    executeCommand,
}
