const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('qwenChat', {
  state: () => ipcRenderer.invoke('chat:state'),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  check: () => ipcRenderer.invoke('chat:check'),
  send: (text, attachmentIds) => ipcRenderer.invoke('chat:send', text, attachmentIds),
  attach: () => ipcRenderer.invoke('attachments:add'),
  removeAttachment: id => ipcRenderer.invoke('attachments:remove', id),
  cancel: () => ipcRenderer.invoke('chat:cancel'),
  newChat: () => ipcRenderer.invoke('chat:new'),
  select: id => ipcRenderer.invoke('chat:select', id),
  saveProfile: profile => ipcRenderer.invoke('settings:save', profile),
  toggleProfile: (id, enabled) => ipcRenderer.invoke('settings:toggle', id, enabled),
  selectProfile: id => ipcRenderer.invoke('settings:select', id),
  probeServer: request => ipcRenderer.invoke('settings:probe', request),
  addServer: request => ipcRenderer.invoke('settings:server', request),
  onState: handler => {
    const listener = (_event, state) => handler(state);
    ipcRenderer.on('chat:update', listener);
    return () => ipcRenderer.removeListener('chat:update', listener);
  },
});
