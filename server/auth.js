import crypto from 'node:crypto';
const kdf = (pw, salt, it) => crypto.pbkdf2Sync(pw, Buffer.from(salt, 'hex'), it, 32, 'sha256');
export const hashPw = (pw, it = 600000) => { const salt = crypto.randomBytes(16).toString('hex'); return `pbkdf2_sha256$${it}$${salt}$${kdf(pw, salt, it).toString('hex')}`; };
export const checkPw = (pw, stored) => {
  const [, it, salt, h] = (stored || '').split('$');
  if (!h) return false;
  const a = kdf(pw, salt, +it), b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const sign = (m, secret) => crypto.createHmac('sha256', secret).update(m).digest('hex');
// El token lleva el id del negocio: solo sirve para administrar ESE negocio.
export const makeToken = (nid, secret) => { const m = `${nid}.${Math.floor(Date.now() / 1000) + 8 * 3600}`; return `${m}.${sign(m, secret)}`; };
export const validToken = (t, secret) => {
  const [nid, exp, sig] = (t || '').split('.');
  if (!secret || !sig) return 0;
  const good = sign(`${nid}.${exp}`, secret);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good)) && +exp > Date.now() / 1000 ? +nid : 0;
};
