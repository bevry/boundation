import * as ansi from '@bevry/ansi'

export function status(...messages) {
	for (const message of messages) {
		process.stdout.write(ansi.bold(ansi.underline(message)))
	}
	process.stdout.write('\n')
}

export function warn(...messages) {
	for (const message of messages) {
		process.stderr.write(ansi.bold(ansi.underline(ansi.magenta(message))))
	}
	process.stdout.write('\n')
}

export function error(...messages) {
	for (const message of messages) {
		process.stderr.write(ansi.bold(ansi.underline(ansi.red(message))))
	}
	process.stdout.write('\n')
}

export function success(...messages) {
	for (const message of messages) {
		process.stderr.write(ansi.bold(ansi.underline(ansi.green(message))))
	}
	process.stdout.write('\n')
}

export function fatal(...messages) {
	for (const message of messages) {
		error(message)
	}
	process.stdout.write('\n')
	process.exit(1)
}
