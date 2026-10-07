const source = require('./release/update-source.json');
module.exports = {
  appId: 'sol.qwen-chat', productName: 'KAIROS',
  directories: { output: 'dist-release', buildResources: 'build' },
  files: ['src/**/*', 'ui/**/*', 'assets/**/*', 'release/update-source.json', 'package.json'],
  asar: true,
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'build/icon.ico', executableName: 'KAIROS' },
  nsis: { oneClick: false, perMachine: false, allowElevation: false, allowToChangeInstallationDirectory: true,
    include: 'build/installer.nsh', installerIcon: 'build/icon.ico', uninstallerIcon: 'build/icon.ico',
    createDesktopShortcut: true, createStartMenuShortcut: true, runAfterFinish: false,
    artifactName: 'KAIROS-Setup-${version}-${arch}.${ext}', installerLanguages: ['de_DE', 'en_US'] },
  publish: { provider: 'github', owner: source.owner, repo: source.repo },
};
