"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCustomHeaders = exports.configureHandlerFunctions = exports.updateRequiredServerFiles = exports.getRequiredServerFiles = exports.getNextConfig = void 0;
const fs_extra_1 = require("fs-extra");
const pathe_1 = require("pathe");
const slash_1 = __importDefault(require("slash"));
const constants_1 = require("../constants");
const ROUTES_MANIFEST_FILE = 'routes-manifest.json';
const defaultFailBuild = (message, { error }) => {
    throw new Error(`${message}\n${error && error.stack}`);
};
const getNextConfig = async function getNextConfig({ publish, failBuild = defaultFailBuild, }) {
    try {
        const { config, appDir, ignore } = await (0, fs_extra_1.readJSON)((0, pathe_1.join)(publish, 'required-server-files.json'));
        if (!config) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            return failBuild('Error loading your Next config');
        }
        const routesManifest = await (0, fs_extra_1.readJSON)((0, pathe_1.join)(publish, ROUTES_MANIFEST_FILE));
        // If you need access to other manifest files, you can add them here as well
        return { ...config, appDir, ignore, routesManifest };
    }
    catch (error) {
        return failBuild('Error loading your Next config', { error });
    }
};
exports.getNextConfig = getNextConfig;
/**
 * Returns all of the NextJS configuration stored within 'required-server-files.json'
 * To update the configuration within this file, use the 'updateRequiredServerFiles' method.
 */
const getRequiredServerFiles = async (publish) => {
    const configFile = (0, pathe_1.join)(publish, 'required-server-files.json');
    return await (0, fs_extra_1.readJSON)(configFile);
};
exports.getRequiredServerFiles = getRequiredServerFiles;
/**
 * Writes a modified configuration object to 'required-server-files.json'.
 * To get the full configuration, use the 'getRequiredServerFiles' method.
 */
const updateRequiredServerFiles = async (publish, modifiedConfig) => {
    const configFile = (0, pathe_1.join)(publish, 'required-server-files.json');
    await (0, fs_extra_1.writeJSON)(configFile, modifiedConfig);
};
exports.updateRequiredServerFiles = updateRequiredServerFiles;
const resolveModuleRoot = (moduleName) => {
    try {
        return (0, pathe_1.dirname)((0, pathe_1.relative)(process.cwd(), require.resolve(`${moduleName}/package.json`, { paths: [process.cwd()] })));
    }
    catch {
        return null;
    }
};
const DEFAULT_EXCLUDED_MODULES = ['sharp', 'electron'];
const configureHandlerFunctions = async ({ netlifyConfig, publish, ignore = [] }) => {
    var _a;
    const config = await (0, exports.getRequiredServerFiles)(publish);
    const files = config.files || [];
    const cssFilesToInclude = files.filter((f) => f.startsWith(`${publish}/static/css/`));
    /* eslint-disable no-underscore-dangle */
    (_a = netlifyConfig.functions)._ipx || (_a._ipx = {});
    netlifyConfig.functions._ipx.node_bundler = 'nft';
    [constants_1.HANDLER_FUNCTION_NAME, constants_1.ODB_FUNCTION_NAME].forEach((functionName) => {
        var _a, _b;
        (_a = netlifyConfig.functions)[functionName] || (_a[functionName] = { included_files: [], external_node_modules: [] });
        netlifyConfig.functions[functionName].node_bundler = 'nft';
        (_b = netlifyConfig.functions[functionName]).included_files || (_b.included_files = []);
        netlifyConfig.functions[functionName].included_files.push('.env', '.env.local', '.env.production', '.env.production.local', './public/locales/**', './next-i18next.config.js', `${publish}/server/**`, `${publish}/serverless/**`, `${publish}/*.json`, `${publish}/BUILD_ID`, `${publish}/static/chunks/webpack-middleware*.js`, `!${publish}/server/**/*.js.nft.json`, ...cssFilesToInclude, ...ignore.map((path) => `!${(0, slash_1.default)(path)}`));
        const nextRoot = resolveModuleRoot('next');
        if (nextRoot) {
            netlifyConfig.functions[functionName].included_files.push(`!${nextRoot}/dist/server/lib/squoosh/**/*.wasm`, `!${nextRoot}/dist/next-server/server/lib/squoosh/**/*.wasm`, `!${nextRoot}/dist/compiled/webpack/bundle4.js`, `!${nextRoot}/dist/compiled/webpack/bundle5.js`);
        }
        DEFAULT_EXCLUDED_MODULES.forEach((moduleName) => {
            const moduleRoot = resolveModuleRoot(moduleName);
            if (moduleRoot) {
                netlifyConfig.functions[functionName].included_files.push(`!${moduleRoot}/**/*`);
            }
        });
    });
};
exports.configureHandlerFunctions = configureHandlerFunctions;
const buildHeader = (buildHeaderParams) => {
    const { path, headers } = buildHeaderParams;
    return {
        for: path,
        values: headers.reduce((builtHeaders, { key, value }) => {
            builtHeaders[key] = value;
            return builtHeaders;
        }, {}),
    };
};
// Replace the pattern :path* at the end of a path with * since it's a named splat which the Netlify
// configuration does not support.
const sanitizePath = (path) => path.replace(/:[^*/]+\*$/, '*');
/**
 * Persist NEXT.js custom headers to the Netlify configuration so the headers work with static files
 * See {@link https://nextjs.org/docs/api-reference/next.config.js/headers} for more information on custom
 * headers in Next.js
 *
 * @param nextConfig - The NextJS configuration
 * @param netlifyHeaders - Existing headers that are already configured in the Netlify configuration
 */
