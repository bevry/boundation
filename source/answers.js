// external
import inquirer from 'inquirer'
import * as ansi from '@bevry/ansi'
import Errlop from 'errlop'
import getArgValue from 'get-cli-arg'

// local
import { hiddenConfigurationProperties } from './data.js'

// vars
const skipAllArg = '--auto'
const skipAll = process.argv.includes(skipAllArg)

// Fetch
function fetch(q, value, ...args) {
	return typeof value === 'function' ? value.apply(q, args) : value
}

// Action
export default async function getAnswers(questions, user = {}) {
	try {
		// dereference user, so our modifications don't apply to it
		user = JSON.parse(JSON.stringify(user))
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
					fetch(question, question.default, answers),
				)
				const values = Object.assign({ [name]: value }, defaults, answers)

				// check args
				const args = arg ? [name, arg] : [name]
				for (const _arg of args) {
					const _value = getArgValue(_arg)
					if (_value != null) {
						opaque = true
						defaults[name] = _value === 0.1 ? '0.10' : _value
						reason = 'arg'
					}
				}

				// check user
				if (typeof user[name] !== 'undefined') {
					if (reason) {
						console.warn(
							`package:.json:boundation:${name}=${JSON.stringify(
								user[name],
							)} taking preference over ${reason} value of ${JSON.stringify(
								defaults[name],
							)}`,
						)
					}
					defaults[name] = user[name]
					delete user[name]
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
					const color = opaque ? (v) => v : ansi.dim
					const message = [
						'Automated',
						ansi.bold(ansi.underline(name)),
						'via',
						reason,
						'to',
						// type="checkbox" returns arrays
						// values could also be null, undefined, true, or false
						ansi.bold(
							ansi.green(
								question.type === 'password'
									? '[hidden]'
									: typeof value === 'string'
										? value
										: JSON.stringify(value),
							),
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

		// check if we had any unknown properties
		const unknownProperties = new Set(Object.keys(user))
		for (const hidden of hiddenConfigurationProperties)
			unknownProperties.delete(hidden)
		if (unknownProperties.size) {
			console.log(user)
			throw new Error(
				`package.json:boundation had unknown properties: ${Array.from(
					unknownProperties.values(),
				).join(', ')}`,
			)
		}

		// return merge
		return values
	} catch (err) {
		throw new Errlop('Failed to fetch the answers from the user', err)
	}
}
