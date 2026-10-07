const base = require('./electron-builder.config.cjs');
module.exports = {
  ...base,
  directories: { ...base.directories, output: 'dist-msi-release' },
  win: { ...base.win, target: [{ target: 'msi', arch: ['x64'] }] },
  msi: { oneClick: true, perMachine: false, runAfterFinish: false, createDesktopShortcut: true, createStartMenuShortcut: true,
    artifactName: 'KAIROS-Setup-${version}-${arch}.${ext}' },
  msiProjectCreated: './scripts/msi-per-user.cjs',
};
