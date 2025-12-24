#!/usr/bin/env node

/**
 * Prepare for release build
 * - Extract version from git tag or environment
 * - Update version files
 * - Clean build artifacts
 */

import { runCommand, getGitTag, isCI } from './build-common.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { rmSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

async function main() {
	console.log('Preparing release build...\n');

	// Get version from various sources
	let version = process.env.VERSION || process.argv[2];

	if (!version) {
		// Try to get from git tag
		const gitTag = await getGitTag();
		if (gitTag) {
			version = gitTag.replace(/^v/, '');
			console.log(`Found version from git tag: ${version}`);
		} else if (isCI()) {
			// In CI, try to get from GitHub release
			const releaseTag =
				process.env.GITHUB_REF?.replace('refs/tags/', '') || process.env.GITHUB_TAG;
			if (releaseTag) {
				version = releaseTag.replace(/^v/, '');
				console.log(`Found version from CI environment: ${version}`);
			}
		}
	}

	if (!version) {
		console.error('Error: Version not found');
		console.error('Please provide version via:');
		console.error('  - VERSION environment variable');
		console.error('  - Command line argument: node scripts/prepare-release.js <version>');
		console.error('  - Git tag (if on tagged commit)');
		process.exit(1);
	}

	// Update version files
	console.log(`\nUpdating version to ${version}...`);
	try {
		// update-version.js is a standalone script, call it via node
		await runCommand(`node scripts/update-version.js "${version}"`);
	} catch (error) {
		console.error(`Error updating version: ${error.message}`);
		process.exit(1);
	}

	// Clean build artifacts
	console.log('\nCleaning build artifacts...');
	const buildDirs = [
		resolve(rootDir, 'build'),
		resolve(rootDir, 'src-tauri', 'target', 'release'),
		resolve(rootDir, '.svelte-kit')
	];

	for (const dir of buildDirs) {
		if (existsSync(dir)) {
			try {
				rmSync(dir, { recursive: true, force: true });
				console.log(`✓ Cleaned ${dir}`);
			} catch (error) {
				console.warn(`Warning: Could not clean ${dir}: ${error.message}`);
			}
		}
	}

	console.log('\n✓ Release preparation complete!');
	console.log(`  Version: ${version}`);
	console.log(`  Platform: ${process.platform}`);
	console.log(`  Architecture: ${process.arch}`);
}

main().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
