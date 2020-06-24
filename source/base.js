/* eslint no-console:0 */
'use strict'

// Local
const { trimOrgName, isBevryOrganisation } = require('./util')
const { status } = require('./log')
const {
	exists,
	write,
	read,
	rename,
	unlink,
	spawn,
	writeYAML,
	exec,
} = require('./fs')
const Errlop = require('errlop').default

// External
const fetch = require('node-fetch').default
const pathUtil = require('path')
const urlUtil = require('url')

async function download(opts) {
	try {
		if (typeof opts === 'string') opts = { url: opts }
		const response = await fetch(opts.url, {})
		let data = await response.text()
		const file =
			opts.file || pathUtil.basename(urlUtil.parse(opts.url).pathname)
		if (await exists(file)) {
			if (opts.overwrite === false) {
				return Promise.resolve()
			}
			const localData = (await read(file)).toString()
			const localLines = localData.split('\n')
			const localCustomIndex = localLines.findIndex((line) =>
				/^# CUSTOM/i.test(line)
			)
			if (localCustomIndex !== -1) {
				const remoteLines = data.split('\n')
				const remoteCustomIndex = remoteLines.findIndex((line) =>
					/^# CUSTOM/i.test(line)
				)
				data = remoteLines
					.slice(0, remoteCustomIndex)
					.concat(localLines.slice(localCustomIndex))
					.join('\n')
			}
		}
		return write(file, data)
	} catch (err) {
		return Promise.reject(new Errlop(`Download of ${opts.url} FAILED`, err))
	}
}

