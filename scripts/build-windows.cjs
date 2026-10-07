// Load the NSIS adapter only in this build process. A --require argument would
// be inherited by native-rebuild workers running from another directory.
require('./nsis-static-uninstaller.cjs');
require('electron-builder/cli');
