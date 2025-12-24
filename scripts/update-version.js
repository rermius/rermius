#!/usr/bin/env node

/**
 * Update version in package.json, Cargo.toml, and tauri.conf.json
 * Usage: node scripts/update-version.js <version>
 * Example: node scripts/update-version.js 1.2.3
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const version = process.argv[2];

if (!version) {
	console.error('Error: Version is required');
	console.error('Usage: node scripts/update-version.js <version>');
	process.exit(1);
}

// Remove 'v' prefix if present
const cleanVersion = version.replace(/^v/, '');

// Validate version format (semver)
const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
if (!semverRegex.test(cleanVersion)) {
	console.error(`Error: Invalid version format: ${cleanVersion}`);
	console.error('Expected format: X.Y.Z or X.Y.Z-prerelease or X.Y.Z+build');
	process.exit(1);
}

console.log(`Updating version to ${cleanVersion}...`);

// Update package.json
try {
	const packageJsonPath = resolve(rootDir, 'package.json');
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
	packageJson.version = cleanVersion;
	writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
	console.log(`✓ Updated package.json`);
} catch (error) {
	console.error(`Error updating package.json: ${error.message}`);
	process.exit(1);
}

// Update Cargo.toml
try {
	const cargoTomlPath = resolve(rootDir, 'src-tauri', 'Cargo.toml');
	let cargoToml = readFileSync(cargoTomlPath, 'utf8');

	// Update version in [package] section
	cargoToml = cargoToml.replace(/^version\s*=\s*"[^"]*"/m, `version = "${cleanVersion}"`);

	writeFileSync(cargoTomlPath, cargoToml);
	console.log(`✓ Updated src-tauri/Cargo.toml`);
} catch (error) {
	console.error(`Error updating Cargo.toml: ${error.message}`);
	process.exit(1);
}

// Update tauri.conf.json
try {
	const tauriConfigPath = resolve(rootDir, 'src-tauri', 'tauri.conf.json');
	const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf8'));
	tauriConfig.version = cleanVersion;
	writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, '\t') + '\n');
	console.log(`✓ Updated src-tauri/tauri.conf.json`);
} catch (error) {
	console.error(`Error updating tauri.conf.json: ${error.message}`);
	process.exit(1);
}

console.log(`\n✓ Successfully updated version to ${cleanVersion}`);
