module.exports = {
  appId: 'sol.qwen-chat', productName: 'KAIROS',
  directories: { output: 'dist-release', buildResources: 'build' },
  files: ['src/**/*', 'ui/**/*', 'assets/**/*', 'licenses/**/*', 'THIRD_PARTY_NOTICES.md', 'release/update-source.json', 'package.json'],
  extraFiles: [{from:'PORTABLE.md',to:'PORTABLE-LESEN.md'}],
  asar: true,
  // All required dependencies are JavaScript. ssh2's native CPU/crypto helpers
  // are optional; its tested JS implementation needs no Electron ABI rebuild.
  npmRebuild: false,
  win: { target: [{ target: 'zip', arch: ['x64'] }], icon: 'build/icon.ico', executableName: 'KAIROS' },
  artifactName: 'KAIROS-Portable-${version}-${arch}.${ext}',
  publish: null,
};
