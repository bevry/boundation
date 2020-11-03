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
	process.stderr.write('\n')
}

export function error(...messages) {
	for (const message of messages) {
		process.stderr.write(ansi.bold(ansi.underline(ansi.red(message))))
	}
	process.stderr.write('\n')
}

export function success(...messages) {
	for (const message of messages) {
		process.stderr.write(ansi.bold(ansi.underline(ansi.green(message))))
	}
	process.stderr.write('\n')
}

export function fatal(...messages) {
	error(...messages)
	process.exit(1)
}
