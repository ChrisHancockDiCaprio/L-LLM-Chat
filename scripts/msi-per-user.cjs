const fs = require('node:fs/promises');
const path = require('node:path');

// Native MSI in a fixed per-user program folder. It never installs into the vault.
module.exports = async function(projectFile) {
  let xml = await fs.readFile(projectFile, 'utf8');
  const packageTag = '<Package Compressed="yes" InstallerVersion="500"/>';
  const scopeTag = '<Property Id="ALLUSERS" Secure="yes" Value="2"/>';
  if (!xml.includes(packageTag) || !xml.includes(scopeTag)) throw new Error('Unexpected MSI template; stop rather than change installation scope.');
  xml = xml.replace(packageTag, '<Package Compressed="yes" InstallerVersion="500" InstallScope="perUser"/>');
  xml = xml.replace(scopeTag, '');
  const fixedFolder = '\n    <SetDirectory Id="APPLICATIONFOLDER" Value="[LocalAppDataFolder]Programs\\KAIROS MSI\\" Sequence="both"/>\n    <Condition Message="This installer is for the current Windows account only."><![CDATA[NOT ALLUSERS]]></Condition>\n';
  xml = xml.replace('<Property Id="WIXUI_INSTALLDIR"', fixedFolder + '    <Property Id="WIXUI_INSTALLDIR"');
  await fs.writeFile(projectFile, xml);
  const output = path.dirname(path.dirname(projectFile)); await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'project.wxs'), xml);
};
