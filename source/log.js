'use strict'

const chalk = require('chalk')

function status (message) {
	process.stdout.write(chalk.bold.underline(message) + '\n')
}
function warn (message) {
	process.stderr.write(chalk.bold.underline.orange(message) + '\n')
}
function error (message) {
	process.stderr.write(chalk.bold.underline.red(message) + '\n')
}
function success (message) {
	process.stderr.write(chalk.bold.underline.green(message) + '\n')
}

module.exports = { status, warn, error, success }
