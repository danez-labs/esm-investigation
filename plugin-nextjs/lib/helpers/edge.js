"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateConfig = exports.writeEdgeFunctions = exports.loadMiddlewareManifest = void 0;
/* eslint-disable max-lines */
const fs_1 = require("fs");
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
const loadMiddlewareManifest = (netlifyConfig) => {
    const middlewarePath = (0, path_1.resolve)(netlifyConfig.build.publish, 'server', 'middleware-manifest.json');
    if (!(0, fs_1.existsSync)(middlewarePath)) {
        return null;
    }
    return (0, fs_extra_1.readJson)(middlewarePath);
};
exports.loadMiddlewareManifest = loadMiddlewareManifest;
/**
 * Convert the Next middleware name into a valid Edge Function name
 */
const sanitizeName = (name) => `next_${name.replace(/\W/g, '_')}`;
/**
 * Initialization added to the top of the edge function bundle
 */
const bootstrap = /* js */ `
globalThis.process = { env: {...Deno.env.toObject(), NEXT_RUNTIME: 'edge', 'NEXT_PRIVATE_MINIMAL_MODE': '1' } }
globalThis._ENTRIES ||= {}
// Deno defines "window", but naughty libraries think this means it's a browser
delete globalThis.window

`;
/**
 * Concatenates the Next edge function code with the required chunks and adds an export
 */
const getMiddlewareBundle = async ({ edgeFunctionDefinition, netlifyConfig, }) => {
    const { publish } = netlifyConfig.build;
    const chunks = [bootstrap];
    for (const file of edgeFunctionDefinition.files) {
        const filePath = (0, path_1.join)(publish, file);
        const data = await fs_1.promises.readFile(filePath, 'utf8');
        chunks.push('{', data, '}');
    }
    const middleware = await fs_1.promises.readFile((0, path_1.join)(publish, `server`, `${edgeFunctionDefinition.name}.js`), 'utf8');
    chunks.push(middleware);
    const exports = /* js */ `export default _ENTRIES["middleware_${edgeFunctionDefinition.name}"].default;`;
    chunks.push(exports);
    return chunks.join('\n');
};
const copyEdgeSourceFile = ({ file, target, edgeFunctionDir, }) => fs_1.promises.copyFile((0, path_1.join)(__dirname, '..', '..', 'src', 'templates', 'edge', file), (0, path_1.join)(edgeFunctionDir, target !== null && target !== void 0 ? target : file));
// Edge functions don't support lookahead expressions
const stripLookahead = (regex) => regex.replace('^/(?!_next)', '^/');
const writeEdgeFunction = async ({ edgeFunctionDefinition, edgeFunctionRoot, netlifyConfig, }) => {
    const name = sanitizeName(edgeFunctionDefinition.name);
    const edgeFunctionDir = (0, path_1.join)(edgeFunctionRoot, name);
    const bundle = await getMiddlewareBundle({
        edgeFunctionDefinition,
        netlifyConfig,
    });
    await (0, fs_extra_1.ensureDir)(edgeFunctionDir);
    await fs_1.promises.writeFile((0, path_1.join)(edgeFunctionDir, 'bundle.js'), bundle);
    await copyEdgeSourceFile({
        edgeFunctionDir,
        file: 'runtime.ts',
        target: 'index.ts',
    });
    await copyEdgeSourceFile({ edgeFunctionDir, file: 'utils.ts' });
    return {
        function: name,
        pattern: stripLookahead(edgeFunctionDefinition.regexp),
    };
};
/**
 * Writes Edge Functions for the Next middleware
 */
const writeEdgeFunctions = async (netlifyConfig) => {
    const manifest = {
        functions: [],
        version: 1,
    };
    const edgeFunctionRoot = (0, path_1.resolve)('.netlify', 'edge-functions');
    await (0, fs_extra_1.emptyDir)(edgeFunctionRoot);
    if (!process.env.NEXT_DISABLE_EDGE_IMAGES) {
        if (!process.env.NEXT_USE_NETLIFY_EDGE) {
            console.log('Using Netlify Edge Functions for image format detection. Set env var "NEXT_DISABLE_EDGE_IMAGES=true" to disable.');
        }
        const edgeFunctionDir = (0, path_1.join)(edgeFunctionRoot, 'ipx');
        await (0, fs_extra_1.ensureDir)(edgeFunctionDir);
        await copyEdgeSourceFile({ edgeFunctionDir, file: 'ipx.ts', target: 'index.ts' });
        await (0, fs_extra_1.copyFile)((0, path_1.join)('.netlify', 'functions-internal', '_ipx', 'imageconfig.json'), (0, path_1.join)(edgeFunctionDir, 'imageconfig.json'));
        manifest.functions.push({
            function: 'ipx',
            path: '/_next/image*',
        });
    }
    if (process.env.NEXT_USE_NETLIFY_EDGE) {
        const middlewareManifest = await (0, exports.loadMiddlewareManifest)(netlifyConfig);
        if (!middlewareManifest) {
            console.error("Couldn't find the middleware manifest");
            return;
        }
        for (const middleware of middlewareManifest.sortedMiddleware) {
            const edgeFunctionDefinition = middlewareManifest.middleware[middleware];
            const functionDefinition = await writeEdgeFunction({
                edgeFunctionDefinition,
                edgeFunctionRoot,
                netlifyConfig,
            });
            manifest.functions.push(functionDefinition);
        }
        // Older versions of the manifest format don't have the functions field
        // No, the version field was not incremented
        if (typeof middlewareManifest.functions === 'object') {
            for (const edgeFunctionDefinition of Object.values(middlewareManifest.functions)) {
                const functionDefinition = await writeEdgeFunction({
                    edgeFunctionDefinition,
                    edgeFunctionRoot,
                    netlifyConfig,
                });
                manifest.functions.push(functionDefinition);
            }
        }
    }
    await (0, fs_extra_1.writeJson)((0, path_1.join)(edgeFunctionRoot, 'manifest.json'), manifest);
};
exports.writeEdgeFunctions = writeEdgeFunctions;
const updateConfig = async (publish) => {
    const configFile = (0, path_1.join)(publish, 'required-server-files.json');
    const config = await (0, fs_extra_1.readJSON)(configFile);
    config.config.env.NEXT_USE_NETLIFY_EDGE = 'true';
    await (0, fs_extra_1.writeJSON)(configFile, config);
};
exports.updateConfig = updateConfig;
/* eslint-enable max-lines */
