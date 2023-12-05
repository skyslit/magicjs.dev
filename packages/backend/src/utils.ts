import bcrypt from 'bcryptjs';

/* -------------------------------------------------------------------------- */
/*                                  Security                                  */
/* -------------------------------------------------------------------------- */

function hash(payload: string, salt: number = 10) {
    const s = bcrypt.genSaltSync();
    return bcrypt.hashSync(payload, s);
}

function verifyHash(payload: string, hash: string): boolean {
    return bcrypt.compareSync(payload, hash);
}

export default {
    hash,
    verifyHash
}