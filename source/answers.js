// External
import inquirer from 'inquirer'
import chalk from 'chalk'

// esm workarounds
import Errlop from 'errlop'
import getarg from 'get-cli-arg'

// Local
const skipAllArg = '--auto'
const skipAll = process.argv.includes(skipAllArg)

// Fetch
function fetch(q, value, ...args) {
	return typeof value === 'function' ? value.apply(q, args) : value
}

// Action
export default async function getAnswers(questions, user) {
	try {
		// find defaults
		const defaults = {}
		questions.forEach(function (question) {
			const { name, skip, when, ignore, arg } = question
			if (typeof question.default === 'function') {
				const qc = question.choices
				if (typeof question.choices === 'function')
					question.choices = function (answers) {
						const values = Object.assign({}, defaults, answers)
						const value = fetch(question, qc, values)
						return value
					}
				const qd = question.default
				question.default = function (answers) {
					const values = Object.assign({}, defaults, answers)
					const value = fetch(question, qd, values)
					return value
				}
			}
			question.when = async function (answers) {
				let reason,
					result,
					opaque = false

				// fetch values
				const value = await Promise.resolve(
					fetch(question, question.default, answers)
				)
				const values = Object.assign({ [name]: value }, defaults, answers)

				// check args
				const args = arg ? [name, arg] : [name]
				for (const _arg of args) {
					const _value = getarg(_arg)
					if (_value != null) {
						opaque = true
						defaults[name] = _value === 0.1 ? '0.10' : _value
						reason = 'arg'
					}
				}

				// check user
				if (user && !reason && typeof user[name] !== 'undefined') {
					defaults[name] = user[name]
					reason = 'package'
				}

				// fallback to other checks if no arg
				if (!reason) {
					// check when and ignore
					if (when || ignore) {
						// check ignore
						if (when != null) {
							result = fetch(question, when, values)
							if (!result) reason = 'when'
						}
						// check ignore
						if (!reason && ignore != null) {
							result = fetch(question, ignore, values)
							if (result) reason = 'ignore'
						}
					}

					// check skip
					if (!reason) {
						// check skip
						if (skip != null) {
							result = fetch(question, skip, values)
							if (result) {
								reason = 'skip'
								opaque = true
							}
						}
						// check skip all
						if (!reason && skipAll) {
							reason = skipAllArg
							opaque = true
						}
						// store value
						if (reason) {
							defaults[name] = value
						}
					}
				}

				// if we are not proceeding then ignore
				if (reason) {
					const value = defaults[name]
					const color = opaque ? (v) => v : chalk.dim
					const message = [
						'Automated',
						chalk.bold.underline(name),
						'via',
						reason,
						'to',
						chalk.bold.green(
							value == null
								? null
								: question.type === 'password'
								? '[hidden]'
								: value
						),
					]
						.map((v) => color(v))
						.join(' ')
					console.log(message)
				}
				return !reason
			}
		})

		// get answers
		const answers = await inquirer.prompt(questions)

		// merge in defaults
		const values = Object.assign({}, defaults, answers)

		// return merge
		return values
	} catch (err) {
		return Promise.reject(
			new Errlop('Failed to fetch the answers from the user', err)
		)
	}
}
