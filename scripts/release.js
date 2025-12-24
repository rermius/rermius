#!/usr/bin/env node

/**
 * Release script - Similar to electerm's release script
 * Creates and pushes 'build' branch to trigger workflows
 *
 * Usage: npm run release
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

async function runCommand(cmd, options = {}) {
	const defaultOptions = {
		cwd: rootDir,
		...options
	};

	console.log(`Executing: ${cmd}`);

	try {
		const { stdout, stderr } = await execAsync(cmd, defaultOptions);
		if (stderr && !options.ignoreStderr) {
			console.warn('STDERR:', stderr);
		}
		return stdout.trim();
	} catch (error) {
		console.error(`Command failed: ${cmd}`);
		console.error(`Error: ${error.message}`);
		throw error;
	}
}

async function main() {
	console.log('Creating release branch (like electerm)...\n');

	try {
		// Get current branch
		const currentBranch = await runCommand('git rev-parse --abbrev-ref HEAD');
		console.log(`Current branch: ${currentBranch}\n`);

		// Check if we're on main/master
		if (currentBranch !== 'main' && currentBranch !== 'master') {
			console.warn(`Warning: You're not on main/master branch. Current: ${currentBranch}`);
			const readline = await import('readline');
			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});

			const answer = await new Promise(resolve => {
				rl.question('Continue anyway? (y/n): ', resolve);
			});
			rl.close();

			if (answer.toLowerCase() !== 'y') {
				console.log('Aborted.');
				process.exit(0);
			}
		}

		// Pull latest changes
		console.log('Pulling latest changes...');
		await runCommand('git pull', { ignoreStderr: true });

		// Delete build branch if exists (local)
		console.log('Deleting local build branch if exists...');
		try {
			await runCommand('git branch -D build', { ignoreStderr: true });
		} catch (e) {
			// Branch doesn't exist, that's fine
		}

		// Create build branch
		console.log('Creating build branch...');
		await runCommand('git checkout -b build');

		// Push build branch
		console.log('Pushing build branch...');
		await runCommand('git push origin build -u --force');

		// Switch back to original branch
		console.log(`Switching back to ${currentBranch}...`);
		await runCommand(`git checkout ${currentBranch}`);

		console.log('\n✓ Release branch created and pushed!');
		console.log('  Workflows will now trigger on the build branch.');
		console.log('  Check GitHub Actions to see the builds running.');
	} catch (error) {
		console.error('\n✗ Error:', error.message);
		process.exit(1);
	}
}

main();
