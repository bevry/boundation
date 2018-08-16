'use strict'

// Local
const { stackOrMessage } = require('./error')

// External
const inquirer = require('inquirer')

// Action
async function getAnswers (questions) {
	try {
		return await inquirer.prompt(questions)
	}
	catch (err) {
		return Promise.reject(
			new Error(`Failed to fetch the answers from the user: ${stackOrMessage(err)}`)
		)
	}
}

module.exports = { getAnswers }
