const pattern=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.([1-9]\d*))?$/;
export function validVersion(v){return typeof v==='string' && pattern.test(v);}
export function versionParts(v){
  if(!validVersion(v))throw Error('Invalid framework version');
  const m=pattern.exec(v);const parts=m.slice(1,4).map(Number);
  if(!parts.every(Number.isSafeInteger) || (m[4] && !Number.isSafeInteger(Number(m[4]))))throw Error('Invalid framework version');
  return [...parts,m[4]?Number(m[4]):Infinity];
}
export function compareVersions(a,b){
  const x=versionParts(a),y=versionParts(b);
  for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]<y[i]?-1:1;
  return 0;
}
