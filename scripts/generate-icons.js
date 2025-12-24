/**
 * Icon Generator Script
 * Converts SVG to PNG icons at multiple sizes for Tauri app
 *
 * Usage: node scripts/generate-icons.js
 *
 * Requires: npm install sharp sharp-ico --save-dev
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICONS_DIR = path.join(__dirname, '../src-tauri/icons');
const SOURCE_SVG = path.join(ICONS_DIR, 'icon-source.svg');

// Required sizes for Tauri
const SIZES = [
	{ name: '32x32.png', size: 32 },
	{ name: '128x128.png', size: 128 },
	{ name: '128x128@2x.png', size: 256 },
	{ name: 'icon.png', size: 512 },
	// Windows Store logos
	{ name: 'Square30x30Logo.png', size: 30 },
	{ name: 'Square44x44Logo.png', size: 44 },
	{ name: 'Square71x71Logo.png', size: 71 },
	{ name: 'Square89x89Logo.png', size: 89 },
	{ name: 'Square107x107Logo.png', size: 107 },
	{ name: 'Square142x142Logo.png', size: 142 },
	{ name: 'Square150x150Logo.png', size: 150 },
	{ name: 'Square284x284Logo.png', size: 284 },
	{ name: 'Square310x310Logo.png', size: 310 },
	{ name: 'StoreLogo.png', size: 50 }
];

async function generateIcons() {
	console.log('🎨 Generating app icons...\n');

	try {
		// Check if source SVG exists
		await fs.access(SOURCE_SVG);
		console.log('✓ Found source SVG:', SOURCE_SVG);

		// Read SVG content
		const svgBuffer = await fs.readFile(SOURCE_SVG);

		// Generate PNG files at different sizes
		console.log('\n📦 Generating PNG icons:');
		for (const { name, size } of SIZES) {
			const outputPath = path.join(ICONS_DIR, name);

			await sharp(svgBuffer)
				.resize(size, size, {
					fit: 'contain',
					background: { r: 0, g: 0, b: 0, alpha: 0 }
				})
				.png()
				.toFile(outputPath);

			console.log(`  ✓ ${name} (${size}x${size})`);
		}

		// Generate ICO file for Windows (multiple sizes embedded)
		console.log('\n🪟 Generating Windows ICO:');
		const icoSizes = [16, 24, 32, 48, 64, 128, 256];
		const icoBuffers = await Promise.all(
			icoSizes.map(size =>
				sharp(svgBuffer)
					.resize(size, size, {
						fit: 'contain',
						background: { r: 0, g: 0, b: 0, alpha: 0 }
					})
					.png()
					.toBuffer()
			)
		);

		// Create ICO file manually (simple implementation)
		const icoPath = path.join(ICONS_DIR, 'icon.ico');
		await createIcoFile(icoPath, icoBuffers, icoSizes);
		console.log('  ✓ icon.ico (multi-size)');

		console.log('\n✨ All icons generated successfully!');
		console.log('\n📝 Note: For macOS .icns file, use:');
		console.log('   png2icns icon.icns icon.png');
		console.log('   Or use: https://cloudconvert.com/png-to-icns');
	} catch (error) {
		if (error.code === 'ENOENT') {
			console.error('❌ Error: icon-source.svg not found!');
			console.error('   Expected location:', SOURCE_SVG);
		} else if (error.code === 'MODULE_NOT_FOUND') {
			console.error('❌ Error: sharp module not installed!');
			console.error('   Run: npm install sharp --save-dev');
		} else {
			console.error('❌ Error generating icons:', error.message);
		}
		process.exit(1);
	}
}

/**
 * Create ICO file from PNG buffers
 * Simple ICO format implementation
 */
async function createIcoFile(outputPath, pngBuffers, sizes) {
	const numImages = pngBuffers.length;

	// ICO header (6 bytes)
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0); // Reserved (must be 0)
	header.writeUInt16LE(1, 2); // Type (1 = ICO)
	header.writeUInt16LE(numImages, 4); // Number of images

	// Directory entries (16 bytes each)
	let offset = 6 + numImages * 16;
	const entries = [];

	for (let i = 0; i < numImages; i++) {
		const entry = Buffer.alloc(16);
		const size = sizes[i];
		const buffer = pngBuffers[i];

		entry.writeUInt8(size === 256 ? 0 : size, 0); // Width (0 = 256)
		entry.writeUInt8(size === 256 ? 0 : size, 1); // Height (0 = 256)
		entry.writeUInt8(0, 2); // Color palette
		entry.writeUInt8(0, 3); // Reserved
		entry.writeUInt16LE(1, 4); // Color planes
		entry.writeUInt16LE(32, 6); // Bits per pixel
		entry.writeUInt32LE(buffer.length, 8); // Size of image data
		entry.writeUInt32LE(offset, 12); // Offset in file

		entries.push(entry);
		offset += buffer.length;
	}

	// Combine header + entries + image data
	const icoData = Buffer.concat([header, ...entries, ...pngBuffers]);

	await fs.writeFile(outputPath, icoData);
}

// Run the generator
generateIcons();
