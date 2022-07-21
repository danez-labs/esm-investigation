"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable max-lines */
const path_1 = require("path");
const chalk_1 = require("chalk");
const fs_extra_1 = require("fs-extra");
const outdent_1 = require("outdent");
const constants_1 = require("./constants");
const cache_1 = require("./helpers/cache");
const config_1 = require("./helpers/config");
const edge_1 = require("./helpers/edge");
const files_1 = require("./helpers/files");
const functions_1 = require("./helpers/functions");
const redirects_1 = require("./helpers/redirects");
const utils_1 = require("./helpers/utils");
const verification_1 = require("./helpers/verification");
const plugin = {
    async onPreBuild({ constants, netlifyConfig, utils: { build: { failBuild }, cache, }, }) {
        var _a;
        const { publish } = netlifyConfig.build;
        if ((0, utils_1.shouldSkip)()) {
            await (0, cache_1.restoreCache)({ cache, publish });
            console.log('Not running Essential Next.js plugin');
            if ((0, fs_extra_1.existsSync)((0, path_1.join)(constants.INTERNAL_FUNCTIONS_SRC, constants_1.HANDLER_FUNCTION_NAME))) {
                console.log(`Please ensure you remove any generated functions from ${constants.INTERNAL_FUNCTIONS_SRC}`);
            }
            return;
        }
        (0, verification_1.checkForRootPublish)({ publish, failBuild });
        (0, verification_1.verifyNetlifyBuildVersion)({ failBuild, ...constants });
        await (0, cache_1.restoreCache)({ cache, publish });
        (_a = netlifyConfig.build).environment || (_a.environment = {});
        // eslint-disable-next-line unicorn/consistent-destructuring
        netlifyConfig.build.environment.NEXT_PRIVATE_TARGET = 'server';
    },
    async onBuild({ constants, netlifyConfig, utils: { build: { failBuild }, }, }) {
        var _a;
        if ((0, utils_1.shouldSkip)()) {
            return;
        }
        const { publish } = netlifyConfig.build;
        (0, verification_1.checkNextSiteHasBuilt)({ publish, failBuild });
        let experimentalRemotePatterns = [];
        const { appDir, basePath, i18n, images, target, ignore, trailingSlash, outdir, experimental } = await (0, config_1.getNextConfig)({
            publish,
            failBuild,
        });
        if (experimental.images) {
            experimentalRemotePatterns = experimental.images.remotePatterns || [];
        }
        if ((0, utils_1.isNextAuthInstalled)()) {
            const config = await (0, config_1.getRequiredServerFiles)(publish);
            const userDefinedNextAuthUrl = config.config.env.NEXTAUTH_URL;
            if (userDefinedNextAuthUrl) {
                console.log(`NextAuth package detected, NEXTAUTH_URL environment variable set by user to ${userDefinedNextAuthUrl}`);
            }
            else {
                const nextAuthUrl = `${process.env.URL}${basePath}`;
                console.log(`NextAuth package detected, setting NEXTAUTH_URL environment variable to ${nextAuthUrl}`);
                config.config.env.NEXTAUTH_URL = nextAuthUrl;
                await (0, config_1.updateRequiredServerFiles)(publish, config);
            }
        }
        const buildId = (0, fs_extra_1.readFileSync)((0, path_1.join)(publish, 'BUILD_ID'), 'utf8').trim();
        await (0, config_1.configureHandlerFunctions)({ netlifyConfig, ignore, publish: (0, path_1.relative)(process.cwd(), publish) });
        await (0, functions_1.generateFunctions)(constants, appDir);
        await (0, functions_1.generatePagesResolver)({ target, constants });
        await (0, files_1.movePublicFiles)({ appDir, outdir, publish });
        await (0, files_1.patchNextFiles)(basePath);
        if (!process.env.SERVE_STATIC_FILES_FROM_ORIGIN) {
            await (0, files_1.moveStaticPages)({ target, netlifyConfig, i18n, basePath });
        }
        await (0, redirects_1.generateStaticRedirects)({
            netlifyConfig,
            nextConfig: { basePath, i18n },
        });
        await (0, functions_1.setupImageFunction)({
            constants,
            imageconfig: images,
            netlifyConfig,
            basePath,
            remotePatterns: experimentalRemotePatterns,
        });
        await (0, redirects_1.generateRedirects)({
            netlifyConfig,
            nextConfig: { basePath, i18n, trailingSlash, appDir },
            buildId,
        });
        // We call this even if we don't have edge functions enabled because we still use it for images
        await (0, edge_1.writeEdgeFunctions)(netlifyConfig);
        if (process.env.NEXT_USE_NETLIFY_EDGE) {
            console.log((0, outdent_1.outdent) `
        ✨ Deploying to ${(0, chalk_1.greenBright) `Netlify Edge Functions`} ✨
        This feature is in beta. Please share your feedback here: https://ntl.fyi/next-netlify-edge
      `);
            await (0, edge_1.updateConfig)(publish);
        }
        const middlewareManifest = await (0, edge_1.loadMiddlewareManifest)(netlifyConfig);
        if (!process.env.NEXT_USE_NETLIFY_EDGE && ((_a = middlewareManifest === null || middlewareManifest === void 0 ? void 0 : middlewareManifest.sortedMiddleware) === null || _a === void 0 ? void 0 : _a.length)) {
            console.log((0, chalk_1.yellowBright)((0, outdent_1.outdent) `
          You are using Next.js Middleware without Netlify Edge Functions.
          This will soon be deprecated because it negatively affects performance and will disable ISR and static rendering.
          To get the best performance and use Netlify Edge Functions, set the env var ${(0, chalk_1.bold) `NEXT_USE_NETLIFY_EDGE=true`}.
        `));
        }
    },
    async onPostBuild({ netlifyConfig: { build: { publish }, redirects, headers, }, utils: { status, cache, functions, build: { failBuild }, }, constants: { FUNCTIONS_DIST }, }) {
        await (0, cache_1.saveCache)({ cache, publish });
        if ((0, utils_1.shouldSkip)()) {
            status.show({
                title: 'Essential Next.js plugin did not run',
                summary: `Next cache was stored, but all other functions were skipped because ${process.env.NETLIFY_NEXT_PLUGIN_SKIP
                    ? `NETLIFY_NEXT_PLUGIN_SKIP is set`
                    : `NEXT_PLUGIN_FORCE_RUN is set to ${process.env.NEXT_PLUGIN_FORCE_RUN}`}`,
            });
            return;
        }
        await (0, verification_1.checkForOldFunctions)({ functions });
        await (0, verification_1.checkZipSize)((0, path_1.join)(FUNCTIONS_DIST, `${constants_1.ODB_FUNCTION_NAME}.zip`));
        const nextConfig = await (0, config_1.getNextConfig)({ publish, failBuild });
        const { basePath, appDir } = nextConfig;
        (0, config_1.generateCustomHeaders)(nextConfig, headers);
        (0, verification_1.warnForProblematicUserRewrites)({ basePath, redirects });
        (0, verification_1.warnForRootRedirects)({ appDir });
        await (0, files_1.unpatchNextFiles)(basePath);
    },
};
module.exports = plugin;
/* eslint-enable max-lines */
