#!/usr/bin/env node

/**
 * Common utilities for build process
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

/**
 * Execute a command and return the output
 * @param {string} cmd - Command to execute
 * @param {object} options - Execution options
 * @returns {Promise<string>} Command output
 */
export async function runCommand(cmd, options = {}) {
	const defaultOptions = {
		cwd: rootDir,
		maxBuffer: 1024 * 1024 * 50, // 50MB
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
		console.error(`Exit code: ${error.code}`);
		console.error(`Error: ${error.message}`);
		if (error.stdout) console.error(`STDOUT: ${error.stdout}`);
		if (error.stderr) console.error(`STDERR: ${error.stderr}`);
		throw error;
	}
}

/**
 * Get version from package.json
 * @returns {Promise<string>} Version string
 */
export async function getVersion() {
	const packageJsonPath = resolve(rootDir, 'package.json');
	const { readFileSync } = await import('fs');
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
	return packageJson.version;
}

/**
 * Get git tag for current commit
 * @returns {Promise<string|null>} Tag name or null
 */
export async function getGitTag() {
	try {
		const tag = await runCommand('git describe --exact-match --tags HEAD', {
			ignoreStderr: true
		});
		return tag || null;
	} catch (error) {
		return null;
	}
}

/**
 * Check if we're in a CI environment
 * @returns {boolean}
 */
export function isCI() {
	return !!(
		process.env.CI ||
		process.env.GITHUB_ACTIONS ||
		process.env.GITLAB_CI ||
		process.env.CIRCLECI ||
		process.env.TRAVIS
	);
}

/**
 * Get platform-specific build target
 * @returns {string}
 */
export function getBuildTarget() {
	const platform = process.platform;
	const arch = process.arch;

	if (platform === 'win32') {
		return 'x86_64-pc-windows-msvc';
	} else if (platform === 'darwin') {
		return arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
	} else if (platform === 'linux') {
		return 'x86_64-unknown-linux-gnu';
	}

	throw new Error(`Unsupported platform: ${platform} ${arch}`);
}
