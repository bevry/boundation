'use strict'

const { allNodeVersions } = require('./data')

// Compare to versions simplify
// Works for 1, 1.1, or 1.1.1, or 1.1.1 - sadasd
function versionComparator(a, b) {
	// https://github.com/substack/versionComparator-compare/pull/4
	const pa = String(a).split('.')
	const pb = String(b).split('.')
	for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
		const na = Number(pa[i])
		const nb = Number(pb[i])
		if (na > nb) return 1
		if (nb > na) return -1
		if (!isNaN(na) && isNaN(nb)) return 1
		if (isNaN(na) && !isNaN(nb)) return -1
	}
	return 0
}

async function updateVersions(state) {
	const { answers } = state

	// fetch node versions
	state.nodeVersions = allNodeVersions.filter(
		(version) =>
			versionComparator(version, answers.minimumTestNodeVersion) >= 0 &&
			versionComparator(version, answers.maximumTestNodeVersion) <= 0
	)
	state.unsupportedNodeVersions = state.nodeVersions.filter(
		(version) =>
			versionComparator(version, answers.minimumSupportNodeVersion) < 0 ||
			versionComparator(version, answers.maximumSupportNodeVersion) > 0
	)
	state.supportedNodeVersions = state.nodeVersions.filter(
		(version) =>
			versionComparator(version, answers.minimumSupportNodeVersion) >= 0 &&
			versionComparator(version, answers.maximumSupportNodeVersion) <= 0
	)
}

module.exports = { versionComparator, updateVersions }
