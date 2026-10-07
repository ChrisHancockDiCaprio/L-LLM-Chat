// electron-builder 26.15.3 normally runs a temporary NSIS executable to obtain
// the uninstaller. Use its built-in binary reader instead: no temporary EXE runs.
// This respects Windows application-control policies; it does not disable them.
if (process.platform === 'win32') {
  const path = require('node:path');
  const { WineVmManager } = require('app-builder-lib/out/vm/WineVm');
  const { UninstallerReader } = require('app-builder-lib/out/targets/nsis/nsisUtil');
  const original = WineVmManager.prototype.exec;
  WineVmManager.prototype.exec = function(file, args, options, ...rest) {
    if (args.length === 0 && options?.env?.__COMPAT_LAYER === 'RunAsInvoker' && path.extname(file).toLowerCase() === '.exe') {
      const output = path.join(path.dirname(file), path.basename(file, 'exe') + '__uninstaller.exe');
      return UninstallerReader.exec(file, output).then(() => '');
    }
    return original.call(this, file, args, options, ...rest);
  };
}
