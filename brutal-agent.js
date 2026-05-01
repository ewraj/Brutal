#!/usr/bin/env node
// BRUTAL Local Agent — v1.0
// Runs at http://localhost:7432 and bridges the browser to your local filesystem.
// Start with: node brutal-agent.js [--root /path/to/workspace]

const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────

const PORT = 7432;
const args = process.argv.slice(2);
const rootIdx = args.indexOf('--root');
const ROOT = rootIdx !== -1 && args[rootIdx + 1]
    ? path.resolve(args[rootIdx + 1])
    : process.cwd();

const ALLOWED_EXTENSIONS = new Set([
    '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs',
    '.py', '.go', '.rs', '.c', '.cpp', '.h', '.hpp',
    '.java', '.kt', '.swift', '.rb', '.php',
    '.html', '.css', '.scss', '.less',
    '.json', '.yaml', '.yml', '.toml', '.env',
    '.md', '.mdx', '.txt', '.sh', '.bash', '.zsh',
    '.sql', '.graphql', '.prisma', '.xml',
    '.dockerfile', '.dockerignore', '.gitignore'
]);

const IGNORED_DIRS = new Set([
    'node_modules', '.git', '.next', 'dist', 'build', 'out',
    '.svelte-kit', 'target', '__pycache__', '.venv', 'venv',
    '.idea', '.vscode', 'coverage', '.nyc_output', '.cache'
]);

const MAX_FILE_SIZE = 256 * 1024; // 256KB per file
const MAX_FILES = 200;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isWithinRoot(filePath) {
    const resolved = path.resolve(filePath);
    return resolved.startsWith(ROOT + path.sep) || resolved === ROOT;
}

function respond(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try { resolve(JSON.parse(body || '{}')); }
            catch (e) { reject(new Error('Invalid JSON body')); }
        });
        req.on('error', reject);
    });
}

function walkDir(dir, fileList = [], depth = 0) {
    if (fileList.length >= MAX_FILES || depth > 8) return fileList;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return fileList; }

    for (const entry of entries) {
        if (fileList.length >= MAX_FILES) break;
        if (entry.name.startsWith('.') && entry.name !== '.env') continue;
        if (IGNORED_DIRS.has(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkDir(fullPath, fileList, depth + 1);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ALLOWED_EXTENSIONS.has(ext) || ALLOWED_EXTENSIONS.has(entry.name.toLowerCase())) {
                const stat = fs.statSync(fullPath);
                if (stat.size <= MAX_FILE_SIZE) {
                    fileList.push({
                        path: path.relative(ROOT, fullPath),
                        size: stat.size,
                        ext: ext || entry.name
                    });
                }
            }
        }
    }
    return fileList;
}

// ── Request Router ────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const route = url.pathname;

    try {
        // GET /ping — health check
        if (route === '/ping' && req.method === 'GET') {
            return respond(res, 200, { ok: true, root: ROOT, version: '1.0' });
        }

        // GET /tree — list all files in workspace
        if (route === '/tree' && req.method === 'GET') {
            const files = walkDir(ROOT);
            return respond(res, 200, { root: ROOT, files });
        }

        // POST /read — read a single file
        if (route === '/read' && req.method === 'POST') {
            const { file } = await readBody(req);
            if (!file) return respond(res, 400, { error: 'Missing file path' });
            const fullPath = path.resolve(ROOT, file);
            if (!isWithinRoot(fullPath)) return respond(res, 403, { error: 'Path outside workspace' });
            if (!fs.existsSync(fullPath)) return respond(res, 404, { error: 'File not found' });
            const stat = fs.statSync(fullPath);
            if (stat.size > MAX_FILE_SIZE) return respond(res, 413, { error: 'File too large' });
            const content = fs.readFileSync(fullPath, 'utf8');
            return respond(res, 200, { file, content });
        }

        // POST /read-many — read multiple files at once
        if (route === '/read-many' && req.method === 'POST') {
            const { files } = await readBody(req);
            if (!Array.isArray(files)) return respond(res, 400, { error: 'files must be an array' });
            const results = [];
            for (const file of files.slice(0, 20)) {
                const fullPath = path.resolve(ROOT, file);
                if (!isWithinRoot(fullPath) || !fs.existsSync(fullPath)) continue;
                const stat = fs.statSync(fullPath);
                if (stat.size > MAX_FILE_SIZE) continue;
                results.push({ file, content: fs.readFileSync(fullPath, 'utf8') });
            }
            return respond(res, 200, { files: results });
        }

        // POST /write — write/patch a file
        if (route === '/write' && req.method === 'POST') {
            const { file, content, patch } = await readBody(req);
            if (!file) return respond(res, 400, { error: 'Missing file path' });
            const fullPath = path.resolve(ROOT, file);
            if (!isWithinRoot(fullPath)) return respond(res, 403, { error: 'Path outside workspace' });

            // Ensure parent directory exists
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });

            if (typeof content === 'string') {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`[BRUTAL] Written: ${file}`);
                return respond(res, 200, { ok: true, file });
            } else if (patch && patch.old !== undefined && patch.new !== undefined) {
                // String-replacement patch
                if (!fs.existsSync(fullPath)) return respond(res, 404, { error: 'File not found for patching' });
                let existing = fs.readFileSync(fullPath, 'utf8');
                if (!existing.includes(patch.old)) return respond(res, 409, { error: 'Patch target not found in file' });
                const patched = existing.replace(patch.old, patch.new);
                fs.writeFileSync(fullPath, patched, 'utf8');
                console.log(`[BRUTAL] Patched: ${file}`);
                return respond(res, 200, { ok: true, file });
            } else {
                return respond(res, 400, { error: 'Provide either content or patch.{old,new}' });
            }
        }

        respond(res, 404, { error: 'Unknown route' });
    } catch (err) {
        console.error('[BRUTAL Agent Error]', err.message);
        respond(res, 500, { error: err.message });
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║   BRUTAL Local Agent  —  v1.0            ║`);
    console.log(`╠══════════════════════════════════════════╣`);
    console.log(`║   http://localhost:${PORT}                  ║`);
    console.log(`║   Workspace: ${ROOT.substring(0, 27).padEnd(27)} ║`);
    console.log(`╚══════════════════════════════════════════╝\n`);
    console.log('Waiting for connections from BRUTAL web app...\n');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Is the agent already running?`);
    } else {
        console.error('Agent error:', err);
    }
    process.exit(1);
});
