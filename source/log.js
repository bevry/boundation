'use strict'

const chalk = require('chalk')

function status(...m) {
	process.stdout.write(chalk.bold.underline(...m) + '\n')
}
function warn(...m) {
	process.stderr.write(chalk.bold.underline.magenta(...m) + '\n')
}
function error(...m) {
	process.stderr.write(chalk.bold.underline.red(...m) + '\n')
}
function success(...m) {
	process.stderr.write(chalk.bold.underline.green(...m) + '\n')
}

module.exports = { status, warn, error, success }
