#!/usr/bin/env node
/**
 * JobHuntAI Version 3.0 — Public Feed Privacy Sanitizer
 * 
 * Generates sanitized public/data/jobs.json for GitHub Pages deployment.
 * Strips personal phone, email, notes, and private fields.
 */

const dataService = require('../backend/src/services/dataService');
const sanitizer = require('../backend/src/services/sanitizer');

console.log('[Sanitizer] Reading Top 20 jobs from data/jobs.json...');
const top20 = dataService.getTop20Jobs();

console.log(`[Sanitizer] Sanitizing ${top20.length} jobs for public distribution...`);
const result = sanitizer.generatePublicFeed(top20);

console.log(`[Sanitizer] ✓ Successfully wrote sanitized feed to: ${result.outputPath}`);
console.log('[Sanitizer] All candidate contact details masked (r.***@gmail.com, +91 ********76).');

