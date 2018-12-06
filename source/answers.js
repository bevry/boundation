'use strict'

// External
const inquirer = require('inquirer')
const chalk = require('chalk')
const Errlop = require('errlop')

// Action
async function getAnswers(questions) {
	try {
		// find defaults
		const defaults = {}
		questions.forEach(function(question) {
			const { name, skip, when, ignore } = question
			if (question.default != null) {
				if (typeof question.default === 'function') {
					const fn = question.default
					question.default = function(answers) {
						const values = Object.assign({}, defaults, answers)
						const value = fn(values)
						defaults[name] = value
						// console.log(name, 'defaults to', value)
						return value
					}
				} else {
					const value = question.default
					question.default = function() {
						defaults[name] = value
						// console.log(name, 'defaults to', value)
						return value
					}
				}
			}
			if (skip || when || ignore)
				question.when = function(answers) {
					let values,
						color,
						proceed = true
					// check ignore
					if (question.ignore) {
						values = Object.assign(defaults, answers)
						const ignore = question.ignore(values)
						if (ignore) {
							proceed = false
							color = chalk.dim
						}
					}
					// check skip and when
					if (proceed) {
						// apply default
						if (question.default) question.default(answers)
						// refresh values as default would have been applied
						values = Object.assign(defaults, answers)
						// check when
						if (when && !when(values)) proceed = false
						// check skip
						if (skip) {
							if (typeof skip === 'function') {
								if (skip(values)) proceed = false
							} else proceed = false
						}
					}
					// if we are not proceeding then ignore
					if (!proceed) {
						const value = values[name]
						const humanName = chalk.bold.underline(name)
						const humanValue = chalk.bold.green(
							value == null
								? null
								: question.type === 'password'
								? '[hidden]'
								: value
						)
						const message = `Skipped ${humanName} with value ${humanValue}`
						console.log(color ? color(message) : message)
					}
					return proceed
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
