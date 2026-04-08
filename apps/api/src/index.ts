import 'dotenv/config';
import { createApp } from './server';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const app = createApp();

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
