// builtin
import { resolve, basename } from 'node:path'
import { rename as _rename } from 'node:fs'

// external
import yaml from 'js-yaml'
import safeps from 'safeps'
import Errlop from 'errlop'
import { isAccessible } from '@bevry/fs-accessible'
import unlink from '@bevry/fs-unlink'
import read from '@bevry/fs-read'
import write from '@bevry/fs-write'

// local
import { status } from './log.js'
import { pwd } from './data.js'

/**
 * Check if a file contains specific data/text
 * @param {string} file - The file path to check
 * @param {string} data - The text/data to search for in the file
 * @returns {Promise<boolean>} True if the file contains the specified data, false otherwise
 */
export async function contains(file, data) {
	return (await read(file)).toString().includes(data)
}

/**
 * Check which files exist from a list of file paths
 * @param {...string} files - One or more file paths to check for existence
 * @returns {Promise<string|string[]>} If single file: the file path if exists or empty string. If multiple files: array of existing file paths
 */
export async function echoExists(...files) {
	const results = await Promise.all(
		files.map(async (file) => {
			if (Array.isArray(file)) {
				throw new Error(
					'you wanted echoExists(...files) instead of echoExists(files)',
				)
			}
			const e = await isAccessible(file)
			return e ? file : ''
		}),
	)
	if (files.length === 1) {
		return results[0] || ''
	} else {
		return results.filter((i) => i)
	}
}

/**
 * Remove a file if it contains specific text
 * @param {string|string[]} file - The file path(s) to check and potentially remove
 * @param {string} what - The text to search for in the file(s)
 * @returns {Promise<void|void[]>} Promise that resolves when operation is complete
 */
export async function unlinkIfContains(file, what) {
	if (Array.isArray(file)) {
		return Promise.all(file.map((i) => unlinkIfContains(i, what)))
	}
	const path = resolve(pwd, file)
	if (await isAccessible(path)) {
		if (await contains(path, what)) {
			console.info(path, 'will be removed because it contains:', what)
			return unlink(path)
		} else {
			console.info(
				path,
				'will not be removed because it does not contain:',
				what,
			)
		}
	}
}

/**
 * Rename a file from source to target path
 * @param {string} source - The current file path
 * @param {string} target - The new file path
 * @returns {Promise<void>} Promise that resolves when rename is complete
 */
export function rename(source, target) {
	source = resolve(pwd, source)
	target = resolve(pwd, target)
	return new Promise(function (resolve, reject) {
		_rename(source, target, function (error) {
			if (error) return reject(error)
			return resolve()
		})
	})
}

/**
 * Read and parse a JSON file
 * @param {string} file - The JSON file path to read
 * @returns {Promise<object>} The parsed JSON object, or empty object if file doesn't exist
 */
export async function readJSON(file) {
	const exist = await isAccessible(file)
	if (!exist) return {}
	const data = await read(file)
	return JSON.parse(data)
}

/**
 * Read and parse a YAML file
 * @param {string} file - The YAML file path to read
 * @returns {Promise<object>} The parsed YAML object, or empty object if file doesn't exist
 */
export async function readYAML(file) {
	const exist = await isAccessible(file)
	if (!exist) return {}
	const data = await read(file)
	return yaml.load(data) // eslint-disable-line
}

/**
 * Write data to a YAML file
 * @param {string} file - The YAML file path to write to
 * @param {object} data - The data to serialize and write as YAML
 * @returns {Promise<void>} Promise that resolves when write is complete
 */
export function writeYAML(file, data) {
	return write(file, yaml.dump(data, { noRefs: true })) // eslint-disable-line
}

/**
 * Spawn a command as a child process
 * @param {string[]} command - The command and its arguments to execute
 * @param {object} [opts] - Options for the spawn operation, defaults to the current working directory and inheriting stdio
 * @returns {Promise<string>} Promise that resolves with stdout output
 */
export function spawn(command, opts = {}) {
	opts.cwd = opts.cwd || pwd
	opts.stdio = opts.stdio == null ? 'inherit' : opts.stdio
	return new Promise(function (resolve, reject) {
		safeps.spawn(command, opts, function (err, stdout = '', stderr = '') {
			if (err) {
				const message = `spawn failed: ${command.join(' ')}`
				if (stderr) {
					const errorMessage = stderr.toLowerCase()
					if (
						errorMessage.includes('enoent') ||
						errorMessage.includes('etarget') ||
						errorMessage.includes('timeout') ||
						errorMessage.includes('econn')
					) {
						console.warn(
							'trying again due to poor internet connection or caching',
						)
						return spawn(command, opts).then(resolve).catch(reject)
					}
				}
				return reject(new Errlop(message, err))
			}
			return resolve(stdout)
		})
	})
}

/**
 * Execute a command and return its output
 * @param {string} command - The command string to execute
 * @param {object} [opts] - Options for the execution, defaults to the current working directory
 * @returns {Promise<string>} Promise that resolves with stdout output
 */
export function exec(command, opts = {}) {
	opts.cwd = opts.cwd || pwd
	return new Promise(function (resolve, reject) {
		safeps.exec(command, opts, function (err, stdout) {
			if (err) return reject(new Errlop(`exec failed: ${command}`, err))
			return resolve(stdout)
		})
	})
}

/**
 * Parse a JSON file with error handling and logging
 * @param {string} file - The file path to parse
 * @returns {Promise<object|null>} The parsed JSON object, or null if file doesn't exist or parsing fails
 */
export async function parse(file) {
	const path = resolve(pwd, file)
	const filename = basename(path)
	status(`reading the ${filename} file...`)
	try {
		if (await isAccessible(path)) {
			const data = JSON.parse(await read(path))
			status(`...read the ${filename} file...`)
			return data
		} else {
			status(`...missing the ${path} file...`)
		}
	} catch {
		status(`...skipped the ${filename} file`)
		return null
	}
}
