/* eslint no-console:0 */
'use strict'

// Local
const { status } = require('./log')
const { exists, write, read, rename, unlink } = require('./fs')
const { stackOrMessage } = require('./error')

// External
const fetch = require('node-fetch')
const pathUtil = require('path')
const urlUtil = require('url')

async function download (opts) {
	try {
		if (typeof opts === 'string') opts = { url: opts }
		const response = await fetch(opts.url, {})
		let data = await response.text()
		const file = opts.file || pathUtil.basename(urlUtil.parse(opts.url).pathname)
		if (await exists(file)) {
			if (opts.overwrite === false) {
				return Promise.resolve()
			}
			const localData = (await read(file)).toString()
			const localLines = localData.split('\n')
			const localCustomIndex = localLines.findIndex((line) => (/^# CUSTOM/i).test(line))
			if (localCustomIndex !== -1) {
				const remoteLines = data.split('\n')
				const remoteCustomIndex = remoteLines.findIndex((line) => (/^# CUSTOM/i).test(line))
				data = remoteLines.slice(0, remoteCustomIndex).concat(
					localLines.slice(localCustomIndex)
				).join('\n')
			}
		}
		return write(file, data)
	}
	catch (err) {
		return Promise.reject(
			new Error(`Download of ${opts.url} FAILED due to: ${stackOrMessage(err)}`)
		)
	}
}

async function updateBaseFiles ({ answers, packageData }) {
	// rename old files
	status('renaming old files...')

	if (await exists('history.md')) {
		await rename('history.md', 'HISTORY.md')
	}

	if (answers.sourceDirectory !== 'src') {
		if (await exists('src')) {
			await rename('src', answers.sourceDirectory)
		}
	}

	if (answers.docpadPlugin) {
		const docpadMainEntry = packageData.name.replace(/^docpad-plugin-/, '') + '.plugin'
		if (await exists(`./source/${docpadMainEntry}.coffee`)) {
			await rename(`./source/${docpadMainEntry}.coffee`, './source/index.coffee')
		}
		else if (await exists(`./source/${docpadMainEntry}.js`)) {
			await rename(`./source/${docpadMainEntry}.js`, './source/index.js')
		}

		const docpadTestEntry = packageData.name.replace(/^docpad-plugin-/, '') + '.test'
		if (await exists(`./source/${docpadTestEntry}.coffee`)) {
			await rename(`./source/${docpadTestEntry}.coffee`, './source/test.coffee')
		}
		else if (await exists(`./source/${docpadTestEntry}.js`)) {
			await rename(`./source/${docpadTestEntry}.js`, './source/test.js')
		}

		const docpadTesterEntry = packageData.name.replace(/^docpad-plugin-/, '') + '.tester'
		if (await exists(`./source/${docpadTesterEntry}.coffee`)) {
			await rename(`./source/${docpadTesterEntry}.coffee`, './source/tester.coffee')
		}
		else if (await exists(`./source/${docpadTesterEntry}.js`)) {
			await rename(`./source/${docpadTesterEntry}.js`, './source/tester.js')
		}
	}

	status('...renamed old files')


	status('downloading files...')
	const downloads = [
		'https://raw.githubusercontent.com/bevry/base/master/.editorconfig',
		{ url: 'https://raw.githubusercontent.com/bevry/base/master/.gitignore', custom: true },
		'https://raw.githubusercontent.com/bevry/base/master/LICENSE.md',
		'https://raw.githubusercontent.com/bevry/base/master/CONTRIBUTING.md'
	]
	if (answers.npm) {
		downloads.push({ url: 'https://raw.githubusercontent.com/bevry/base/master/.npmignore', custom: true })
		if (!answers.website) {
			downloads.push({ url: 'https://raw.githubusercontent.com/bevry/base/master/HISTORY.md', overwrite: false })
		}
	}
	else {
		await unlink('.npmignore')
	}
	if (answers.languages.has('css')) {
		downloads.push('https://raw.githubusercontent.com/bevry/base/master/.stylelintrc.js')
	}
	else {
		await unlink('.stylelintrc.js')
	}
	if (answers.languages.has('esnext') || answers.languages.has('typescript')) {
		downloads.push('https://raw.githubusercontent.com/bevry/base/master/.eslintrc.js')
	}
	if (answers.flowtype) {
		downloads.push('https://raw.githubusercontent.com/bevry/base/master/.flowconfig')
	}
	else {
		await unlink('.flowconfig')
	}
	if (answers.languages.has('coffeescript')) {
		downloads.push('https://raw.githubusercontent.com/bevry/base/34fc820c8d87f1f21706ce7e26882b6cd5437368/coffeelint.json')
	}
	else {
		await unlink('coffeelint.json')
	}
	await Promise.all(downloads.map((i) => download(i)))
	status('...downloaded files')

	// write the readme file
	if ((await exists('README.md')) === false) {
		status('writing readme file...')
		await write('README.md', [
			'<!--TITLE -->',
			'',
			'<!--BADGES -->',
			'',
			'<!--DESCRIPTION -->',
			'',
			'<!--INSTALL -->',
			'',
			'## Usage',
			'',
			'<!--HISTORY -->',
			'<!--CONTRIBUTE -->',
			'<!--BACKERS -->',
			'<!--LICENSE -->'
		].join('\n'))
		status('...wrote readme file')
	}

	// convert the history file
	if (await exists('HISTORY.md')) {
		status('updating history file...')
		let historyContent = await read('HISTORY.md')
		historyContent = historyContent.toString()
		if ((/^##/m).test(historyContent) === false) {
			historyContent = historyContent
				.replace(/^-/gm, '##')
				.replace(/^\t/gm, '')
		}
		historyContent = historyContent.replace(/^(## v\d+\.\d+\.\d+) ([a-z]+ \d+), (\d+)$/gim, '$1 $3 $2')
		await write('HISTORY.md', historyContent)
		status('...updated history file')
	}
}

module.exports = { download, updateBaseFiles }
