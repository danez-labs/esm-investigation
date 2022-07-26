"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCache = exports.restoreCache = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const utils_1 = require("./utils");
const findDistDir = (publish) => {
    // In normal operation, the dist dir is the same as the publish dir
    if (!(0, utils_1.shouldSkip)()) {
        return publish;
    }
    // In this situation, the user has disabled the plugin, which means that they might be using next export,
    // so we'll look in a few places to find the site root. This allows us to find the .next directory.
    for (const root of [(0, path_1.resolve)(publish, '..'), (0, path_1.resolve)(publish, '..', '..')]) {
        if ((0, fs_1.existsSync)((0, path_1.join)(root, 'next.config.js'))) {
            return (0, path_1.join)(root, '.next');
        }
    }
    return null;
};
const restoreCache = async ({ cache, publish }) => {
    const distDir = findDistDir(publish);
    if (!distDir) {
        return;
    }
    if (await cache.restore((0, path_1.join)(distDir, 'cache'))) {
        console.log('Next.js cache restored.');
    }
    else {
        console.log('No Next.js cache to restore.');
    }
};
exports.restoreCache = restoreCache;
const saveCache = async ({ cache, publish }) => {
    const distDir = findDistDir(publish);
    if (!distDir) {
        return;
    }
    if (await cache.save((0, path_1.join)(distDir, 'cache'))) {
        console.log('Next.js cache saved.');
    }
    else {
        console.log('No Next.js cache to save.');
    }
};
exports.saveCache = saveCache;
