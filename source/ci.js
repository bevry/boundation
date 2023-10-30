// local
import { status, warn } from './log.js'
import { readYAML, unlink, exists, writeYAML, spawn } from './fs.js'
import { trimEmpty } from './util.js'
import { intersect } from '@bevry/list'
import { allLanguages } from './data.js'

// generate the json file
function generateGitHubActionsJSON(state) {
	// extract
	const { packageData, answers } = state

	// prepare vars
	const os = answers.npm
		? ['ubuntu-latest', 'macos-latest', 'windows-latest']
		: ['ubuntu-latest']
	const osExperimental = intersect(os, ['macos-latest', 'windows-latest'])
	const node = answers.nodeVersionsTested
	const { desiredNodeVersion } = answers
	const continueOnErrors = [
		state.nodeVersionsOptional.length
			? `contains('${state.nodeVersionsOptional.join(' ')}', matrix.node)`
			: '',
		osExperimental.length
			? `contains('${osExperimental.join(' ')}', matrix.os)`
			: '',
	]
		.filter((i) => i)
		.join(' || ')
	const continueOnError = continueOnErrors
		? `\${{ ${continueOnErrors} }}`
		: null

	// standard actions
	const preTestSteps = [
		{
			run: 'npm run our:setup',
		},
		{
			run: 'npm run our:compile',
		},
		{
			run: 'npm run our:verify',
		},
	]
	const testSteps = [
		{
			run: 'npm test',
		},
	]
	const prePublishSteps = [
		{
			run: 'npm run our:setup',
		},
		{
			run: 'npm run our:compile',
		},
		{
			run: 'npm run our:meta',
		},
	]

	// inject custom conf into test steps
	if (packageData.boundation && packageData.boundation.githubActionTestEnv) {
		for (const step of testSteps) {
			step.env = packageData.boundation.githubActionTestEnv
		}
	}

	// bevry actions
	const npmPublishSteps = [
		{
			name: 'publish to npm',
			uses: 'bevry-actions/npm@v1.1.0',
			with: {
				npmAuthToken: '${{ secrets.NPM_AUTH_TOKEN }}',
				npmBranchTag: answers.npm ? ':next' : null,
			},
		},
	]
	const surgePublishSteps = [
		{
			name: 'publish to surge',
			uses: 'bevry-actions/surge@v1.0.3',
			with: {
				surgeLogin: '${{ secrets.SURGE_LOGIN }}',
				surgeToken: '${{ secrets.SURGE_TOKEN }}',
			},
		},
	]
	const customPublishSteps = [
		{
			run: 'npm run my:deploy',
		},
	]
	const publishSteps = []
	// @todo turn bevry cdn into its own github action
	// https://github.com/bevry-actions/npm/blob/2811aea332baf2e7994ae4f118e23a52e4615cf9/action.bash#L110
	if (answers.npm || answers.deploymentStrategy === 'bevry') {
		publishSteps.push(...npmPublishSteps)
	}
	if (answers.deploymentStrategy === 'surge') {
		publishSteps.push(...surgePublishSteps)
	}
	if (answers.deploymentStrategy === 'custom') {
		publishSteps.push(...customPublishSteps)
	}

	// github actions
	const setupSteps = [
		{
			uses: 'actions/checkout@v2',
		},
	]
	const desiredNodeSteps = [
		{
			name: 'Install desired Node.js version',
			uses: 'actions/setup-node@v2',
			with: {
				'node-version': desiredNodeVersion,
			},
		},
	]
	const targetNodeSteps = [
		{
			name: 'Install targeted Node.js',
			if: `\${{ matrix.node != ${desiredNodeVersion} }}`,
			uses: 'actions/setup-node@v2',
			with: {
				'node-version': '${{ matrix.node }}',
			},
		},
	]

	// merge
	return trimEmpty({
		name: 'bevry',
		on: ['push', 'pull_request'],
		jobs: {
			test: {
				strategy: {
					matrix: {
						os,
						node,
					},
				},
				'runs-on': '${{ matrix.os }}',
				'continue-on-error': continueOnError,
				steps: [
					...setupSteps,
					...desiredNodeSteps,
					...preTestSteps,
					...targetNodeSteps,
					...testSteps,
				],
			},
			publish: publishSteps.length
				? {
						if: "${{ github.event_name == 'push' }}",
						needs: 'test',
						'runs-on': 'ubuntu-latest',
						steps: [
							...setupSteps,
							...desiredNodeSteps,
							...prePublishSteps,
							...publishSteps,
						],
				  }
				: null,
		},
	})
}

// Thing
export async function updateCI(state) {
	status('customising ci...')

	// wiping old ci files and prep new ones
	await Promise.all([
		unlink('.travis.yml'),
		unlink('.mergify.yml'),
		unlink('.dependabot/config.yml'),
		spawn(['mkdir', '-p', '.github/workflows']),
	])

	// dependabot v2 file
	// https://docs.github.com/en/github/administering-a-repository/enabling-and-disabling-version-updates#enabling-github-dependabot-version-updates
	// https://docs.github.com/en/github/administering-a-repository/configuration-options-for-dependency-updates#ignore
	await writeYAML('.github/dependabot.yml', {
		version: 2,
		updates: [
			{
				'package-ecosystem': 'npm',
				directory: '/',
				schedule: { interval: 'weekly', day: 'sunday' },
			},
		],
	})

	// add github actions if a custom one is not present
	if (await exists('.github/workflows/custom.yml')) {
		state.githubWorkflow = 'custom'
		console.log('skipping writing github actions as a custom workflow exists')
	} else {
		await writeYAML(
			'.github/workflows/bevry.yml',
			generateGitHubActionsJSON(state),
		)
	}

	// dependabot automerge
	// https://github.com/ahmadnassri/action-dependabot-auto-merge
	await writeYAML('.github/workflows/automerge.yml', {
		name: 'automerge',
		on: ['pull_request'],
		jobs: {
			automerge: {
				'runs-on': 'ubuntu-latest',
				steps: [
					{ uses: 'actions/checkout@v2' },
					{
						uses: 'ahmadnassri/action-dependabot-auto-merge@v2',
						with: {
							'github-token':
								'${{ secrets.DEPENDABOT_AUTOMERGE_GITHUB_TOKEN }}',
						},
					},
				],
			},
		},
	})

	// log
	status('...customised ci')
}