const generateCustomHeaders = (nextConfig, netlifyHeaders = []) => {
    var _a;
    // The routesManifest is the contents of the routes-manifest.json file which will already contain the generated
    // header paths which take locales and base path into account since this runs after the build. The routes-manifest.json
    // file is located at demos/default/.next/routes-manifest.json once you've build the demo site.
    const { routesManifest: { headers: customHeaders = [] }, i18n, } = nextConfig;
    // Skip `has` based custom headers as they have more complex dynamic conditional header logic
    // that currently isn't supported by the Netlify configuration.
    // Also, this type of dynamic header logic is most likely not for SSG pages.
    for (const { source, headers, locale: localeEnabled } of customHeaders.filter((customHeader) => !customHeader.has)) {
        // Explicitly checking false to make the check simpler.
        // Locale specific paths are excluded only if localeEnabled is false. There is no true value for localeEnabled. It's either
        // false or undefined, where undefined means it's true.
        //
        // Again, the routesManifest has already been generated taking locales into account, but the check is required
        // so  the paths can be properly set in the Netlify configuration.
        const useLocale = ((_a = i18n === null || i18n === void 0 ? void 0 : i18n.locales) === null || _a === void 0 ? void 0 : _a.length) > 0 && localeEnabled !== false;
        if (useLocale) {
            const { locales } = i18n;
            const joinedLocales = locales.join('|');
            /**
             *  converts e.g.
             *  /:nextInternalLocale(en|fr)/some-path
             *  to a path for each locale
             *  /en/some-path and /fr/some-path as well as /some-path (default locale)
             */
            const defaultLocalePath = sanitizePath(source).replace(`/:nextInternalLocale(${joinedLocales})`, '');
            netlifyHeaders.push(buildHeader({ path: defaultLocalePath, headers }));
            for (const locale of locales) {
                const path = sanitizePath(source).replace(`:nextInternalLocale(${joinedLocales})`, locale);
                netlifyHeaders.push(buildHeader({ path, headers }));
            }
        }
        else {
            const path = sanitizePath(source);
            netlifyHeaders.push(buildHeader({ path, headers }));
        }
    }
};
exports.generateCustomHeaders = generateCustomHeaders;
