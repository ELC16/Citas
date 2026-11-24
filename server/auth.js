import crypto from 'node:crypto';
const kdf = (pw, salt, it) => crypto.pbkdf2Sync(pw, Buffer.from(salt, 'hex'), it, 32, 'sha256');
export const hashPw = (pw, it = 600000) => { const salt = crypto.randomBytes(16).toString('hex'); return `pbkdf2_sha256$${it}$${salt}$${kdf(pw, salt, it).toString('hex')}`; };
export const checkPw = (pw, stored) => {
  const [, it, salt, h] = (stored || '').split('$');
  if (!h) return false;
  const a = kdf(pw, salt, +it), b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const sign = (exp, secret) => crypto.createHmac('sha256', secret).update(exp).digest('hex');
export const makeToken = secret => { const exp = String(Math.floor(Date.now() / 1000) + 8 * 3600); return `${exp}.${sign(exp, secret)}`; };
export const validToken = (t, secret) => {
  const [exp, sig] = (t || '').split('.');
  if (!secret || !sig) return false;
  const good = sign(exp, secret);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good)) && +exp > Date.now() / 1000;
};
