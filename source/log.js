import chalk from 'chalk'

export function status(...m) {
	process.stdout.write(chalk.bold.underline(...m) + '\n')
}
export function warn(...m) {
	process.stderr.write(chalk.bold.underline.magenta(...m) + '\n')
}
export function error(...m) {
	process.stderr.write(chalk.bold.underline.red(...m) + '\n')
}
export function success(...m) {
	process.stderr.write(chalk.bold.underline.green(...m) + '\n')
}
export function fatal(...m) {
	error(...m)
	process.exit(1)
}
