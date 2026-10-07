const proof=Symbol('verified SSH transport');
export function markTunnel(profile) { return {...profile,[proof]:{origin:profile.baseUrl,targetHost:profile.ssh.targetHost}}; }
export function trustedTunnel(profile) { return profile?.[proof]?.origin===profile.baseUrl && ['127.0.0.1','localhost','::1'].includes(profile[proof].targetHost); }
