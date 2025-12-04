import { Handler } from '@netlify/functions';
import { Client } from 'pg';

const getConnectionString = () =>
  process.env.NEON_CONNECTION_STRING ||
  process.env.NETLIFY_DB_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  '';

const runQuery = async <T>(query: string, params: unknown[] = []) => {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('Database connection string is not configured.');
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    return await client.query<T>(query, params);
  } finally {
    await client.end();
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        },
        body: '',
      };
    }

    if (event.httpMethod === 'GET') {
      const { fromDate, toDate } = event.queryStringParameters ?? {};
      const filters: string[] = [];
      const params: unknown[] = [];

      if (fromDate) {
        params.push(fromDate);
        filters.push(`date >= $${params.length}`);
      }
      if (toDate) {
        params.push(toDate);
        filters.push(`date <= $${params.length}`);
      }

      const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      const result = await runQuery<{
        id: number;
        date: string;
        category: string;
        subcategory: string;
        sender: string;
        receiver: string;
        remarks: string;
        amount: number;
        created_at: string;
      }>(
        `SELECT id, date, category, subcategory, sender, receiver, remarks, amount, created_at
         FROM transactions
         ${whereClause}
         ORDER BY date DESC, created_at DESC`,
        params
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.rows),
      };
    }

    if (event.httpMethod === 'POST') {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Request body is required.' }),
        };
      }

      const payload = JSON.parse(event.body);
      const requiredFields = ['date', 'category', 'subcategory', 'sender', 'receiver', 'remarks', 'amount'];
      for (const field of requiredFields) {
        if (!payload[field]) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: `${field} is required.` }),
          };
        }
      }

      const result = await runQuery(
        `INSERT INTO transactions (date, category, subcategory, sender, receiver, remarks, amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, date, category, subcategory, sender, receiver, remarks, amount, created_at`,
        [
          payload.date,
          payload.category,
          payload.subcategory,
          payload.sender,
          payload.receiver,
          payload.remarks,
          payload.amount,
        ]
      );

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(result.rows[0]),
      };
    }

    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Transaction id is required.' }),
        };
      }

      await runQuery('DELETE FROM transactions WHERE id = $1', [Number(id)]);
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: '',
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed.' }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
};

export { handler };

