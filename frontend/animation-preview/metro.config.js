const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '..')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, '../node_modules')];
config.resolver.unstable_conditionNames = ['react-native', 'require'];
module.exports = config;
