import Supermemory from 'supermemory';
import dotenv from 'dotenv';

dotenv.config();

const client = new Supermemory({
  apiKey: process.env.SUPERMEMORY_API_KEY || 'sm_local_dev_key',
  baseURL: process.env.SUPERMEMORY_BASE_URL || 'http://localhost:8000',
});

export default client;
export { client as supermemoryClient };
