import crypto from 'crypto';
import type { Handler } from '@netlify/functions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const hashPassword = (value: string) =>
  crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  return crypto.timingSafeEqual(aBuf, bBuf);
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const password: string | undefined = body.password;

    if (!password) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Password is required' }),
      };
    }

    const expectedHash = process.env.ADMIN_PASSWORD_HASH || '';
    if (!expectedHash) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Server password is not configured' }),
      };
    }

    const incomingHash = hashPassword(password);
    const isValid = timingSafeEqual(expectedHash, incomingHash);

    if (!isValid) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Invalid password' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Unexpected error' }),
    };
  }
};

