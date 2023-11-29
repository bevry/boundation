// external
import { intersect } from '@bevry/list'
import { filterNodeVersions } from '@bevry/nodejs-versions'
import unlink from '@bevry/fs-unlink'
import { isAccessible } from '@bevry/fs-accessible'
import mkdirp from '@bevry/fs-mkdirp'

// local
import { status } from './log.js'
import { writeYAML } from './fs.js'
import { trimEmpty } from './util.js'

// github actions no longer supports node versions prior to 16
// https://github.blog/changelog/2023-06-13-github-actions-all-actions-will-run-on-node16-instead-of-node12-by-default/
function filterSetupNodeVersions(nodeVersions) {
	return filterNodeVersions(nodeVersions, { gte: 16 })
}

// generate the json file
function generateGitHubActionsJSON(state) {
	// extract
	const { packageData, answers } = state

	// prepare vars
	const actionsOperatingSystems = answers.npm
		? ['ubuntu-latest', 'macos-latest', 'windows-latest']
		: ['ubuntu-latest']
	const actionsOperatingSystemsExperimental = intersect(
		actionsOperatingSystems,
		['macos-latest', 'windows-latest'],
	)
	const { desiredNodeVersion } = answers
	const actionsNodeVersions = filterSetupNodeVersions(
		answers.nodeVersionsTested,
	)
	const actionsNodeVersionsOptional = filterSetupNodeVersions(
		state.nodeVersionsOptional,
	)
	const continueOnErrors = [
		actionsNodeVersionsOptional.length
			? `contains('${actionsNodeVersionsOptional.join(' ')}', matrix.node)`
			: '',
		actionsOperatingSystemsExperimental.length
			? `contains('${actionsOperatingSystemsExperimental.join(
					' ',
			  )}', matrix.os)`
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
	const verifyNodeVersionSteps = [
		{
			name: 'Verify Node.js Versions',
			run: "printf '%s' 'node: ' && node --version && printf '%s' 'npm: ' && npm --version && node -e 'console.log(process.versions)'",
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
			uses: 'bevry-actions/npm@v1.1.2',
			with: {
				npmAuthToken: '${{ secrets.NPM_AUTH_TOKEN }}',
				npmBranchTag: answers.npm ? ':next' : null,
			},
		},
	]
	const surgePublishSteps = [
		{
			name: 'publish to surge',
			uses: 'bevry-actions/surge@v1.1.0',
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
			uses: 'actions/checkout@v4',
		},
	]
	const desiredNodeSteps = [
		{
			name: 'Install desired Node.js version',
			uses: 'actions/setup-node@v4',
			with: {
				'node-version': desiredNodeVersion,
			},
		},
		...verifyNodeVersionSteps,
	]
	const targetNodeSteps = [
		{
			name: 'Install targeted Node.js',
			if: `\${{ matrix.node != ${desiredNodeVersion} }}`,
			uses: 'actions/setup-node@v4',
			with: {
				'node-version': '${{ matrix.node }}',
			},
		},
		...verifyNodeVersionSteps,
	]
	const setupDenoSteps = [
		{
			name: 'Install Deno',
			uses: 'denoland/setup-deno@v1',
			with: {
				'deno-version': 'vx.x.x',
			},
		},
	]

	// add deno steps if needed
	if (answers.keywords.has('deno')) {
		setupSteps.push(...setupDenoSteps)
	}

	// merge
	return trimEmpty({
		name: 'bevry',
		on: ['push', 'pull_request'],
		jobs: {
			test: {
				strategy: {
					matrix: {
						os: actionsOperatingSystems,
						node: actionsNodeVersions,
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
			automerge: {
				permissions: {
					contents: 'write',
					'pull-requests': 'write',
				},
				'runs-on': 'ubuntu-latest',
				if: "github.actor == 'dependabot[bot]'",
				steps: [
					{
						name: 'Enable auto-merge for Dependabot PRs',
						run: 'gh pr merge --auto --squash "$PR_URL"',
						env: {
							PR_URL: '${{github.event.pull_request.html_url}}',
							GITHUB_TOKEN: '${{secrets.GITHUB_TOKEN}}',
						},
					},
				],
			},
		},
	})
}

// Thing
export async function updateCI(state) {
	status('customising ci...')

	// wiping old ci files and prep new ones
	await unlink([
		'.travis.yml',
		'.mergify.yml',
		'.dependabot/config.yml',
		'.github/workflows/automerge.yml',
	])
	await mkdirp('.github/workflows')

	// dependabot v2 file
	// https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file
	await writeYAML('.github/dependabot.yml', {
		version: 2,
		updates: [
			{
				'package-ecosystem': 'github-actions',
				directory: '/',
				schedule: {
					interval: 'weekly',
					day: 'sunday',
					time: '00:00',
					timezone: 'Australia/Perth',
				},
			},
			{
				'package-ecosystem': 'npm',
				directory: '/',
				schedule: {
					interval: 'weekly',
					day: 'sunday',
					time: '00:00',
					timezone: 'Australia/Perth',
				},
				// only allow security updates
				// this is because of the lag it causes on the bevry org
				// as well as that github only supports the maintained node.js versions so dependabot could merge a dependency that breaks unmaintained node.js versions that are still supported by our package
				'open-pull-requests-limit': 0,
			},
		],
	})

	// add github actions if a custom one is not present
	if (await isAccessible('.github/workflows/custom.yml')) {
		state.githubWorkflow = 'custom'
		console.log('skipping writing github actions as a custom workflow exists')
	} else {
		await writeYAML(
			'.github/workflows/bevry.yml',
			generateGitHubActionsJSON(state),
		)
	}

	// log
	status('...customised ci')
}
