// Fixed program. Configuration is validated server-side and is never shell input.
// Only wg0 exists in the worker namespace: loss of the tunnel cannot use host egress.
export const vpnSource = String.raw`
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
const c=JSON.parse(await readFile('/home/user/boatduck-vpn.json','utf8'));
const run=(...args)=>execFileSync('sudo',['-n',...args],{stdio:['ignore','pipe','pipe']});
try {
 run('ip','netns','add','duckprivate');
 run('ip','link','add','duckwg','type','wireguard');
 await writeFile('/dev/shm/duck-wg.conf','[Interface]\nPrivateKey = '+c.privateKey+'\n[Peer]\nPublicKey = '+c.publicKey+'\nEndpoint = '+c.endpointIp+':'+c.endpointPort+'\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25\n',{mode:0o600});
 run('wg','setconf','duckwg','/dev/shm/duck-wg.conf');
 await unlink('/dev/shm/duck-wg.conf');
 await unlink('/home/user/boatduck-vpn.json');
 run('ip','link','set','duckwg','netns','duckprivate');
 run('ip','-n','duckprivate','address','add',c.address,'dev','duckwg');
 run('ip','-n','duckprivate','link','set','lo','up');
 run('ip','-n','duckprivate','link','set','duckwg','up');
 run('ip','-n','duckprivate','route','add','default','dev','duckwg');
 run('mkdir','-p','/etc/netns/duckprivate');
 await writeFile('/dev/shm/duck-resolv','nameserver '+c.dns+'\n',{mode:0o600});
 run('cp','/dev/shm/duck-resolv','/etc/netns/duckprivate/resolv.conf');
 // Probe before sending any discovery terms. A mismatch fails closed.
 const probe=run('ip','netns','exec','duckprivate',process.execPath,'--input-type=module','-e',"const r=await fetch('https://api.ipify.org',{signal:AbortSignal.timeout(12000)});if(!r.ok)process.exit(2);process.stdout.write((await r.text()).trim())").toString().trim();
 if(probe!==c.expectedExitIp)throw new Error('VPN exit mismatch');
 console.log(JSON.stringify({type:'vpn',verified:true,exitIp:probe}));
 const child=spawnSync('sudo',['-n','--preserve-env=CONTEXT_DEV_API_KEY','ip','netns','exec','duckprivate',process.execPath,'/home/user/boatduck-worker.mjs'],{stdio:'inherit',timeout:125000});
 process.exitCode=child.status===0?0:1;
} catch { console.error('Private VPN worker failed closed');process.exitCode=1; }
finally {
 try{await unlink('/dev/shm/duck-wg.conf')}catch{}
 try{await unlink('/home/user/boatduck-vpn.json')}catch{}
 try{run('ip','netns','delete','duckprivate')}catch{}
 try{run('ip','link','delete','duckwg')}catch{}
}
`;