async function updateBaseFiles({ answers, packageData }) {
	// clean
	status('cleaning package manager files...')
	const pmFileList = [
		'./node_modules/',
		'./package-lock.json',
		'./pnpm-lock.yaml',
		'./.pnp',
		'./.pnp.js',
		'./yarn.lock',
	]
	if (answers.packageManager !== 'yarn')
		pmFileList.push('./.yarnrc', './.yarnrc.yml', './.yarn/')
	await exec(`rm -Rf ${pmFileList.join(' ')}`)
	status('...cleaned package manager files')

	// rename old files
	status('renaming old files...')

	if (await exists('history.md')) {
		await rename('history.md', 'HISTORY.md')
	}

	if (answers.docpadPlugin) {
		const docpadMainEntry =
			packageData.name.replace(/^docpad-plugin-/, '') + '.plugin'
		if (await exists(`./source/${docpadMainEntry}.coffee`)) {
			await rename(
				`./source/${docpadMainEntry}.coffee`,
				'./source/index.coffee'
			)
		} else if (await exists(`./source/${docpadMainEntry}.js`)) {
			await rename(`./source/${docpadMainEntry}.js`, './source/index.js')
		}

		const docpadTestEntry =
			packageData.name.replace(/^docpad-plugin-/, '') + '.test'
		if (await exists(`./source/${docpadTestEntry}.coffee`)) {
			await rename(`./source/${docpadTestEntry}.coffee`, './source/test.coffee')
		} else if (await exists(`./source/${docpadTestEntry}.js`)) {
			await rename(`./source/${docpadTestEntry}.js`, './source/test.js')
		}

		const docpadTesterEntry =
			packageData.name.replace(/^docpad-plugin-/, '') + '.tester'
		if (await exists(`./source/${docpadTesterEntry}.coffee`)) {
			await rename(
				`./source/${docpadTesterEntry}.coffee`,
				'./source/tester.coffee'
			)
		} else if (await exists(`./source/${docpadTesterEntry}.js`)) {
			await rename(`./source/${docpadTesterEntry}.js`, './source/tester.js')
		}
	}

	status('...renamed old files')

	status('downloading files...')
	/** @type {Array<string | Object<string, any>} */
	const downloads = [
		'https://raw.githubusercontent.com/bevry/base/master/.editorconfig',
		{
			url: 'https://raw.githubusercontent.com/bevry/base/master/.gitignore',
			custom: true,
		},
		'https://raw.githubusercontent.com/bevry/base/master/LICENSE.md',
		'https://raw.githubusercontent.com/bevry/base/master/CONTRIBUTING.md',
	]
	if (answers.type === 'package') {
		downloads.push({
			url: 'https://raw.githubusercontent.com/bevry/base/master/HISTORY.md',
			overwrite: false,
		})
	}
	if (answers.npm) {
		downloads.push({
			url: 'https://raw.githubusercontent.com/bevry/base/master/.npmignore',
			custom: true,
		})
	} else {
		await unlink('.npmignore')
	}
	if (answers.flowtype) {
		downloads.push(
			'https://raw.githubusercontent.com/bevry/base/master/.flowconfig'
		)
	} else {
		await unlink('.flowconfig')
	}
	if (answers.languages.includes('coffeescript')) {
		downloads.push(
			'https://raw.githubusercontent.com/bevry/base/34fc820c8d87f1f21706ce7e26882b6cd5437368/coffeelint.json'
		)
	} else {
		await unlink('coffeelint.json')
	}
	await Promise.all(downloads.map((i) => download(i)))
	status('...downloaded files')

	// write the readme file
	// trim say `@bevry/update-contributors` to `update-contributors` for API doc links
	let newDocumentationLink = ''
	if (
		answers.docs &&
		['bevry', 'surge'].includes(answers.cdnDeploymentStrategy)
	) {
		const newDocumentationPrefix =
			answers.cdnDeploymentStrategy === 'bevry'
				? `https://cdn.bevry.me/${trimOrgName(answers.name)}/master/`
				: `http://master.${trimOrgName(answers.name)}.${
						answers.organisation
				  }.surge.sh/`
		const newDocumentationSuffix = `docs/${
			answers.language === 'typescript' ? 'globals.html' : 'index.html'
		}`
		const newDocumentationURL = newDocumentationPrefix + newDocumentationSuffix
		newDocumentationLink = `[Complete API Documentation.](${newDocumentationURL})`
	}
	if ((await exists('README.md')) === false) {
		status('writing readme file...')
		await write(
			'README.md',
			[
				'<!--TITLE -->',
				'<!--BADGES -->',
				'<!--DESCRIPTION -->',
				'## Usage',
				answers.docs && newDocumentationLink,
				'<!--INSTALL -->',
				'<!--HISTORY -->',
				'<!--CONTRIBUTE -->',
				'<!--BACKERS -->',
				'<!--LICENSE -->',
			]
				.filter((i) => i)
				.join('\n\n')
		)
		status('...wrote readme file')
	} else {
		// update the existing readme file
		status('updating readme file...')
		// read
		let content = await read('README.md')
		content = content.toString()
		// remove old documentation link, should come before the changes below
		if (newDocumentationLink) {
			content = content.replace(
				/\[(Complete )?(Technical )?(API )?Documentation\.?\]\([^)]+\)/g,
				''
			)
		}
		// update old documentation names
		content = content
			.replace(/\[Web Demonstration\.?\]/g, '[Web Browser Demonstration.]')
			.replace(
				/\[(Tutorials & Guides|Documentation)\.?\]/g,
				'[Tutorials & Guides.]'
			)
		// insert new documentaiton under usage
		if (newDocumentationLink) {
			content = content.replace('## Usage', function (found) {
				return found + '\n\n' + newDocumentationLink
			})
		}
		// move the install section before the history section
		let install = ''
		content = content.replace(
			/<!-- INSTALL\/ -->.+?<!-- \/INSTALL -->/s,
			function (found) {
				install = found
				return ''
			}
		)
		content = content.replace('<!-- HISTORY/ -->', function (found) {
			return install + '\n\n' + found
		})
		// write
		await write('README.md', content)
		status('...updated readme file')
	}

	// convert the history file
	if (await exists('HISTORY.md')) {
		status('updating history file...')
		let historyContent = await read('HISTORY.md')
		historyContent = historyContent.toString()
		if (/^##/m.test(historyContent) === false) {
			historyContent = historyContent.replace(/^-/gm, '##').replace(/^\t/gm, '')
		}
		historyContent = historyContent.replace(
			/^(## v\d+\.\d+\.\d+) ([a-z]+ \d+), (\d+)$/gim,
			'$1 $3 $2'
		)
		await write('HISTORY.md', historyContent)
		status('...updated history file')
	}

	// write the funding file
	if (isBevryOrganisation(answers.organisation)) {
		await spawn(['mkdir', '-p', '.github'])
		await write(
			'.github/FUNDING.yml',
			[
				'github: [balupton]',
				'patreon: bevry',
				'open_collective: bevry',
				'ko_fi: balupton',
				'liberapay: bevry',
				"custom: ['https://bevry.me/fund']",
			].join('\n')
		)
	}

	// dependabot
	// CI will fail if any dep caused failure in any supported version
	// Security Updates are now standard and controlled by github repository settings
	// remove v1 file
	await unlink('.dependabot/config.yml')
	// add v2 file
	await spawn(['mkdir', '-p', '.github'])
	await writeYAML('.github/dependabot.yml', {
		version: 2,
		updates: [
			{
				'package-ecosystem': 'npm',
				directory: '/',
				schedule: { interval: 'weekly' },
			},
		],
	})
}

module.exports = { download, updateBaseFiles }
