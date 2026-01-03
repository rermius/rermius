/**
 * Get Lucide icon component for connection type
 * @param {string} connectionType - Connection type (ssh, sftp, ftp, ftps, telnet)
 * @returns {Component} Lucide icon component
 */
import * as LucideIcons from 'lucide-svelte';

export function getConnectionIcon(connectionType) {
	const iconMap = {
		ssh: LucideIcons.Server,
		sftp: LucideIcons.Folder,
		ftp: LucideIcons.Folder,
		ftps: LucideIcons.Lock,
		telnet: LucideIcons.Server,
		terminal: LucideIcons.Terminal,
		snippet: LucideIcons.Code,
		'code-filled': LucideIcons.Code
	};

	return iconMap[connectionType] || LucideIcons.Server;
}
/**
 * File icon mapping using Lucide Icons
 * Returns icon component name for use with lucide-svelte
 */

const fileIconMap = {
	// Folders
	folder: 'Folder',
	folderOpen: 'FolderOpen',

	// Documents
	txt: 'FileText',
	md: 'FileText',
	pdf: 'FileText',
	doc: 'FileText',
	docx: 'FileText',
	rtf: 'FileText',

	// Code
	js: 'FileCode',
	ts: 'FileCode',
	jsx: 'FileCode',
	tsx: 'FileCode',
	json: 'FileJson',
	html: 'FileCode',
	htm: 'FileCode',
	css: 'FileCode',
	scss: 'FileCode',
	sass: 'FileCode',
	less: 'FileCode',
	py: 'FileCode',
	java: 'FileCode',
	cpp: 'FileCode',
	c: 'FileCode',
	h: 'FileCode',
	hpp: 'FileCode',
	cs: 'FileCode',
	php: 'FileCode',
	rb: 'FileCode',
	go: 'FileCode',
	rs: 'FileCode',
	swift: 'FileCode',
	kt: 'FileCode',
	sh: 'FileCode',
	bash: 'FileCode',
	zsh: 'FileCode',
	fish: 'FileCode',
	ps1: 'FileCode',
	bat: 'FileCode',
	cmd: 'FileCode',

	// Images
	png: 'Image',
	jpg: 'Image',
	jpeg: 'Image',
	gif: 'Image',
	svg: 'Image',
	webp: 'Image',
	ico: 'Image',
	bmp: 'Image',
	tiff: 'Image',
	tif: 'Image',

	// Archives
	zip: 'FileArchive',
	tar: 'FileArchive',
	gz: 'FileArchive',
	rar: 'FileArchive',
	'7z': 'FileArchive',
	bz2: 'FileArchive',
	xz: 'FileArchive',

	// Audio
	mp3: 'Music',
	wav: 'Music',
	flac: 'Music',
	aac: 'Music',
	ogg: 'Music',
	m4a: 'Music',

	// Video
	mp4: 'Video',
	avi: 'Video',
	mkv: 'Video',
	mov: 'Video',
	wmv: 'Video',
	flv: 'Video',
	webm: 'Video',

	// Default
	default: 'File'
};

/**
 * Get icon component name for a file
 * @param {string} filename - File name
 * @param {boolean} isDirectory - Whether it's a directory
 * @param {boolean} isSymlink - Whether it's a symlink
 * @returns {string} - Lucide icon component name
 */
export function getFileIcon(filename, isDirectory, isSymlink = false) {
	if (isSymlink) {
		return isDirectory ? 'FolderSymlink' : 'FileSymlink';
	}
	if (isDirectory) {
		return 'Folder';
	}
	const ext = filename.split('.').pop()?.toLowerCase();
	return fileIconMap[ext] || fileIconMap.default;
}

/**
 * Get icon component dynamically (for Svelte)
 * This returns the component name that can be used with dynamic imports
 */
export function getFileIconComponent(filename, isDirectory) {
	return getFileIcon(filename, isDirectory);
}
