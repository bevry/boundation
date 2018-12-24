'use strict'

// External
const inquirer = require('inquirer')
const chalk = require('chalk')
const Errlop = require('errlop')

// Fetch
function fetch(value, ...args) {
	return typeof value === 'function' ? value(...args) : value
}

// Action
async function getAnswers(questions) {
	try {
		// find defaults
		const defaults = {}
		questions.forEach(function(question) {
			const { name, skip, when, ignore } = question
			if (typeof question.default === 'function') {
				const fn = question.default
				question.default = function(answers) {
					const values = Object.assign({}, defaults, answers)
					const value = fn(values)
					return value
				}
			}
			question.when = async function(answers) {
				let reason, result
				// fetch values
				const value = await Promise.resolve(fetch(question.default, answers))
				const values = Object.assign({ [name]: value }, defaults, answers)
				// check when and ignore
				if (when || ignore) {
					// check ignore
					if (when != null) {
						result = fetch(when, values)
						if (!result) reason = 'when'
					}
					// check ignore
					if (!reason && ignore != null) {
						result = fetch(ignore, values)
						if (result) reason = 'ignore'
					}
				}
				// check skip
				if (!reason) {
					// check skip
					if (skip != null) {
						result = fetch(skip, values)
						if (result) reason = 'skip'
					}
					// store value
					if (reason) {
						defaults[name] = value
					}
				}
				// if we are not proceeding then ignore
				if (reason) {
					const value = defaults[name]
					const color = reason === 'skip' ? v => v : chalk.dim
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
						)
					]
						.map(v => color(v))
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

module.exports = { getAnswers }
