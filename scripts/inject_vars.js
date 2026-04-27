/**
 * NodeAuth Variable Injection Script
 * Purpose: Replaces placeholders like __DIST_COMMIT_HASH__ with actual values during deployment.
 * Used by wrangler.toml [build] hook or manually during CI/CD.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getCommitHash() {
    try {
        // Try to get the short SHA from Git
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch (e) {
        // Fallback or use environment variable if git is not available
        return process.env.GITHUB_SHA ? process.env.GITHUB_SHA.substring(0, 7) : 'unknown';
    }
}

const commitHash = getCommitHash();
const platform = process.env.DIST_PLATFORM || 'Cloudflare Workers';
const iconSuffix = process.env.DIST_ICON_SUFFIX || 'cloudflare';

console.log(`💉 Injecting variables:`);
console.log(`   - Commit: ${commitHash}`);
console.log(`   - Platform: ${platform}`);
console.log(`   - Icon Suffix: ${iconSuffix}`);

function replaceInDir(dir, replacements) {
    if (!fs.existsSync(dir)) {
        console.warn(`⚠️ Directory not found: ${dir}`);
        return;
    }

    // Use withFileTypes to get Dirent objects directly, avoiding separate statSync calls
    // and fixing CodeQL js/file-system-race security warnings.
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach(entry => {
        const entryName = entry.name;
        const filePath = path.join(dir, entryName);

        if (entry.isDirectory()) {
            replaceInDir(filePath, replacements);
        } else if (entry.isFile() && (entryName.endsWith('.js') || entryName.endsWith('.html') || entryName.endsWith('.webmanifest'))) {
            try {
                let content = fs.readFileSync(filePath, 'utf8');
                let modified = false;

                Object.entries(replacements).forEach(([pattern, value]) => {
                    if (content.includes(pattern)) {
                        content = content.split(pattern).join(value);
                        modified = true;
                    }
                });

                if (modified) {
                    fs.writeFileSync(filePath, content, 'utf8');
                    console.log(`   ✅ Injected: ${path.relative(process.cwd(), filePath)}`);
                }
            } catch (err) {
                console.error(`   ❌ Failed to process ${filePath}: ${err.message}`);
            }
        }
    });
}

// Define paths relative to the script location (assuming it's in scripts/)
const rootDir = path.resolve(__dirname, '..');
const searchPaths = [
    path.join(rootDir, 'frontend/dist'),
    path.join(rootDir, 'backend/dist')
];

const replacements = {
    '__DIST_COMMIT_HASH__': commitHash,
    '__DIST_PLATFORM__': platform,
    '__DIST_ICON_SUFFIX__': iconSuffix
};

searchPaths.forEach(distPath => {
    console.log(`🔍 Scanning: ${path.relative(process.cwd(), distPath)}`);
    replaceInDir(distPath, replacements);
});

console.log('✨ All variables injected successfully.');
