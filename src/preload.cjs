const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('qwenChat', {
  checkJob: id => ipcRenderer.invoke('jobs:check',id),
  stopJob: id => ipcRenderer.invoke('jobs:stop',id),
  trustSSHHost: (id,accept) => ipcRenderer.invoke('ssh:trust',id,accept),
  importSSHKey: config => ipcRenderer.invoke('ssh:key',config),
  state: () => ipcRenderer.invoke('chat:state'),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  saveUpdateRepository: url => ipcRenderer.invoke('updates:source', url),
  check: () => ipcRenderer.invoke('chat:check'),
  send: (text, attachmentIds, imageOptions) => ipcRenderer.invoke('chat:send', text, attachmentIds, imageOptions),
  exportImage: id => ipcRenderer.invoke('attachments:export', id),
  attach: () => ipcRenderer.invoke('attachments:add'),
  removeAttachment: id => ipcRenderer.invoke('attachments:remove', id),
  cancel: () => ipcRenderer.invoke('chat:cancel'),
  deleteChat: id => ipcRenderer.invoke('chat:delete', id),
  setBetaUpdates: enabled => ipcRenderer.invoke('updates:beta', enabled),
  duplicateWorkflowProfile: id => ipcRenderer.invoke('settings:workflow-duplicate', id),
  newChat: () => ipcRenderer.invoke('chat:new'),
  select: id => ipcRenderer.invoke('chat:select', id),
  saveProfile: profile => ipcRenderer.invoke('settings:save', profile),
  toggleProfile: (id, enabled) => ipcRenderer.invoke('settings:toggle', id, enabled),
  selectProfile: id => ipcRenderer.invoke('settings:select', id),
  probeServer: request => ipcRenderer.invoke('settings:probe', request),
  addServer: request => ipcRenderer.invoke('settings:server', request),
  refreshServer: id => ipcRenderer.invoke('settings:refresh', id),
  removeProfile: (id, wholeServer = false) => ipcRenderer.invoke('settings:remove', id, wholeServer),
  importWorkflow: id => ipcRenderer.invoke('settings:workflow', id),
  configureWorkflow: (id, mapping, options, limits) => ipcRenderer.invoke('settings:workflow-config', id, mapping, options, limits),
  onState: handler => {
    const listener = (_event, state) => handler(state);
    ipcRenderer.on('chat:update', listener);
    return () => ipcRenderer.removeListener('chat:update', listener);
  },
});
