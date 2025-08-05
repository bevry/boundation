// external
import * as ansi from '@bevry/ansi'

/**
 * Log status messages with bold and underlined formatting
 * @param {...any} messages - Messages to log
 * @returns {void}
 */
export function status(...messages) {
	for (const message of messages) {
		process.stdout.write(ansi.bold(ansi.underline(message)))
	}
	process.stdout.write('\n')
}

/**
 * Log note messages with bold yellow formatting to stderr
 * @param {...any} messages - Messages to log as notes
 * @returns {void}
 */
export function note(...messages) {
	for (const message of messages) {
		process.stderr.write(ansi.bold(ansi.yellow(message)))
	}
	process.stderr.write('\n')
}

/**
 * Log warning messages with bold magenta underlined formatting to stderr
 * @param {...any} messages - Messages to log as warnings
 * @returns {void}
 */
export function warn(...messages) {
	for (const message of messages) {
		process.stderr.write(ansi.bold(ansi.underline(ansi.magenta(message))))
	}
	process.stderr.write('\n')
}

/**
 * Log error messages with bold red underlined formatting to stderr
 * @param {...any} messages - Messages to log as errors
 * @returns {void}
 */
export function error(...messages) {
	for (const message of messages) {
		process.stderr.write(ansi.bold(ansi.underline(ansi.red(message))))
	}
	process.stderr.write('\n')
}

/**
 * Log success messages with bold green underlined formatting to stderr
 * @param {...any} messages - Messages to log as success
 * @returns {void}
 */
export function success(...messages) {
	for (const message of messages) {
		process.stderr.write(ansi.bold(ansi.underline(ansi.green(message))))
	}
	process.stderr.write('\n')
}

/**
 * Log fatal error messages and exit the process with code 1
 * @param {...any} messages - Messages to log before exiting
 * @returns {void}
 */
export function fatal(...messages) {
	error(...messages)
	process.exit(1) // eslint-disable-line
}
